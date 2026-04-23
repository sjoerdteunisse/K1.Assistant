/**
 * mcpManager.js
 * Manages the lifecycle of MCP (Model Context Protocol) server connections.
 * Supports stdio, SSE, and streamable-HTTP transports.
 */

const { EventEmitter } = require("events");
const { randomUUID } = require("crypto");
const debugLogger = require("./debugLogger");

class McpManager extends EventEmitter {
  constructor(databaseManager) {
    super();
    this.databaseManager = databaseManager;

    // Map<serverId, { client, transport, config, status, cachedTools }>
    this._connections = new Map();
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Connect to all enabled MCP servers stored in the DB.
   * Called once on app startup after the DB is ready.
   */
  async connectAll() {
    const servers = this.databaseManager.getMcpServers();
    for (const server of servers) {
      if (server.enabled) {
        this.connect(server).catch((err) => {
          debugLogger.warn(
            "[mcp] Failed to auto-connect server",
            { id: server.id, name: server.name, error: err?.message },
            "mcp"
          );
        });
      }
    }
  }

  /** Disconnect all live servers. Called on app will-quit. */
  async disconnectAll() {
    const ids = [...this._connections.keys()];
    await Promise.allSettled(ids.map((id) => this.disconnect(id)));
  }

  // ─── Connection management ─────────────────────────────────────────────────

  async connect(server) {
    if (this._connections.has(server.id)) {
      await this.disconnect(server.id);
    }

    this._setStatus(server.id, "connecting");

    try {
      const { Client } = require("@modelcontextprotocol/sdk/client");
      const client = new Client(
        { name: "k1-assistant", version: "1.0.0" },
        { capabilities: { tools: {} } }
      );

      const transport = this._createTransport(server);
      await client.connect(transport);

      const toolsResult = await client.listTools();
      const cachedTools = toolsResult.tools || [];

      this._connections.set(server.id, { client, transport, config: server, status: "connected", cachedTools });
      this._setStatus(server.id, "connected");

      debugLogger.info(
        "[mcp] Server connected",
        { id: server.id, name: server.name, tools: cachedTools.length },
        "mcp"
      );
    } catch (err) {
      this._connections.delete(server.id);
      this._setStatus(server.id, "error", err?.message);
      debugLogger.error("[mcp] Connection failed", { id: server.id, error: err?.message }, "mcp");
      throw err;
    }
  }

  async disconnect(serverId) {
    const entry = this._connections.get(serverId);
    if (!entry) return;

    try {
      await entry.transport.close?.();
    } catch (_) {
      // ignore close errors
    }

    this._connections.delete(serverId);
    this._setStatus(serverId, "disconnected");
  }

  _createTransport(server) {
    if (server.transport === "stdio") {
      const { StdioClientTransport } = require(
        "@modelcontextprotocol/sdk/client/stdio.js"
      );
      const command = this._resolveCommand(server.command || "npx");
      const args = server.args ? JSON.parse(server.args) : [];
      const env = this._buildEnv(server.env_vars);

      return new StdioClientTransport({ command, args, env });
    }

    if (server.transport === "sse") {
      const { SSEClientTransport } = require(
        "@modelcontextprotocol/sdk/client/sse.js"
      );
      const headers = server.headers ? JSON.parse(server.headers) : {};
      return new SSEClientTransport(new URL(server.url), { requestInit: { headers } });
    }

    if (server.transport === "http") {
      const { StreamableHTTPClientTransport } = require(
        "@modelcontextprotocol/sdk/client/streamableHttp.js"
      );
      const headers = server.headers ? JSON.parse(server.headers) : {};
      return new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers } });
    }

    throw new Error(`Unknown transport: ${server.transport}`);
  }

  _setStatus(serverId, status, errorMessage) {
    this.emit("server-status-changed", { serverId, status, errorMessage });
  }

  /**
   * On Windows, executable names like "npx", "node", "npm" need the .cmd suffix
   * for child_process.spawn to find them without shell:true.
   */
  _resolveCommand(command) {
    if (process.platform === "win32") {
      const cmds = ["npx", "npm", "node", "uvx", "python", "python3"];
      if (cmds.includes(command)) return `${command}.cmd`;
    }
    return command;
  }

  /**
   * Build process env for stdio transports.
   * Augments PATH so that npx / node / uvx resolve correctly in packaged
   * Electron where the login-shell PATH is often stripped.
   */
  _buildEnv(envVarsJson) {
    const env = envVarsJson
      ? { ...process.env, ...JSON.parse(envVarsJson) }
      : { ...process.env };

    if (process.platform !== "win32") {
      // Directories where npx/node commonly live that may be absent from
      // Electron's stripped PATH on macOS / Linux.
      const extra = [
        "/opt/homebrew/bin",          // Homebrew (Apple Silicon)
        "/opt/homebrew/sbin",
        "/usr/local/bin",             // Homebrew (Intel) / system Node
        "/usr/local/sbin",
        `${process.env.HOME}/.npm-global/bin`,   // npm global (manual prefix)
        `${process.env.HOME}/.yarn/bin`,          // Yarn global
      ].filter(Boolean);
      const currentPath = env.PATH || "/usr/bin:/bin:/usr/sbin:/sbin";
      // Prepend any dirs not already present so user's PATH takes precedence.
      const missing = extra.filter((p) => !currentPath.split(":").includes(p));
      if (missing.length) env.PATH = `${missing.join(":")  }:${currentPath}`;
    } else {
      // Windows: ensure %APPDATA%\npm (default global install dir) is in PATH.
      const appData = process.env.APPDATA;
      if (appData) {
        const npmGlobal = `${appData}\\npm`;
        if (!env.PATH?.includes(npmGlobal)) {
          env.PATH = `${env.PATH || ""};${npmGlobal}`;
        }
      }
    }

    return env;
  }

  // ─── Tool operations ───────────────────────────────────────────────────────

  /**
   * Returns cached tools for all requested server IDs.
   * Re-fetches from server if cachedTools is empty.
   */
  async listTools(serverIds) {
    const result = [];
    for (const serverId of serverIds) {
      const entry = this._connections.get(serverId);
      if (!entry || entry.status !== "connected") continue;

      let tools = entry.cachedTools;
      if (!tools || tools.length === 0) {
        try {
          const r = await entry.client.listTools();
          tools = r.tools || [];
          entry.cachedTools = tools;
        } catch (err) {
          debugLogger.warn("[mcp] listTools failed", { serverId, error: err?.message }, "mcp");
          continue;
        }
      }

      const serverName = entry.config.name;
      tools.forEach((tool) => result.push({ serverId, serverName, tool }));
    }
    return result;
  }

  /**
   * Execute a tool call on the given server.
   */
  async callTool(serverId, toolName, args) {
    const entry = this._connections.get(serverId);
    if (!entry) throw new Error(`MCP server not connected: ${serverId}`);
    if (entry.status !== "connected") throw new Error(`MCP server not ready: ${serverId}`);

    debugLogger.debug(
      "[mcp] Calling tool",
      { serverId, toolName, args },
      "mcp"
    );

    const result = await entry.client.callTool({ name: toolName, arguments: args || {} });
    return result;
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  getStatus(serverId) {
    const entry = this._connections.get(serverId);
    return entry?.status || "disconnected";
  }

  getAllStatuses() {
    const statuses = {};
    for (const [serverId, entry] of this._connections.entries()) {
      statuses[serverId] = entry.status;
    }
    return statuses;
  }
}

module.exports = McpManager;

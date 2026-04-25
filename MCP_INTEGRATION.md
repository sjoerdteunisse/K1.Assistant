# MCP Server Integration Plan

## Overview

The codebase already has a well-structured tool registry pattern (`ToolRegistry` + `createToolRegistry` → `streamAgentResponse`). MCP servers expose tools via the same JSON-RPC abstraction. The integration point is clean: adapt MCP tools into `ToolDefinition` objects and inject them into the existing registry at stream time.

**Package**: `@modelcontextprotocol/sdk` (official TypeScript SDK — supports stdio, SSE, and streamable HTTP transports)

---

## Architecture

```
Renderer (React)                    Main Process (Node/Electron)
─────────────────────────────────   ─────────────────────────────────
useMcpServers.ts                    mcpManager.js
  ├─ server CRUD                  ←→  ├─ spawn/connect MCP servers
  └─ per-chat enablement              ├─ cache tool lists per server
                                      └─ route tool calls → server
McpServersSettings.tsx
  └─ add/edit/delete servers      ←→  ipcHandlers.js (new MCP handlers)

McpServerSelector.tsx (chat bar)    database.js
  └─ toggle servers per chat      ←→  ├─ mcp_servers table
                                      └─ conversation_mcp_servers table
mcpToolAdapter.ts
  └─ ToolDefinition[] from MCP    ←→  preload.js (new MCP channels)
     tools injected into registry
```

---

## Phase 1 — Backend (Main Process)

### 1a. Install the SDK

```bash
npm install @modelcontextprotocol/sdk
```

### 1b. `src/helpers/mcpManager.js` (new file)

Manages the lifecycle of all configured MCP server connections:

- Stores a map of `serverId → Client` (MCP SDK `Client` instance)
- `connect(serverConfig)` — spawns/connects server via `StdioClientTransport` (command+args), `SSEClientTransport` (url), or `StreamableHTTPClientTransport`
- `disconnect(serverId)` — closes the connection
- `listTools(serverId)` → `Tool[]` — fetches and caches the tool list
- `callTool(serverId, toolName, args)` → result — executes a tool call
- `getAllEnabledTools(serverIds)` → `{ serverId, tool }[]` — for building the registry
- Emits `server-status-changed` events → forwarded via IPC to renderer

### 1c. `src/helpers/database.js` — 2 new tables

```sql
CREATE TABLE IF NOT EXISTS mcp_servers (
  id          TEXT PRIMARY KEY,   -- uuid
  name        TEXT NOT NULL,
  description TEXT,
  transport   TEXT NOT NULL,      -- "stdio" | "sse" | "http"
  command     TEXT,               -- e.g. "npx" (stdio only)
  args        TEXT,               -- JSON array, e.g. ["-y","@modelcontextprotocol/server-filesystem","/tmp"]
  url         TEXT,               -- SSE/HTTP only
  headers     TEXT,               -- JSON object (auth headers)
  env_vars    TEXT,               -- JSON object (extra env for child process)
  enabled     INTEGER DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_mcp_servers (
  conversation_id TEXT NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  server_id       TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, server_id)
);
```

### 1d. `src/helpers/ipcHandlers.js` — new MCP handler group

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `mcp-list-servers` | invoke | Get all configured servers + live status |
| `mcp-add-server` | invoke | Insert into DB + attempt connect if enabled |
| `mcp-update-server` | invoke | Update DB row + reconnect if needed |
| `mcp-delete-server` | invoke | Disconnect + delete from DB |
| `mcp-toggle-server` | invoke | Enable/disable + connect/disconnect |
| `mcp-list-tools` | invoke | List tools for one or more server IDs |
| `mcp-call-tool` | invoke | Execute a tool call (from main process) |
| `mcp-server-status-changed` | event → renderer | Push live status updates |
| `mcp-get-conversation-servers` | invoke | Get enabled server IDs for a conversation |
| `mcp-set-conversation-servers` | invoke | Set enabled server IDs for a conversation |

### 1e. `preload.js` — expose new channels

Add `mcpAPI` namespace (or extend `electronAPI`) exposing all channels above.

### 1f. `main.js`

Initialize `McpManager`, pass to `IpcHandlers`. On `will-quit`, call `mcpManager.disconnectAll()`.

---

## Phase 2 — Tool Adapter

### 2a. `src/services/tools/mcpToolAdapter.ts` (new file)

Converts MCP `Tool` schema into the app's `ToolDefinition`:

```ts
// MCP tool has: name, description, inputSchema (JSON Schema)
// ToolDefinition has: name, description, parameters (Zod schema), execute(args) → result

export function adaptMcpTools(
  mcpTools: Array<{ serverId: string; serverName: string; tool: McpTool }>,
): ToolDefinition[] {
  return mcpTools.map(({ serverId, serverName, tool }) => ({
    name: `mcp_${serverId}_${tool.name}`,  // namespace to avoid collisions
    displayName: tool.name,
    description: `[${serverName}] ${tool.description}`,
    parameters: jsonSchemaToZod(tool.inputSchema),
    execute: async (args) => {
      const result = await window.electronAPI.mcpCallTool(serverId, tool.name, args);
      return { text: JSON.stringify(result.content) };
    },
  }));
}
```

Uses [`json-schema-to-zod`](https://www.npmjs.com/package/json-schema-to-zod) (or a lightweight inline converter) for the parameter schema.

### 2b. `src/services/tools/index.ts` — extend `createToolRegistry`

```ts
export async function createToolRegistry(settings, activeMcpServerIds: string[] = []) {
  const registry = new ToolRegistry();
  // ... existing tools ...

  if (activeMcpServerIds.length > 0) {
    const mcpTools = await window.electronAPI.mcpListTools(activeMcpServerIds);
    const adapted = adaptMcpTools(mcpTools);
    adapted.forEach(t => registry.register(t));
  }
  return registry;
}
```

---

## Phase 3 — React Layer

### 3a. `src/hooks/useMcpServers.ts` (new hook)

```ts
interface UseMcpServers {
  servers: McpServer[];
  serverStatuses: Record<string, "connected" | "connecting" | "error" | "disconnected">;
  addServer(config: McpServerConfig): Promise<void>;
  updateServer(id: string, patch: Partial<McpServerConfig>): Promise<void>;
  deleteServer(id: string): Promise<void>;
  toggleServer(id: string, enabled: boolean): Promise<void>;
  getConversationServers(convId: string): string[];
  setConversationServers(convId: string, ids: string[]): Promise<void>;
}
```

Listens to `mcp-server-status-changed` IPC events to keep `serverStatuses` up to date in real time.

### 3b. `src/components/chat/useChatStreaming.ts` — pass MCP servers

When calling `streamAgentResponse`, also pass `activeMcpServerIds` for the current conversation. `createToolRegistry` uses them to inject MCP tools.

### 3c. `src/components/chat/McpServerSelector.tsx` (new component)

Small button in the `ChatInput` toolbar (next to the existing send/stop controls):

- Icon: plug/circuit icon
- Popover listing all configured + connected MCP servers
- Toggle checkboxes — persisted per conversation via `mcp-set-conversation-servers`
- Badge showing the count of active MCP servers for the current chat
- "Manage Servers →" link to open the MCP settings page

### 3d. `src/components/settings/McpServersSettings.tsx` (new component)

Full CRUD settings page with three sections:

**1. Connected / Configured Servers list**
Cards showing: name, transport, live status indicator (green/red dot), tool count, enable toggle, edit/delete buttons.

**2. Add / Edit Server form** with transport type selector:
- **stdio**: command + args (parsed as shell args), optional env vars key/value pairs
- **SSE / HTTP**: URL + optional auth headers key/value pairs

**3. Curated Server Marketplace**
Static list of popular MCP servers with a one-click "Install" button that prefills the add form:

| Server | Description |
|--------|-------------|
| `@modelcontextprotocol/server-filesystem` | Local file read/write |
| `@modelcontextprotocol/server-github` | GitHub API — repos, PRs, issues |
| `@modelcontextprotocol/server-brave-search` | Web search via Brave API |
| `@modelcontextprotocol/server-fetch` | HTTP fetch for any URL |
| `@modelcontextprotocol/server-memory` | Persistent key-value memory |
| `@modelcontextprotocol/server-postgres` | PostgreSQL query execution |

### 3e. `src/components/ControlPanelSidebar.tsx` — add "MCP Servers" nav item

New sidebar entry (between Settings and Developer section) with a plug icon and a badge showing the count of currently connected servers.

---

## Phase 4 — Per-Chat UX Flow

```
User opens existing / new chat
  └─ useMcpServers loads server configs
  └─ McpServerSelector shows in ChatInput toolbar

       └─ User toggles "filesystem" server ON for this chat
       └─ persisted via mcp-set-conversation-servers IPC

User sends message
  └─ useChatStreaming calls createToolRegistry(settings, ["filesystem-server-id"])
  └─ mcpToolAdapter fetches tool list from main process
  └─ tools injected into Vercel AI SDK streamText call
  └─ model decides to call mcp_filesystem-server-id_read_file(...)
  └─ adapter routes → mcp-call-tool IPC → mcpManager → MCP server → result
  └─ result returned as tool_result chunk → displayed in ChatMessage
```

---

## Phase 5 — i18n

Add translation keys to all 9 language files (`src/locales/*/translation.json`) for all new UI strings:

- `settings.mcp.title` — page title
- `settings.mcp.addServer` — add button
- `settings.mcp.transport.*` — transport type labels
- `settings.mcp.marketplace.title` — marketplace section heading
- `chat.mcp.selector.title` — popover heading
- `chat.mcp.selector.manage` — "Manage Servers" link
- `chat.mcp.selector.noServers` — empty state
- `mcp.status.connected` / `.connecting` / `.error` / `.disconnected`

---

## File Summary

| Action | File |
|--------|------|
| **Create** | `src/helpers/mcpManager.js` |
| **Create** | `src/services/tools/mcpToolAdapter.ts` |
| **Create** | `src/hooks/useMcpServers.ts` |
| **Create** | `src/components/settings/McpServersSettings.tsx` |
| **Create** | `src/components/chat/McpServerSelector.tsx` |
| **Modify** | `src/helpers/database.js` — 2 new tables |
| **Modify** | `src/helpers/ipcHandlers.js` — MCP handler group |
| **Modify** | `preload.js` — expose MCP channels |
| **Modify** | `main.js` — init McpManager |
| **Modify** | `src/services/tools/index.ts` — inject MCP tools |
| **Modify** | `src/components/chat/useChatStreaming.ts` — pass server IDs |
| **Modify** | `src/components/chat/ChatInput.tsx` — add selector button |
| **Modify** | `src/components/ControlPanelSidebar.tsx` — nav entry |
| **Modify** | `src/locales/*/translation.json` (×9) — i18n strings |

---

## Implementation Order

1. **Phase 1** — `mcpManager.js` + DB tables + IPC handlers + preload (foundation, no UI needed)
2. **Phase 2** — `mcpToolAdapter.ts` + extend `createToolRegistry` (wires MCP tools into AI)
3. **Phase 3a/b** — `useMcpServers.ts` + `useChatStreaming.ts` changes (React state)
4. **Phase 3c** — `McpServerSelector.tsx` in chat toolbar (per-chat toggle UX)
5. **Phase 3d/e** — `McpServersSettings.tsx` + sidebar nav entry (full management UI)
6. **Phase 5** — i18n strings across all language files

import type { ToolDefinition, ToolResult } from "./ToolRegistry";

export interface McpToolEntry {
  serverId: string;
  serverName: string;
  tool: {
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  };
}

/** Sanitize a raw MCP tool name into a valid identifier for the AI SDK (alphanum + underscore). */
function sanitizeName(serverId: string, toolName: string): string {
  const clean = `mcp_${serverId}_${toolName}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);
  return clean;
}

export function adaptMcpTools(mcpTools: McpToolEntry[]): ToolDefinition[] {
  return mcpTools.map((entry) => {
    const { serverId, serverName, tool } = entry;
    const toolId = sanitizeName(serverId, tool.name);

    return {
      name: toolId,
      description: `[${serverName}] ${tool.description || tool.name}`,
      parameters: tool.inputSchema,
      readOnly: false,
      execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
        console.log(`[MCP] ► call  server="${serverName}" tool="${tool.name}" args=`, JSON.stringify(args, null, 2));
        try {
          const result = await (window as any).electronAPI.mcpCallTool(serverId, tool.name, args);
          console.log(`[MCP] ◄ result server="${serverName}" tool="${tool.name}" isError=${result?.isError}`, JSON.stringify(result, null, 2));
          if (result?.isError) {
            const message = result.content
              ?.filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join("\n");
            console.warn(`[MCP] ✗ error  server="${serverName}" tool="${tool.name}": ${message}`);
            return { success: false, data: null, displayText: message || "MCP tool error" };
          }
          const text = result?.content
            ?.filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("\n");
          return {
            success: true,
            data: result?.content ?? result,
            displayText: text || JSON.stringify(result),
          };
        } catch (error) {
          console.error(`[MCP] ✗ exception server="${serverName}" tool="${tool.name}":`, error);
          return {
            success: false,
            data: null,
            displayText: (error as Error).message || "MCP tool execution failed",
          };
        }
      },
    };
  });
}

import { ToolRegistry } from "./ToolRegistry";
import { createSearchNotesTool } from "./searchNotesTool";
import { getNoteTool } from "./getNoteTool";
import { createNoteTool } from "./createNoteTool";
import { updateNoteTool } from "./updateNoteTool";
import { clipboardTool } from "./clipboardTool";
import { webSearchTool } from "./webSearchTool";
import { calendarTool } from "./calendarTool";
import { adaptMcpTools } from "./mcpToolAdapter";

export { ToolRegistry } from "./ToolRegistry";
export type { ToolDefinition, ToolResult } from "./ToolRegistry";

interface ToolRegistrySettings {
  isSignedIn: boolean;
  gcalConnected: boolean;
  cloudBackupEnabled: boolean;
}

export async function createToolRegistry(
  settings: ToolRegistrySettings,
  activeMcpServerIds: string[] = []
): Promise<ToolRegistry> {
  const registry = new ToolRegistry();

  const useCloudSearch = settings.isSignedIn && settings.cloudBackupEnabled;
  registry.register(createSearchNotesTool({ useCloudSearch }));
  registry.register(getNoteTool);
  registry.register(createNoteTool);
  registry.register(updateNoteTool);
  registry.register(clipboardTool);

  if (settings.isSignedIn) {
    registry.register(webSearchTool);
  }

  if (settings.gcalConnected) {
    registry.register(calendarTool);
  }

  if (activeMcpServerIds.length > 0) {
    try {
      const mcpTools = await (window as any).electronAPI.mcpListTools(activeMcpServerIds);
      for (const tool of adaptMcpTools(mcpTools)) {
        registry.register(tool);
      }
    } catch {
      // MCP tools are best-effort; silently skip on error
    }
  }

  return registry;
}


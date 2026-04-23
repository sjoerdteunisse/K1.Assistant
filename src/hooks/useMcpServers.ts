import { useState, useEffect, useCallback, useRef } from "react";

export interface McpServer {
  id: string;
  name: string;
  description?: string;
  transport: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env_vars?: Record<string, string>;
  enabled: boolean;
  created_at?: string;
  status?: string;
}

export type McpServerStatus = "connecting" | "connected" | "disconnected" | "error" | "disabled";

export interface UseMcpServersReturn {
  servers: McpServer[];
  serverStatuses: Record<string, McpServerStatus>;
  loading: boolean;
  addServer: (config: Omit<McpServer, "id" | "created_at" | "status">) => Promise<{ success: boolean; server?: McpServer; error?: string }>;
  updateServer: (id: string, patch: Partial<McpServer>) => Promise<{ success: boolean; error?: string }>;
  deleteServer: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleServer: (id: string, enabled: boolean) => Promise<void>;
  getConversationServers: (conversationId: number) => Promise<string[]>;
  setConversationServers: (conversationId: number, serverIds: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMcpServers(): UseMcpServersReturn {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Record<string, McpServerStatus>>({});
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await (window as any).electronAPI.mcpListServers();
      setServers(list ?? []);
      const statuses: Record<string, McpServerStatus> = {};
      for (const s of list ?? []) {
        statuses[s.id] = s.status ?? "disconnected";
      }
      setServerStatuses(statuses);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Subscribe to live status updates
    const api = (window as any).electronAPI;
    if (api?.onMcpServerStatusChanged) {
      unsubRef.current = api.onMcpServerStatusChanged(
        (data: { serverId: string; status: McpServerStatus }) => {
          setServerStatuses((prev) => ({ ...prev, [data.serverId]: data.status }));
        }
      );
    }
    return () => {
      if (typeof unsubRef.current === "function") unsubRef.current();
    };
  }, [refresh]);

  const addServer = useCallback(
    async (config: Omit<McpServer, "id" | "created_at" | "status">) => {
      const result = await (window as any).electronAPI.mcpAddServer(config);
      if (result?.success) await refresh();
      return result ?? { success: false, error: "Unknown error" };
    },
    [refresh]
  );

  const updateServer = useCallback(
    async (id: string, patch: Partial<McpServer>) => {
      const result = await (window as any).electronAPI.mcpUpdateServer(id, patch);
      if (result?.success) await refresh();
      return result ?? { success: false, error: "Unknown error" };
    },
    [refresh]
  );

  const deleteServer = useCallback(
    async (id: string) => {
      const result = await (window as any).electronAPI.mcpDeleteServer(id);
      if (result?.success) await refresh();
      return result ?? { success: false, error: "Unknown error" };
    },
    [refresh]
  );

  const toggleServer = useCallback(
    async (id: string, enabled: boolean) => {
      await (window as any).electronAPI.mcpToggleServer(id, enabled);
      await refresh();
    },
    [refresh]
  );

  const getConversationServers = useCallback(async (conversationId: number): Promise<string[]> => {
    return (await (window as any).electronAPI.mcpGetConversationServers(conversationId)) ?? [];
  }, []);

  const setConversationServers = useCallback(
    async (conversationId: number, serverIds: string[]) => {
      await (window as any).electronAPI.mcpSetConversationServers(conversationId, serverIds);
    },
    []
  );

  return {
    servers,
    serverStatuses,
    loading,
    addServer,
    updateServer,
    deleteServer,
    toggleServer,
    getConversationServers,
    setConversationServers,
    refresh,
  };
}

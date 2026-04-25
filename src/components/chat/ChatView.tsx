import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useChatPersistence } from "./useChatPersistence";
import { useChatStreaming } from "./useChatStreaming";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { McpServerSelector } from "./McpServerSelector";
import { ChatEmptyIllustration } from "./ChatEmptyIllustration";
import ConversationList from "./ConversationList";
import EmptyChatState from "./EmptyChatState";
import { ConfirmDialog } from "../ui/dialog";
import { useDialogs } from "../../hooks/useDialogs";
import { useMcpServers } from "../../hooks/useMcpServers";
import { getCachedPlatform } from "../../utils/platform";

const CommandSearch = lazy(() => import("../CommandSearch"));

const platform = getCachedPlatform();

function NewChatEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full -mt-6 select-none">
      <ChatEmptyIllustration />
      <p className="text-xs text-foreground/50 dark:text-foreground/25 text-center max-w-48 mt-4">
        {t("chat.newChatEmpty")}
      </p>
    </div>
  );
}

export default function ChatView({
  onNavigateToMcpSettings,
}: {
  onNavigateToMcpSettings?: () => void;
} = {}) {
  const { t } = useTranslation();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [isNewChat, setIsNewChat] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const { confirmDialog, showConfirmDialog, hideConfirmDialog } = useDialogs();
  const { servers, serverStatuses, getConversationServers, setConversationServers } =
    useMcpServers();
  // Start with all enabled servers active so tools work without manual toggling
  const [activeMcpServerIds, setActiveMcpServerIds] = useState<string[]>(() =>
    servers.filter((s) => s.enabled).map((s) => s.id)
  );

  const persistence = useChatPersistence({
    conversationId: activeConversationId,
    onConversationCreated: (id) => {
      setActiveConversationId(id);
      setRefreshKey((k) => k + 1);
    },
  });

  const streaming = useChatStreaming({
    messages: persistence.messages,
    setMessages: persistence.setMessages,
    activeMcpServerIds,
    onStreamComplete: (_id, content, toolCalls) => {
      persistence.saveAssistantMessage(content, toolCalls);
    },
  });

  const handleSelectConversation = useCallback(
    async (id: number) => {
      if (id === activeConversationId) return;
      setActiveConversationId(id);
      setIsNewChat(false);
      const mcpIds = await getConversationServers(id);
      setActiveMcpServerIds(mcpIds);
      await persistence.loadConversation(id);
    },
    [activeConversationId, persistence, getConversationServers]
  );

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setIsNewChat(true);
    // Auto-enable all enabled MCP servers for new chats so tools work without manual toggling
    setActiveMcpServerIds(servers.filter((s) => s.enabled).map((s) => s.id));
    persistence.handleNewChat();
  }, [persistence, servers]);

  const handleTextSubmit = useCallback(
    async (text: string, imageDataUrl?: string) => {
      setIsNewChat(false);
      let convId = activeConversationId;
      if (!convId) {
        const title = text.length > 50 ? `${text.slice(0, 50)}...` : text;
        convId = await persistence.createConversation(title);
      }

      const userMsg = {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: text,
        isStreaming: false,
        imageDataUrl,
      };
      persistence.setMessages((prev) => [...prev, userMsg]);
      await persistence.saveUserMessage(text);

      if (activeMcpServerIds.length > 0 && convId) {
        setConversationServers(convId, activeMcpServerIds).catch(() => {});
      }

      const allMessages = [...persistence.messages, userMsg];
      await streaming.sendToAI(text, allMessages, imageDataUrl);
    },
    [activeConversationId, persistence, streaming, activeMcpServerIds, setConversationServers]
  );

  const handleMcpToggle = useCallback((serverId: string) => {
    setActiveMcpServerIds((prev) =>
      prev.includes(serverId) ? prev.filter((id) => id !== serverId) : [...prev, serverId]
    );
  }, []);

  const handleArchive = useCallback(
    async (id: number) => {
      await window.electronAPI?.archiveAgentConversation?.(id);
      if (activeConversationId === id) {
        handleNewChat();
      }
      setRefreshKey((k) => k + 1);
    },
    [activeConversationId, handleNewChat]
  );

  const handleDelete = useCallback(
    (id: number) => {
      showConfirmDialog({
        title: t("chat.delete"),
        description: t("chat.deleteConfirm"),
        onConfirm: async () => {
          await window.electronAPI?.deleteAgentConversation?.(id);
          if (activeConversationId === id) {
            handleNewChat();
          }
          setRefreshKey((k) => k + 1);
        },
        variant: "destructive",
      });
    },
    [activeConversationId, handleNewChat, showConfirmDialog, t]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = platform === "darwin" ? e.metaKey : e.ctrlKey;
      if (mod && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewChat]);

  // When viewing a new chat, keep activeMcpServerIds synced with servers that become enabled
  useEffect(() => {
    if (isNewChat && activeConversationId === null) {
      setActiveMcpServerIds(servers.filter((s) => s.enabled).map((s) => s.id));
    }
  }, [servers, isNewChat, activeConversationId]);

  const hasActiveChat =
    activeConversationId !== null || persistence.messages.length > 0 || isNewChat;

  return (
    <>
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={hideConfirmDialog}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />
      {showSearch && (
        <Suspense fallback={null}>
          <CommandSearch
            open={showSearch}
            onOpenChange={setShowSearch}
            mode="conversations"
            onConversationSelect={handleSelectConversation}
          />
        </Suspense>
      )}
      <div className="flex h-full">
        <div className="w-56 min-w-50 shrink-0 border-r border-border/15 dark:border-white/6">
          <ConversationList
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
            onOpenSearch={() => setShowSearch(true)}
            onArchive={handleArchive}
            onDelete={handleDelete}
            refreshKey={refreshKey}
          />
        </div>
        <div className="flex-1 min-w-80 flex flex-col">
          {hasActiveChat ? (
            <>
              <ChatMessages messages={persistence.messages} emptyState={<NewChatEmptyState />} />
              <ChatInput
                agentState={streaming.agentState}
                partialTranscript=""
                onTextSubmit={handleTextSubmit}
                onCancel={streaming.cancelStream}
                autoFocus={isNewChat}
                actionSlot={
                  <McpServerSelector
                    servers={servers}
                    serverStatuses={serverStatuses}
                    activeMcpServerIds={activeMcpServerIds}
                    onToggle={handleMcpToggle}
                    onManage={() => onNavigateToMcpSettings?.()}
                  />
                }
              />
            </>
          ) : (
            <EmptyChatState />
          )}
        </div>
      </div>
    </>
  );
}

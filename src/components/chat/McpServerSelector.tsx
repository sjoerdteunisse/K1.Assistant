import { useTranslation } from "react-i18next";
import { Plug, Circle } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { cn } from "../lib/utils";
import type { McpServer, McpServerStatus } from "../../hooks/useMcpServers";

interface McpServerSelectorProps {
  servers: McpServer[];
  serverStatuses: Record<string, McpServerStatus>;
  activeMcpServerIds: string[];
  onToggle: (serverId: string) => void;
  onManage: () => void;
}

function StatusDot({ status }: { status: McpServerStatus }) {
  return (
    <Circle
      size={6}
      className={cn(
        "shrink-0 fill-current",
        status === "connected" && "text-green-500",
        status === "connecting" && "text-yellow-500",
        status === "error" && "text-red-500",
        (status === "disconnected" || status === "disabled") && "text-muted-foreground/40"
      )}
    />
  );
}

export function McpServerSelector({
  servers,
  serverStatuses,
  activeMcpServerIds,
  onToggle,
  onManage,
}: McpServerSelectorProps) {
  const { t } = useTranslation();
  const enabledServers = servers.filter((s) => s.enabled);
  const activeCount = activeMcpServerIds.length;

  if (enabledServers.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative flex items-center justify-center p-1.5 rounded-sm shrink-0",
            "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/8",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/30",
            "transition-colors duration-100",
            activeCount > 0 && "text-primary/80 hover:text-primary"
          )}
          title={t("mcp.selector.tooltip")}
        >
          <Plug size={13} />
          {activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 text-[8px] font-semibold rounded-full bg-primary text-primary-foreground leading-none">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-56 p-1.5">
        <p className="text-[11px] font-medium text-muted-foreground px-2 py-1 select-none">
          {t("mcp.selector.title")}
        </p>
        <div className="mt-0.5 space-y-0.5">
          {enabledServers.map((server) => {
            const isActive = activeMcpServerIds.includes(server.id);
            const status = serverStatuses[server.id] ?? "disconnected";
            return (
              <button
                key={server.id}
                onClick={() => onToggle(server.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-left",
                  "hover:bg-foreground/8 transition-colors duration-100",
                  isActive && "bg-primary/10"
                )}
              >
                <StatusDot status={status} />
                <span
                  className={cn(
                    "text-[12px] flex-1 truncate",
                    isActive ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {server.name}
                </span>
                <div
                  className={cn(
                    "w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center",
                    isActive
                      ? "bg-primary border-primary"
                      : "border-border/60"
                  )}
                >
                  {isActive && (
                    <svg viewBox="0 0 10 8" className="w-2 h-2 text-primary-foreground fill-current">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border/30 mt-1.5 pt-1.5">
          <button
            onClick={onManage}
            className="w-full flex items-center px-2 py-1.5 rounded-sm text-[11px] text-muted-foreground hover:text-foreground hover:bg-foreground/8 transition-colors"
          >
            {t("mcp.selector.manage")} →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

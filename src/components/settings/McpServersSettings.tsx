import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, Trash2, RefreshCw, Plug, ChevronDown, ChevronUp,
  Globe, Link2, HardDrive, Database, GitBranch, Search, Check, Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { useMcpServers } from "../../hooks/useMcpServers";
import type { McpServer, McpServerStatus } from "../../hooks/useMcpServers";

// ─── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: McpServerStatus }) {
  const { t } = useTranslation();
  const map: Record<McpServerStatus, { label: string; cls: string }> = {
    connected: { label: t("mcp.status.connected"), cls: "bg-green-500/15 text-green-600 dark:text-green-400" },
    connecting: { label: t("mcp.status.connecting"), cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" },
    error: { label: t("mcp.status.error"), cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
    disconnected: { label: t("mcp.status.disconnected"), cls: "bg-muted/60 text-muted-foreground" },
    disabled: { label: t("mcp.status.disabled"), cls: "bg-muted/40 text-muted-foreground/60" },
  };
  const { label, cls } = map[status] ?? map.disconnected;
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", cls)}>
      {label}
    </span>
  );
}

// ─── Server form ───────────────────────────────────────────────────────────

interface ServerFormValues {
  name: string;
  description: string;
  transport: "stdio" | "sse" | "http";
  command: string;
  args: string; // space-separated
  url: string;
}

const EMPTY_FORM: ServerFormValues = {
  name: "",
  description: "",
  transport: "stdio",
  command: "",
  args: "",
  url: "",
};

// ─── Server catalog ────────────────────────────────────────────────────────

interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  command: string;
  args: string[];
  envNote?: string;
  featured?: boolean;
}

const CATALOG: CatalogEntry[] = [
  {
    id: "playwright",
    name: "Playwright",
    description: "Control a real browser — navigate, click, fill forms, take screenshots",
    icon: Globe,
    iconColor: "text-blue-500",
    command: "npx",
    args: ["@playwright/mcp@latest"],
    featured: true,
  },
  {
    id: "fetch",
    name: "Fetch",
    description: "Fetch and read web pages and REST APIs",
    icon: Link2,
    iconColor: "text-teal-500",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
  },
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Read and write local files and directories",
    icon: HardDrive,
    iconColor: "text-amber-500",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    envNote: "Edit args to add an allowed directory path",
  },
  {
    id: "memory",
    name: "Memory",
    description: "Persistent knowledge store across sessions",
    icon: Database,
    iconColor: "text-purple-500",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
  },
  {
    id: "github",
    name: "GitHub",
    description: "Search repos, read code, manage issues and pull requests",
    icon: GitBranch,
    iconColor: "text-foreground/80",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    envNote: "GITHUB_TOKEN env var required",
  },
  {
    id: "brave-search",
    name: "Brave Search",
    description: "Search the web via Brave's independent search index",
    icon: Search,
    iconColor: "text-orange-500",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    envNote: "BRAVE_API_KEY env var required",
  },
];

function CatalogCard({
  entry,
  servers,
  onAdd,
}: {
  entry: CatalogEntry;
  servers: McpServer[];
  onAdd: (entry: CatalogEntry) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const alreadyAdded = servers.some(
    (s) => s.name.toLowerCase() === entry.name.toLowerCase()
  );
  const Icon = entry.icon;

  const handleAdd = async () => {
    if (alreadyAdded || adding) return;
    setAdding(true);
    try {
      await onAdd(entry);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 p-2.5 rounded-lg border transition-colors",
        entry.featured
          ? "border-primary/30 bg-primary/5"
          : "border-border/40 bg-surface-1/40"
      )}
    >
      {entry.featured && (
        <span className="absolute -top-2 left-2.5 text-[8px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-semibold uppercase tracking-wide leading-none">
          {t("mcp.catalog.recommended")}
        </span>
      )}
      <div className="flex items-start gap-2 pt-0.5">
        <div className={cn("p-1.5 rounded-md bg-foreground/5 shrink-0", entry.iconColor)}>
          <Icon size={12} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-foreground leading-tight">{entry.name}</p>
          <p className="text-[10px] text-muted-foreground/65 leading-snug mt-0.5 line-clamp-2">
            {entry.description}
          </p>
        </div>
      </div>
      {entry.envNote && (
        <p className="text-[9px] text-amber-600/70 dark:text-amber-400/60 leading-tight">
          ⚠ {entry.envNote}
        </p>
      )}
      <button
        onClick={handleAdd}
        disabled={alreadyAdded || adding}
        className={cn(
          "self-end flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors",
          alreadyAdded
            ? "text-green-600 dark:text-green-400 bg-green-500/10 cursor-default"
            : adding
              ? "text-muted-foreground/60 cursor-wait"
              : "text-primary bg-primary/10 hover:bg-primary/15 active:bg-primary/20"
        )}
      >
        {alreadyAdded ? (
          <><Check size={9} />{t("mcp.catalog.added")}</>
        ) : adding ? (
          t("mcp.catalog.adding")
        ) : (
          <><Plus size={9} />{t("mcp.catalog.add")}</>
        )}
      </button>
    </div>
  );
}

function FeaturedServers({
  servers,
  onAdd,
}: {
  servers: McpServer[];
  onAdd: (entry: CatalogEntry) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-foreground/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Store size={12} className="text-primary/70" />
          <span className="text-[12px] font-medium text-foreground">
            {t("mcp.catalog.title")}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/80 font-medium leading-none">
            {CATALOG.length}
          </span>
        </div>
        {open ? (
          <ChevronUp size={13} className="text-muted-foreground/50" />
        ) : (
          <ChevronDown size={13} className="text-muted-foreground/50" />
        )}
      </button>
      {open && (
        <div className="border-t border-border/30 px-3 pt-3 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {CATALOG.map((entry) => (
              <CatalogCard
                key={entry.id}
                entry={entry}
                servers={servers}
                onAdd={onAdd}
              />
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground/40 mt-2.5 text-center leading-snug">
            {t("mcp.catalog.hint")}
          </p>
        </div>
      )}
    </div>
  );
}

function ServerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ServerFormValues;
  onSave: (values: ServerFormValues) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ServerFormValues>(initial ?? EMPTY_FORM);

  const set = (key: keyof ServerFormValues, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const valid =
    values.name.trim().length > 0 &&
    (values.transport === "stdio" ? values.command.trim().length > 0 : values.url.trim().length > 0);

  return (
    <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-surface-1/60">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">{t("mcp.form.name")}</label>
          <input
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t("mcp.form.namePlaceholder")}
            className="w-full text-[12px] bg-background border border-border/50 rounded-md px-2.5 py-1.5 outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        <div className="col-span-2 space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">{t("mcp.form.description")}</label>
          <input
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={t("mcp.form.descriptionPlaceholder")}
            className="w-full text-[12px] bg-background border border-border/50 rounded-md px-2.5 py-1.5 outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">{t("mcp.form.transport")}</label>
          <select
            value={values.transport}
            onChange={(e) => set("transport", e.target.value as "stdio" | "sse" | "http")}
            className="w-full text-[12px] bg-background border border-border/50 rounded-md px-2.5 py-1.5 outline-none focus:border-primary/50 transition-colors"
          >
            <option value="stdio">stdio</option>
            <option value="sse">SSE (HTTP)</option>
            <option value="http">HTTP (Streamable)</option>
          </select>
        </div>

        {values.transport === "stdio" ? (
          <>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">{t("mcp.form.command")}</label>
              <input
                value={values.command}
                onChange={(e) => set("command", e.target.value)}
                placeholder="npx, uvx, node…"
                className="w-full text-[12px] bg-background border border-border/50 rounded-md px-2.5 py-1.5 outline-none focus:border-primary/50 transition-colors font-mono"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium">{t("mcp.form.args")}</label>
              <input
                value={values.args}
                onChange={(e) => set("args", e.target.value)}
                placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
                className="w-full text-[12px] bg-background border border-border/50 rounded-md px-2.5 py-1.5 outline-none focus:border-primary/50 transition-colors font-mono"
              />
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground font-medium">{t("mcp.form.url")}</label>
            <input
              value={values.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="http://localhost:3000/mcp"
              className="w-full text-[12px] bg-background border border-border/50 rounded-md px-2.5 py-1.5 outline-none focus:border-primary/50 transition-colors font-mono"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="text-[11px] px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/8 transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={() => valid && onSave(values)}
          disabled={!valid}
          className={cn(
            "text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors",
            valid
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground/50 cursor-not-allowed"
          )}
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}

// ─── Server card ───────────────────────────────────────────────────────────

function ServerCard({
  server,
  status,
  onToggle,
  onDelete,
  onEdit,
}: {
  server: McpServer;
  status: McpServerStatus;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (values: ServerFormValues) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border/40 bg-surface-1/50 overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Plug size={13} className={cn("shrink-0", server.enabled ? "text-primary/70" : "text-muted-foreground/30")} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-foreground truncate">{server.name}</p>
          {server.description && (
            <p className="text-[11px] text-muted-foreground/70 truncate">{server.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={status} />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded-sm text-muted-foreground/60 hover:text-foreground hover:bg-foreground/8 transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/30 px-3 pt-2.5 pb-3 space-y-3">
          <ServerForm
            initial={{
              name: server.name,
              description: server.description ?? "",
              transport: server.transport,
              command: server.command ?? "",
              args: (server.args ?? []).join(" "),
              url: server.url ?? "",
            }}
            onSave={onEdit}
            onCancel={() => setExpanded(false)}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className={cn(
                "flex-1 text-[11px] px-3 py-1.5 rounded-md font-medium border transition-colors",
                server.enabled
                  ? "border-border/50 text-muted-foreground hover:bg-foreground/5"
                  : "border-primary/40 text-primary bg-primary/8 hover:bg-primary/12"
              )}
            >
              {server.enabled ? t("mcp.server.disable") : t("mcp.server.enable")}
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-md text-red-500/70 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
              title={t("mcp.server.delete")}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function McpServersSettings() {
  const { t } = useTranslation();
  const { servers, serverStatuses, loading, addServer, updateServer, deleteServer, toggleServer, refresh } =
    useMcpServers();
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = useCallback(
    async (values: ServerFormValues) => {
      await addServer({
        name: values.name,
        description: values.description || undefined,
        transport: values.transport,
        command: values.command || undefined,
        args: values.args ? values.args.trim().split(/\s+/) : [],
        url: values.url || undefined,
        enabled: true,
      });
      setShowAddForm(false);
    },
    [addServer]
  );

  const handleEdit = useCallback(
    async (id: string, values: ServerFormValues) => {
      await updateServer(id, {
        name: values.name,
        description: values.description || undefined,
        transport: values.transport,
        command: values.command || undefined,
        args: values.args ? values.args.trim().split(/\s+/) : [],
        url: values.url || undefined,
      });
    },
    [updateServer]
  );

  const handleCatalogAdd = useCallback(
    async (entry: CatalogEntry) => {
      await addServer({
        name: entry.name,
        description: entry.description,
        transport: "stdio",
        command: entry.command,
        args: entry.args,
        enabled: true,
      });
    },
    [addServer]
  );

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("mcp.settings.title")}</h2>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">{t("mcp.settings.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-foreground/8 transition-colors"
              title={t("mcp.settings.refresh")}
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/15 font-medium transition-colors"
            >
              <Plus size={13} />
              {t("mcp.settings.addServer")}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 pb-5 space-y-3">
        <FeaturedServers servers={servers} onAdd={handleCatalogAdd} />

        {showAddForm && (
          <ServerForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} />
        )}

        {loading ? (
          <p className="text-[12px] text-muted-foreground/60 py-2 text-center">
            {t("mcp.settings.loading")}
          </p>
        ) : servers.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground/50 font-medium px-0.5">
              {t("mcp.settings.installed")} ({servers.length})
            </p>
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                status={serverStatuses[server.id] ?? (server.enabled ? "disconnected" : "disabled")}
                onToggle={() => toggleServer(server.id, !server.enabled)}
                onDelete={() => deleteServer(server.id)}
                onEdit={(values) => handleEdit(server.id, values)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { cn } from "../lib/utils";
import type { TaskStatus, TaskPriority } from "../../extensions/TaskItemExtended";
import { PRIORITY_EMOJI } from "../../extensions/TaskItemExtended";

const STATUS_CYCLE: TaskStatus[] = ["open", "in-progress", "done"];
const PRIORITY_CYCLE: TaskPriority[] = ["none", "low", "medium", "high"];

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  none: "text-foreground/20 hover:text-foreground/40",
  low: "text-blue-400 dark:text-blue-300",
  medium: "text-amber-400 dark:text-amber-300",
  high: "text-red-500 dark:text-red-400",
};

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === "done") {
    return (
      <svg
        viewBox="0 0 10 9"
        className="w-2.5 h-2.5 text-white fill-none stroke-current"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 4.5l3 3 5-6" />
      </svg>
    );
  }
  if (status === "in-progress") {
    return <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-300" />;
  }
  return null;
}

/** Format a due date string (YYYY-MM-DD or YYYY-MM-DDTHH:MM) for display */
function formatDueDate(dueDate: string): string {
  const hasTime = dueDate.includes("T") && !dueDate.endsWith("T00:00");
  const dateObj = new Date(dueDate.includes("T") ? dueDate : dueDate + "T00:00:00");
  if (Number.isNaN(dateObj.getTime())) return dueDate;
  const datePart = dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (!hasTime) return datePart;
  const timePart = dateObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

/** Convert stored dueDate to a value suitable for datetime-local input */
function toInputValue(dueDate: string | null): string {
  if (!dueDate) return "";
  if (dueDate.includes("T")) return dueDate.slice(0, 16); // YYYY-MM-DDTHH:MM
  return `${dueDate}T00:00`; // legacy date-only → midnight
}

export function TaskItemView({ node, updateAttributes }: NodeViewProps) {
  const { t } = useTranslation();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { status, dueDate, priority } = node.attrs as {
    status: TaskStatus;
    dueDate: string | null;
    priority: TaskPriority;
  };

  const cycleStatus = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = STATUS_CYCLE.indexOf(status);
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      updateAttributes({ status: next, checked: next === "done" });
    },
    [status, updateAttributes]
  );

  const cyclePriority = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = PRIORITY_CYCLE.indexOf(priority ?? "none");
      const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
      updateAttributes({ priority: next });
    },
    [priority, updateAttributes]
  );

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value; // YYYY-MM-DDTHH:MM or ""
      // Store as YYYY-MM-DDTHH:MM; strip T00:00 suffix to keep date-only notes short
      const stored = val.endsWith("T00:00") ? val.slice(0, 10) : val || null;
      updateAttributes({ dueDate: stored });
    },
    [updateAttributes]
  );

  const clearDate = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      updateAttributes({ dueDate: null });
    },
    [updateAttributes]
  );

  const openDatePicker = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dateInputRef.current?.showPicker?.();
    dateInputRef.current?.click();
  }, []);

  // Overdue = has due date, not done, and the due datetime is in the past
  const isOverdue = !!dueDate && status !== "done" && (() => {
    const due = new Date(dueDate.includes("T") ? dueDate : dueDate + "T23:59:59");
    return due < new Date();
  })();

  const formattedDate = dueDate ? formatDueDate(dueDate) : null;
  const currentPriority: TaskPriority = (priority as TaskPriority) || "none";
  const priorityEmoji = PRIORITY_EMOJI[currentPriority];

  return (
    <NodeViewWrapper
      as="li"
      data-type="taskItem"
      data-status={status}
      data-priority={currentPriority}
      className="group/task-item task-item-extended list-none flex items-baseline gap-1.5 my-0.5 py-0 pl-0"
    >
      {/* Status toggle button */}
      <button
        contentEditable={false}
        onMouseDown={cycleStatus}
        title={t("notes.tasks.cycleStatus", { status })}
        className={cn(
          "task-status-btn shrink-0 mt-[0.18em] w-[1.1em] h-[1.1em] rounded-full border-2 flex items-center justify-center transition-all duration-150 cursor-pointer select-none",
          "focus:outline-none",
          status === "open" &&
            "border-border/50 bg-transparent hover:border-primary/50 hover:bg-primary/5",
          status === "in-progress" &&
            "border-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:border-blue-500",
          status === "done" &&
            "border-green-500 bg-green-500 hover:bg-green-600 hover:border-green-600"
        )}
      >
        <StatusIcon status={status} />
      </button>

      {/* Priority indicator — click to cycle */}
      <button
        contentEditable={false}
        onMouseDown={cyclePriority}
        title={t("notes.tasks.togglePriority", { priority: currentPriority })}
        className={cn(
          "shrink-0 mt-[0.1em] text-[15px] leading-none transition-all duration-150 cursor-pointer select-none focus:outline-none w-[1.2em]",
          currentPriority === "none"
            ? "opacity-0 group-hover/task-item:opacity-60 " + PRIORITY_STYLES.none
            : PRIORITY_STYLES[currentPriority]
        )}
      >
        {currentPriority === "none" ? "⚑" : priorityEmoji}
      </button>

      {/* Editable task text */}
      <NodeViewContent
        as="div"
        className={cn(
          "task-item-content flex-1 min-w-0 outline-none",
          status === "done" && "line-through text-foreground/40"
        )}
      />

      {/* Due date + remove controls */}
      <div
        contentEditable={false}
        className="task-item-meta flex items-center gap-0.5 shrink-0 select-none mt-[0.1em]"
      >
        {dueDate ? (
          <>
            <button
              onMouseDown={openDatePicker}
              title={t("notes.tasks.changeDueDate")}
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors leading-none cursor-pointer",
                isOverdue
                  ? "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-950"
                  : "bg-foreground/6 text-foreground/50 hover:bg-foreground/12 dark:bg-white/6 dark:text-foreground/40"
              )}
            >
              📅 {formattedDate}
            </button>
            <button
              onMouseDown={clearDate}
              title={t("notes.tasks.removeDueDate")}
              className="text-foreground/20 hover:text-foreground/50 text-[13px] leading-none font-light transition-colors"
            >
              ×
            </button>
          </>
        ) : (
          <button
            onMouseDown={openDatePicker}
            title={t("notes.tasks.addDueDate")}
            className="text-[15px] text-foreground/20 hover:text-foreground/50 transition-opacity opacity-0 group-hover/task-item:opacity-100 cursor-pointer leading-none"
          >
            📅
          </button>
        )}

        {/* Hidden native datetime-local input */}
        <input
          ref={dateInputRef}
          type="datetime-local"
          value={toInputValue(dueDate)}
          onChange={handleDateChange}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
    </NodeViewWrapper>
  );
}

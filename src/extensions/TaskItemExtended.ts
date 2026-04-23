import { mergeAttributes } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import { ReactNodeViewRenderer } from "@tiptap/react";
// Imported lazily to avoid circular deps — the view file is in components/
import { TaskItemView } from "../components/notes/TaskItemView";

export type TaskStatus = "open" | "in-progress" | "done";
export type TaskPriority = "none" | "low" | "medium" | "high";

/** Emoji used in serialized markdown for each priority level */
export const PRIORITY_EMOJI: Record<TaskPriority, string> = {
  none: "",
  low: "🔽",
  medium: "🔼",
  high: "⏫",
};
const EMOJI_TO_PRIORITY: Record<string, TaskPriority> = {
  "🔽": "low",
  "🔼": "medium",
  "⏫": "high",
};
// Matches optional time: 📅 2025-05-01 or 📅 2025-05-01T14:30
const DATE_PATTERN = /\s*📅\s*(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?)\s*/;
const DATE_REPLACE_PATTERN = /\s*📅\s*\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?\s*/g;
const PRIORITY_INLINE_PATTERN = /^\s*(⏫|🔼|🔽)\s*/u;

/**
 * Extends the built-in TaskItem with:
 *  - status: 'open' | 'in-progress' | 'done'
 *  - dueDate: ISO date string or null
 *
 * Markdown format:
 *   - [ ] Open task
 *   - [/] In-progress task 📅 2025-05-01
 *   - [x] Done task
 */
export const TaskItemExtended = TaskItem.extend({
  // Priority > 51 (default) so our parseHTML wins
  priority: 200,

  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-checked") === "true",
        renderHTML: ({ checked }) => ({ "data-checked": String(checked) }),
        keepOnSplit: false,
      },
      status: {
        default: "open" as TaskStatus,
        parseHTML: (el) => (el.getAttribute("data-status") as TaskStatus) || "open",
        renderHTML: ({ status }) => ({ "data-status": status }),
      },
      dueDate: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute("data-due-date") || null,
        renderHTML: ({ dueDate }) => (dueDate ? { "data-due-date": dueDate } : {}),
      },
      priority: {
        default: "none" as TaskPriority,
        parseHTML: (el) => (el.getAttribute("data-priority") as TaskPriority) || "none",
        renderHTML: ({ priority }) =>
          priority && priority !== "none" ? { "data-priority": priority } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'li[data-type="taskItem"]', priority: 200 }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "li",
      mergeAttributes(HTMLAttributes, { "data-type": "taskItem" }),
      ["div", 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskItemView);
  },

  /**
   * Override tiptap-markdown serialization via the storage.markdown spec.
   * getMarkdownSpec() in tiptap-markdown merges defaultMarkdownSpec with
   * extension.storage.markdown, so this completely overrides the built-in
   * taskItem serializer.
   */
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const { status, dueDate, priority } = node.attrs as {
            status: TaskStatus;
            dueDate: string | null;
            priority: TaskPriority;
          };
          const checkbox =
            status === "done" ? "[x]" : status === "in-progress" ? "[/]" : "[ ]";
          state.write(`${checkbox} `);
          // Priority emoji before content
          const priorityEmoji = PRIORITY_EMOJI[priority as TaskPriority] || "";
          if (priorityEmoji) {
            state.write(`${priorityEmoji} `);
          }
          // Render the paragraph's inline content without triggering a close block
          const firstChild = node.firstChild;
          if (firstChild) {
            state.renderInline(firstChild);
          }
          if (dueDate) {
            state.write(` 📅 ${dueDate}`);
          }
          state.closeBlock(node);
        },
        parse: {
          /**
           * updateDOM runs after markdown-it renders to HTML.
           * We override the default task-item updateDOM to also:
           *  - Handle [/] in-progress items (not recognized by markdown-it-task-lists)
           *  - Extract and strip 📅 date markers from text content
           */
          updateDOM(element: Element) {
            // ── Standard task items (added by markdown-it-task-lists) ──────────
            [...element.querySelectorAll(".task-list-item")].forEach((item) => {
              const input = item.querySelector("input");
              item.setAttribute("data-type", "taskItem");
              const isChecked = (input as HTMLInputElement | null)?.checked ?? false;
              item.setAttribute("data-checked", String(isChecked));
              item.setAttribute("data-status", isChecked ? "done" : "open");
              if (input) input.remove();

              const pEls = [...item.querySelectorAll("p")];
              const srcEl = pEls[0] ?? item;
              const targets = pEls.length > 0 ? pEls : [item as Element];

              // Extract priority emoji (must come before date extraction)
              const priorityMatch = (srcEl.textContent || "").match(PRIORITY_INLINE_PATTERN);
              if (priorityMatch) {
                const emoji = priorityMatch[1];
                item.setAttribute("data-priority", EMOJI_TO_PRIORITY[emoji] ?? "none");
                targets.forEach((p) => {
                  p.innerHTML = p.innerHTML.replace(PRIORITY_INLINE_PATTERN, "");
                });
              }

              // Extract 📅 date/datetime
              const dateMatch = (targets[0]?.textContent || "").match(DATE_PATTERN);
              if (dateMatch) {
                item.setAttribute("data-due-date", dateMatch[1]);
                targets.forEach((p) => {
                  p.innerHTML = p.innerHTML.replace(DATE_REPLACE_PATTERN, "");
                });
              }
            });

            // ── In-progress items ([/] not handled by markdown-it-task-lists) ──
            [...element.querySelectorAll("li:not(.task-list-item)")].forEach((item) => {
              const rawText = item.textContent?.trimStart() || "";

              if (!/^\[\/\]/.test(rawText)) return;

              item.setAttribute("data-type", "taskItem");
              item.setAttribute("data-status", "in-progress");
              item.setAttribute("data-checked", "false");

              // Ensure the parent list is marked as a taskList
              const parent = item.parentElement;
              if (parent && !parent.hasAttribute("data-type")) {
                parent.setAttribute("data-type", "taskList");
              }

              // Strip [/] from the text content
              const pEls = [...item.querySelectorAll("p")];
              const targets = pEls.length > 0 ? pEls : [item as Element];
              targets.forEach((el) => {
                el.innerHTML = el.innerHTML.replace(/^\s*\[\/\]\s*/, "");
              });

              // Extract priority emoji
              const priorityMatch = (targets[0]?.textContent || "").match(PRIORITY_INLINE_PATTERN);
              if (priorityMatch) {
                const emoji = priorityMatch[1];
                item.setAttribute("data-priority", EMOJI_TO_PRIORITY[emoji] ?? "none");
                targets.forEach((el) => {
                  el.innerHTML = el.innerHTML.replace(PRIORITY_INLINE_PATTERN, "");
                });
              }

              // Extract 📅 date/datetime from the now-cleaned text
              const cleaned = (targets[0]?.textContent || "").match(DATE_PATTERN);
              if (cleaned) {
                item.setAttribute("data-due-date", cleaned[1]);
                targets.forEach((el) => {
                  el.innerHTML = el.innerHTML.replace(DATE_REPLACE_PATTERN, "");
                });
              }
            });
          },
        },
      },
    };
  },
});

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;
  status: "executing" | "completed" | "error";
  result?: string;
  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  isStreaming: boolean;
  toolCalls?: ToolCallInfo[];
  /** Base64 data URL of an attached screenshot (user messages only). */
  imageDataUrl?: string;
}

export type AgentState =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "streaming"
  | "tool-executing";

export { toolIcons } from "./toolIcons";

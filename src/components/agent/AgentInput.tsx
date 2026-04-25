import { ChatInput } from "../chat/ChatInput";
import type { AgentState } from "../chat/types";

interface AgentInputProps {
  agentState: AgentState;
  partialTranscript: string;
  onTextSubmit?: (text: string, imageDataUrl?: string) => void;
  onCancel?: () => void;
  actionSlot?: React.ReactNode;
}

export function AgentInput(props: AgentInputProps) {
  return <ChatInput {...props} autoFocus />;
}

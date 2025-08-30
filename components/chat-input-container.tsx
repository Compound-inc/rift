"use client";

import { ModelSelector } from "@/components/model-selector";
import {
  ChatInput,
  ChatInputSubmit,
  ChatInputTextArea,
} from "@/components/ui/chat-input";
import { ScrollButton } from "@/components/ui/chat-message-area";

interface ChatInputContainerProps {
  input: string;
  status: "idle" | "submitting" | "submitted" | "streaming" | "ready" | "error";
  showScrollButton: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onStop: () => void;
  onScrollToBottom: () => void;
}

export function ChatInputContainer({
  input,
  status,
  showScrollButton,
  onInputChange,
  onSubmit,
  onStop,
  onScrollToBottom,
}: ChatInputContainerProps) {
  return (
    <div className="fixed bottom-0 z-50 mt-auto w-2xl">
      
      <div className="absolute inset-0 rounded-2xl rounded-t-[20px] rounded-b-none border-8 border-b-0 bg-white/30 backdrop-blur-md dark:bg-black/30" />
      <ChatInput
        variant="default"
        className="border-sidebar-border/5 focus-within:ring-sidebar-border text-sidebar-logo relative min-h-28 w-full rounded-2xl rounded-t-[20px] rounded-b-none border-8 border-b-0 bg-transparent font-semibold shadow-xl"
        value={input}
        onChange={onInputChange}
        onSubmit={onSubmit}
      >
        <ChatInputTextArea
          className="text-chat-text placeholder:text-text-placeholder dark:bg-transparent"
          placeholder="Type your message here..."
        />
        <ModelSelector className="absolute bottom-2 left-4" />
        <ChatInputSubmit
          loading={status === "submitted" || status === "streaming"}
          onStop={onStop}
          className="bg-sidebar-button hover:bg-sidebar-button-hover h-10 w-10 cursor-pointer rounded-lg"
        />
        {showScrollButton && (
          <ScrollButton
            onClick={onScrollToBottom}
            alignment="center"
            className="hover:bg-secondary absolute -top-12 rounded-full shadow-lg"
          />
        )}
      </ChatInput>
    </div>
  );
}

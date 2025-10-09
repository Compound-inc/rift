"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ai/ui/scroll-area";
import { MessageSquare, FileText } from "lucide-react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
} from "@/components/ai/prompt-input";
import { Message, MessageContent } from "@/components/ai/message";

type TranscriptMessage = {
  id: string;
  speaker: string;
  timestamp: string;
  text: string;
  highlight?: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

interface TranscriptSidebarProps {
  messages: TranscriptMessage[];
}

export function TranscriptSidebar({ messages }: TranscriptSidebarProps) {
  const [activeTab, setActiveTab] = useState<"transcript" | "chat">("transcript");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const message = formData.get("message") as string;
    
    if (!message?.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, newMessage]);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I understand your question about the meeting. Based on the transcript, I can help you find relevant information or provide insights about the discussion.",
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <div className="flex w-[400px] flex-col border-l bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("transcript")}
            className={cn(
              "group relative flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors overflow-hidden",
              "hover:bg-hover hover:text-accent-foreground",
              activeTab === "transcript" && "bg-hover text-accent-foreground"
            )}
          >
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Transcript</span>
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "group relative flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors overflow-hidden",
              "hover:bg-hover hover:text-accent-foreground",
              activeTab === "chat" && "bg-hover text-accent-foreground"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm font-medium">AI Chat</span>
          </button>
        </div>
      </div>

      {activeTab === "transcript" ? (
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-gray-600 to-gray-800">
                    <span className="text-xs font-medium text-white">
                      {message.speaker.charAt(0)}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{message.speaker}</span>
                  <button className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                    [{message.timestamp}]
                  </button>
                </div>
                <div
                  className={cn(
                    "rounded-lg p-3 text-sm leading-relaxed",
                    message.highlight
                      ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                      : "bg-white dark:bg-gray-800"
                  )}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-1 flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              {chatMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    This AI chat has all the context of this class
                  </p>
                </div>
              ) : (
                chatMessages.map((message) => (
                  <Message key={message.id} from={message.role}>
                    <MessageContent from={message.role}>
                      {message.content}
                    </MessageContent>
                  </Message>
                ))
              )}
            </div>
          </ScrollArea>
          
          {/* Chat Input */}
          <div className="border-t">
            <PromptInput onSubmit={handleSubmit}>
              <PromptInputTextarea
                placeholder="Ask about the meeting..."
              />
              <PromptInputToolbar>
                <div></div>
                <PromptInputSubmit />
              </PromptInputToolbar>
            </PromptInput>
          </div>
        </div>
      )}
    </div>
  );
}

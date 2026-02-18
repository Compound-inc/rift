"use client";

import { useEffect, useState } from "react";
import { cn } from "@rift/utils";
import { AIModelsIcon } from "@/components/ui/icons/landing-icons";
import { Response } from "@/components/chat/response";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@rift/ui/avatar";

const DEFAULT_EXAMPLES: Array<{ user: string; ai: string }> = [
  {
    user: "Explica la computación cuántica brevemente",
    ai: "La **computación cuántica** es un paradigma que aprovecha fenómenos como la *superposición* y el *entrelazamiento*.\n\nDiferencias clave:\n- **Bits Clásicos**: 0 o 1.\n- **Qubits**: 0, 1 o ambos a la vez.\n\nEsto permite resolver problemas complejos (como criptografía) exponencialmente más rápido.",
  },
  {
    user: "Genera una función de Fibonacci en Python",
    ai: "Aquí tienes una implementación recursiva optimizada con memoización:\n\n```python\ndef fib(n, memo={}):\n    if n in memo: return memo[n]\n    if n <= 1: return n\n    memo[n] = fib(n-1) + fib(n-2)\n    return memo[n]\n```",
  },
  {
    user: "Plan de estudio para aprender física clásica en 1 mes",
    ai: "### Semana 1: Mecánica\n1. **Días 1-2**: Cinemática (movimiento rectilíneo y circular).\n2. **Días 3-4**: Dinámica (leyes de Newton, fuerzas).\n3. **Día 5**: Energía y trabajo.\n\n### Semana 2: Termodinámica y Ondas\n- **Termodinámica**: Calor, temperatura y leyes.\n- **Ondas**: Movimiento armónico y ondas mecánicas.\n\n### Semana 3-4: Electromagnetismo\n- **Electrostática**: Campo eléctrico y potencial.\n- **Magnetismo**: Campo magnético y fuerza de Lorentz.\n- **Inducción**: Ley de Faraday y corrientes alternas.",
  },
];

type MockChatDemoProps = {
  examples?: Array<{ user: string; ai: string }>;
};

export function MockChatDemo({ examples = DEFAULT_EXAMPLES }: MockChatDemoProps) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [displayedResponse, setDisplayedResponse] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [phase, setPhase] = useState<"user_typing" | "thinking" | "streaming" | "done">("user_typing");
  const [userText, setUserText] = useState("");

  const currentExample = examples[exampleIndex];

  // Cursor blinking effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let isMounted = true;

    const runSequence = async () => {
      if (!isMounted) return;
      // Reset
      setDisplayedResponse("");
      setUserText("");
      setPhase("user_typing");

      // 1. Type user message
      const userMessage = currentExample.user;
      for (let i = 0; i <= userMessage.length; i++) {
        if (!isMounted) return;
        setUserText(userMessage.slice(0, i));
        await new Promise((resolve) => setTimeout(resolve, 50)); // Typing speed
      }

      // 2. Thinking (very short to show speed)
      if (!isMounted) return;
      setPhase("thinking");
      await new Promise((resolve) => setTimeout(resolve, 400)); // 400ms latency simulation

      // 3. Stream AI response
      if (!isMounted) return;
      setPhase("streaming");
      setIsTyping(true);
      const aiMessage = currentExample.ai;
      const chunkSize = 5; // Increased characters per tick for speed
      for (let i = 0; i <= aiMessage.length; i += chunkSize) {
        if (!isMounted) return;
        setDisplayedResponse(aiMessage.slice(0, i + chunkSize));
        await new Promise((resolve) => setTimeout(resolve, 5)); // Even faster streaming
      }
      if (!isMounted) return;
      setDisplayedResponse(aiMessage); // Ensure full text
      setIsTyping(false);
      setPhase("done");

      // 4. Wait before next example
      timeout = setTimeout(() => {
        if (isMounted) {
          setExampleIndex((prev) => (prev + 1) % examples.length);
        }
      }, 4000);
    };

    runSequence();

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [exampleIndex, currentExample.user, currentExample.ai, examples.length]);

  return (
    <div className="relative w-full max-w-[1082px] mx-auto p-4 md:p-12">
      {/* Top border */}
      <div className="absolute inset-x-0 top-4 md:top-12 flex w-full items-center justify-center z-[2]">
        <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform max-w-[1082px]">
          <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:stroke-white" />
        </svg>
      </div>

      {/* Left border */}
      <div className="absolute inset-y-0 left-4 md:left-12 flex h-full items-center justify-center z-[2]">
        <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
          <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:stroke-white" />
        </svg>
      </div>

      {/* Right border */}
      <div className="absolute inset-y-0 right-4 md:right-12 flex h-full items-center justify-center z-[2]">
        <svg width="1" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-full max-w-full will-change-transform">
          <line x1="0.5" y1="0" x2="0.5" y2="100%" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:stroke-white" />
        </svg>
      </div>

      {/* Bottom border */}
      <div className="absolute inset-x-0 bottom-4 md:bottom-12 flex w-full items-center justify-center z-[2]">
        <svg width="100%" height="1" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="inline-block h-auto w-full will-change-transform max-w-[1082px]">
          <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="stroke-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:stroke-white" />
        </svg>
      </div>

      {/* Chat Area */}
      <div
        className="relative flex flex-col h-[400px] overflow-hidden mock-chat-bg"
      >
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
          {/* User Message */}
          <div className={cn(
            "flex items-start gap-3 justify-end transition-opacity duration-500",
            phase === "user_typing" && userText.length === 0 ? "opacity-0" : "opacity-100"
          )}>
            <div className="bg-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] text-white dark:bg-white dark:text-black px-4 py-2 rounded-2xl rounded-tr-sm max-w-[80%] text-sm shadow-sm">
              {userText}
              <span className={cn(
                "ml-1 inline-block w-1.5 h-4 bg-current align-middle",
                phase === "user_typing" && showCursor ? "opacity-100" : "opacity-0"
              )} />
            </div>
            <Avatar className="size-8 shrink-0 border border-transparent ring-1 ring-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.1)] dark:ring-white/20">
              <AvatarImage src="/avatar.png" alt="User avatar" />
              <AvatarFallback className="text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:text-white">U</AvatarFallback>
            </Avatar>
          </div>

          {/* AI Message */}
          {(phase === "thinking" || phase === "streaming" || phase === "done") && (
             <div className="flex items-start gap-3 max-w-[90%]">
               <div className="w-8 h-8 rounded-full bg-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.05)] dark:bg-white/10 border border-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.1)] dark:border-white/20 flex items-center justify-center shrink-0 mt-1">
                 <AIModelsIcon className="w-4 h-4 text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:text-white" />
               </div>
               <div className="flex flex-col gap-1 min-w-0 w-full">
                 <span className="text-xs font-medium text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.8)] dark:text-zinc-400">Rift AI</span>
                 <div className="text-sm text-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:text-white leading-relaxed">
                   <Response className="text-sm leading-relaxed">{displayedResponse}</Response>
                   {phase === "streaming" && (
                     <span className="inline-block w-1.5 h-4 bg-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/1)] dark:bg-white ml-0.5 align-middle animate-pulse" />
                   )}
                 </div>
                 {phase === "thinking" && (
                    <div className="flex gap-1 mt-2">
                      <div className="w-1.5 h-1.5 bg-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.4)] dark:bg-white/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.4)] dark:bg-white/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-[color(display-p3_0.1725490196_0.1764705882_0.1882352941/0.4)] dark:bg-white/40 rounded-full animate-bounce" />
                    </div>
                 )}
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

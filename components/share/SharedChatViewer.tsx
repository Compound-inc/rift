"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useConvexAuth, useMutation, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { UIMessage } from "ai";
import { isTextUIPart } from "ai";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai/conversation";
import type { ConvexMessage } from "@/components/chat/types";
import { MessageRenderer } from "@/components/chat/components/message-renderer";
import { Loader } from "@/components/ai/loader";
import { toast } from "sonner";
import { ChatStoreProvider } from "@/lib/stores/hooks";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ai/ui/button";
import { Copy, Printer, GitFork, Check, MoreVertical } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLogo } from "@/components/ui/icons/svg-icons";
import Link from "next/link";

const PAGE_SIZE = 20;

const NAV_ICON_BUTTON_PROPS = { variant: "ghost" as const, size: "icon" as const };
const NAV_CTA_BUTTON_PROPS = { variant: "accent" as const, size: "sm" as const };
const NAV_TEXT_BUTTON_PROPS = { variant: "ghost" as const, size: "sm" as const };

type SharedChatViewerProps = {
  shareId: string;
  thread: {
    threadId: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    model: string;
    responseStyle?: string;
    ownerName?: string;
  };
  initialMessages: UIMessage[];
  initialCursor: string | null;
  initialIsDone: boolean;
};

const mapPageToUI = (page: ConvexMessage[]): UIMessage[] =>
  page.map((m) => ({
    id: m.messageId,
    role: m.role,
    parts: [
      ...(m.reasoning ? [{ type: "reasoning" as const, text: m.reasoning }] : []),
      ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
      ...(m.attachments
        ? m.attachments.map((att) => ({
            type: "file" as const,
            mediaType: att.mimeType,
            url: att.attachmentUrl,
            attachmentId: att.attachmentId,
            attachmentType: att.attachmentType,
          }))
        : []),
      ...(m.sources
        ? m.sources.map((source) => ({
            type: "source-url" as const,
            sourceId: source.sourceId,
            url: source.url,
            title: source.title,
          }))
        : []),
    ],
  }));

export default function SharedChatViewer({
  shareId,
  thread,
  initialMessages,
  initialCursor,
  initialIsDone,
}: SharedChatViewerProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);

  const handleSignInHover = () => {
    router.prefetch("/sign-in");
  };

  const handleSignUpHover = () => {
    router.prefetch("/sign-up");
  };
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isDone, setIsDone] = useState(initialIsDone);
  const [requestedCursor, setRequestedCursor] = useState<string | null>(null);
  
  const { isAuthenticated } = useConvexAuth();
  const cloneThread = useMutation(api.share.cloneSharedThread);
  const searchParams = useSearchParams();
  const [isCopied, setIsCopied] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [autoClonePending, setAutoClonePending] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const nextPage = useQuery(
    api.share.getSharedThread,
    requestedCursor !== null
      ? {
          shareId,
          paginationOpts: { numItems: PAGE_SIZE, cursor: requestedCursor },
        }
      : "skip",
  );

  useEffect(() => {
    if (!nextPage || requestedCursor === null) return;

    if (!nextPage.messages) {
      toast.error("No se pudo cargar la conversación compartida");
      setRequestedCursor(null);
      return;
    }

    const nextMessages = mapPageToUI(nextPage.messages.page);

    setMessages((prev) => [...nextMessages, ...prev]);
    setCursor(nextPage.messages.continueCursor ?? null);
    setIsDone(nextPage.messages.isDone);
    setRequestedCursor(null);
  }, [nextPage, requestedCursor]);

  const handleLoadMore = () => {
    if (isDone || !cursor || requestedCursor !== null) return;
    setRequestedCursor(cursor);
  };

  const handleCopy = async () => {
    try {
      const text = messages
        .map((m) => {
          const role = m.role === "user" ? "User" : "Assistant";
          const content = m.parts
            .filter(isTextUIPart)
            .map((p) => p.text)
            .join("");
          return `${role}:\n${content}`;
        })
        .join("\n\n---\n\n");

      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success("Conversación copiada al portapapeles");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error("Error al copiar la conversación");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClone = useCallback(async (options?: { triggeredByAuth?: boolean }) => {
    if (!isAuthenticated) {
      const returnTo = `/share/${shareId}?clone=1`;
      const signInUrl =
        typeof window !== "undefined"
          ? new URL("/sign-in", window.location.origin)
          : null;
      if (signInUrl) {
        signInUrl.searchParams.set("return_to", returnTo);
        router.push(signInUrl.toString());
      } else {
        router.push("/sign-in");
      }
      return;
    }
    setIsCloning(true);
    try {
      const threadId = await cloneThread({ shareId });
      toast.success("Conversación clonada correctamente");
      router.push(`/chat/${threadId}`);
    } catch (error) {
      toast.error("Error al clonar la conversación");
      console.error(error);
    } finally {
      setIsCloning(false);
      if (options?.triggeredByAuth) {
        setAutoClonePending(false);
      }
    }
  }, [isAuthenticated, shareId, cloneThread, router]);

  useEffect(() => {
    if (!searchParams) return;
    const shouldClone = searchParams.get("clone") === "1";
    if (shouldClone) {
      setAutoClonePending(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!autoClonePending || !isAuthenticated || isCloning) return;
    // Run clone automatically after returning from auth flow.
    handleClone({ triggeredByAuth: true });
  }, [autoClonePending, isAuthenticated, isCloning, handleClone]);

  const renderedMessages = messages;

  return (
    <ChatStoreProvider initialMessages={initialMessages}>
      <div className="flex min-h-screen w-full flex-col bg-[#FBFBFB] dark:bg-[#111113] text-foreground print:bg-white print:text-black">
        {/* Header - Sticky */}
        <div className="sticky top-0 z-50 w-full border-b bg-[#FBFBFB]/95 dark:bg-[#111113]/95 backdrop-blur supports-[backdrop-filter]:bg-[#FBFBFB]/60 dark:supports-[backdrop-filter]:bg-[#111113]/60 print:hidden">
          {/* Desktop Header */}
          <div className="hidden xl:block">
            {/* Logo on the left */}
            <div className="absolute left-6 top-1/2 transform -translate-y-1/2 z-10">
              <Link href="/" className="flex items-center" aria-label="Ir al inicio">
                <AppLogo className="h-8 w-auto" />
                <span className="sr-only">RIFT</span>
              </Link>
            </div>

            {/* Centered content */}
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  Conversación compartida
                  {thread.ownerName && <> por {thread.ownerName}</>}
                </p>
                <h1 className="truncate text-lg font-semibold">{thread.title}</h1>
              </div>
              <ThemeToggle size="md" styleType="ghost" />

              <div className="flex items-center gap-2">
                <Button
                  {...NAV_ICON_BUTTON_PROPS}
                  onClick={handleCopy}
                  title="Copiar conversación"
                  aria-label="Copiar conversación"
                  className="cursor-pointer"
                >
                  {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>

                <Button
                  {...NAV_ICON_BUTTON_PROPS}
                  onClick={handlePrint}
                  title="Imprimir"
                  aria-label="Imprimir conversación"
                  className="cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                </Button>

                <Button
                  {...NAV_CTA_BUTTON_PROPS}
                  onClick={() => handleClone()}
                  disabled={isCloning}
                  className="gap-2 cursor-pointer text-white dark:text-white"
                >
                  <GitFork className="h-4 w-4" />
                  {isCloning ? "Clonando..." : "Clonar chat"}
                </Button>
              </div>
            </div>

            {/* Auth buttons on the right */}
            <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-10">
              <div className="flex items-center space-x-4">
                <Unauthenticated>
                  <Button {...NAV_TEXT_BUTTON_PROPS} asChild className="cursor-pointer">
                    <Link href="/sign-in" onMouseEnter={handleSignInHover}>Iniciar sesión</Link>
                  </Button>
                  <Button {...NAV_CTA_BUTTON_PROPS} asChild className="cursor-pointer">
                    <Link href="/sign-up" onMouseEnter={handleSignUpHover}>Registrarse</Link>
                  </Button>
                </Unauthenticated>
              </div>
            </div>
          </div>

          {/* Mobile Header */}
          <div className="xl:hidden">
            {/* Mobile Top Bar */}
            <div className="flex items-center justify-between px-4 py-3">
              {/* Left: Conversation Info */}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">
                  Conversación compartida
                  {thread.ownerName && <> por {thread.ownerName}</>}
                </p>
                <h1 className="truncate text-base font-semibold">{thread.title}</h1>
              </div>

              {/* Right: Theme Toggle + More Options */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <ThemeToggle size="md" styleType="ghost" />
                <Button
                  {...NAV_ICON_BUTTON_PROPS}
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  title="Más opciones"
                  aria-label="Más opciones"
                  aria-expanded={isMobileMenuOpen}
                  className="cursor-pointer"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mobile Expanded Menu */}
            {isMobileMenuOpen && (
              <div className="border-t px-4 py-3 space-y-2">
                <div className="flex flex-col gap-2">
                  <Button
                    {...NAV_TEXT_BUTTON_PROPS}
                    onClick={handleCopy}
                    className="w-full justify-start gap-2 cursor-pointer"
                  >
                    {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {isCopied ? "Copiado" : "Copiar conversación"}
                  </Button>

                  <Button
                    {...NAV_TEXT_BUTTON_PROPS}
                    onClick={handlePrint}
                    className="w-full justify-start gap-2 cursor-pointer"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </Button>

                  <Button
                    {...NAV_TEXT_BUTTON_PROPS}
                    onClick={() => handleClone()}
                    disabled={isCloning}
                    className="w-full justify-start gap-2 cursor-pointer"
                  >
                    <GitFork className="h-4 w-4" />
                    {isCloning ? "Clonando..." : "Clonar chat"}
                  </Button>

                  <Unauthenticated>
                    <div className="pt-2 border-t space-y-2">
                      <Button
                        {...NAV_TEXT_BUTTON_PROPS}
                        asChild
                        className="w-full justify-start cursor-pointer"
                      >
                        <Link href="/sign-in" onMouseEnter={handleSignInHover}>Iniciar sesión</Link>
                      </Button>
                      <Button
                        {...NAV_CTA_BUTTON_PROPS}
                        asChild
                        className="w-full justify-start cursor-pointer"
                      >
                        <Link href="/sign-up" onMouseEnter={handleSignUpHover}>Registrarse</Link>
                      </Button>
                    </div>
                  </Unauthenticated>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 w-full justify-center flex">
          <div className="w-full max-w-3xl px-4 py-8">
            <Conversation>
              <ConversationContent className="mx-auto w-full max-w-full md:max-w-3xl p-0 bg-transparent print:p-0">
                {!isDone && cursor && (
                  <div className="flex justify-center mb-6 print:hidden">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={requestedCursor !== null}
                      className="cursor-pointer"
                    >
                      {requestedCursor ? "Cargando..." : "Cargar mensajes anteriores"}
                    </Button>
                  </div>
                )}
                
                {renderedMessages.map((message) => (
                  <MessageRenderer
                    key={message.id}
                    message={message}
                    isStreaming={false}
                    disableRegenerate
                    onRegenerateAssistantMessage={() => {}}
                    onRegenerateAfterUserMessage={() => {}}
                  />
                ))}

                {requestedCursor !== null && (
                  <div className="flex justify-center py-3">
                    <Loader />
                  </div>
                )}
              </ConversationContent>
            </Conversation>
          </div>
        </div>
        
        {/* Footer info for print */}
        <div className="hidden print:block text-center text-xs text-muted-foreground py-4 border-t mt-8">
          Generado con Rift AI - {new Date().toLocaleDateString()}
        </div>
      </div>
    </ChatStoreProvider>
  );
}





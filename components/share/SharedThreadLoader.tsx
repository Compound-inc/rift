"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import SharedChatViewer from "@/components/share/SharedChatViewer";
import { Loader } from "@/components/ai/loader";
import { Button } from "@/components/ai/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Conversation, ConversationContent } from "@/components/ai/conversation";
import { MessageRenderer } from "@/components/chat/components/message-renderer";
import { ChatStoreProvider } from "@/lib/stores/hooks";
import type { UIMessage } from "ai";

const PAGE_SIZE = 30;

type SharedThreadOk = {
  status: "ok";
  thread: {
    threadId: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    model: string;
    responseStyle?: string;
    ownerName?: string;
    settings: {
      allowAttachments: boolean;
      orgOnly: boolean;
      shareName: boolean;
    };
  };
  messages: {
    page: any[];
    isDone: boolean;
    continueCursor: string | null;
  };
};

type SharedThreadAccessDenied = {
  status: "auth_required" | "org_required" | "org_mismatch";
};

type SharedThreadResponse = SharedThreadOk | SharedThreadAccessDenied | null;

const mapToUIMessage = (message: any) => {
  return {
    id: message.messageId,
    role: message.role,
    parts: [
      ...(message.reasoning ? [{ type: "reasoning", text: message.reasoning }] : []),
      ...(message.content ? [{ type: "text", text: message.content }] : []),
      ...(message.attachments
        ? message.attachments.map((att: any) => ({
            type: "file" as const,
            mediaType: att.mimeType,
            url: att.attachmentUrl,
            attachmentId: att.attachmentId,
            attachmentType: att.attachmentType,
          }))
        : []),
      ...(message.sources
        ? message.sources.map((source: any) => ({
            type: "source-url" as const,
            sourceId: source.sourceId,
            url: source.url,
            title: source.title,
          }))
        : []),
    ],
  };
};

function ShareAccessMessage({ status }: { status: SharedThreadAccessDenied["status"] }) {
  const copy: Record<
    SharedThreadAccessDenied["status"],
    { title: string; description: string; action?: { label: string; href: string } }
  > = {
    auth_required: {
      title: "Inicia sesión para ver esta conversación",
      description: "Este enlace requiere que estés autenticado en Rift y que pertenezcas a la organización del propietario.",
      action: { label: "Ir a iniciar sesión", href: "/sign-in" },
    },
    org_required: {
      title: "Acceso restringido a la organización",
      description: "Debes pertenecer a la organización del propietario para ver este enlace.",
      action: { label: "Ir a iniciar sesión", href: "/sign-in" },
    },
    org_mismatch: {
      title: "No perteneces a esta organización",
      description: "Este enlace solo está disponible para miembros de la organización del propietario.",
    },
  };

  const current = copy[status];

  const mockMessages: UIMessage[] = [
    {
      id: "mock-user",
      role: "user",
      parts: [
        { type: "text", text: "¿Puedes resumir este documento en español?" },
      ],
    },
    {
      id: "mock-assistant",
      role: "assistant",
      parts: [
        {
          type: "text",
          text:
            "### Resumen\n"
            + "- **Objetivo:** Consolidar el proyecto y alinear responsables.\n"
            + "- **Alcance:** Entregables principales, cronograma y criterios de éxito.\n"
            + "- **Artefactos:** Diseños, pruebas y manuales enlazados.\n"
            + "- **Riesgos:** Dependencias externas, plazos ajustados, falta de validación con usuarios.\n"
            + "- **Recomendación:** Sesiones semanales de feedback y responsables claros por área.\n\n"
            + "### Próximos pasos\n"
            + "1) Confirmar responsables y fechas clave.\n"
            + "2) Validar con usuarios finales el prototipo actual.\n"
            + "3) Programar revisión de riesgos y planes de contingencia.\n\n"
            + "### Resumen ejecutivo (tabla)\n"
            + "| Tema | Detalle |\n"
            + "| --- | --- |\n"
            + "| Responsable | Equipo de Producto |\n"
            + "| Estado | En curso |\n"
            + "| Riesgos | Dependencias externas, plazos ajustados |\n"
            + "| Próxima revisión | Jueves 10:00 AM |\n\n"
            + "Si quieres, puedo generar una lista de chequeo y un correo de seguimiento.",
        },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header without user info */}
      <div className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Conversación compartida</p>
            <h1 className="truncate text-lg font-semibold">Enlace compartido</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle size="md" styleType="ghost" />
          </div>
        </div>
      </div>

      <div className="relative flex-1 w-full flex items-center justify-center px-4 py-8 md:py-12">
        {/* Blurred mock chat with real message UI */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center overflow-hidden opacity-60 blur-sm">
          <div className="w-full max-w-3xl">
            <ChatStoreProvider initialMessages={mockMessages}>
              <Conversation>
                <ConversationContent className="p-0">
                  {mockMessages.map((message) => (
                    <div key={message.id} className="py-2">
                      <MessageRenderer
                        message={message}
                        isStreaming={false}
                        disableRegenerate
                        onRegenerateAssistantMessage={() => {}}
                        onRegenerateAfterUserMessage={() => {}}
                      />
                    </div>
                  ))}
                </ConversationContent>
              </Conversation>
            </ChatStoreProvider>
          </div>
        </div>

        {/* Modal */}
        <div className="relative z-10 w-full max-w-lg">
          <div className="w-full rounded-2xl border bg-card p-6 shadow-lg">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">{current.title}</h2>
              <p className="text-sm text-muted-foreground">{current.description}</p>
              {current.action && (
                <Button asChild className="w-fit">
                  <a href={current.action.href}>{current.action.label}</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SharedThreadLoader({ shareId }: { shareId: string }) {
  const shared = useQuery(api.share.getSharedThread, {
    shareId,
    paginationOpts: { numItems: PAGE_SIZE, cursor: null },
  }) as SharedThreadResponse;

  const initialMessages = useMemo(
    () => (shared && shared.status === "ok" ? shared.messages.page.map(mapToUIMessage) : []),
    [shared],
  );

  if (shared === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (shared === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Este enlace no está disponible.</p>
      </div>
    );
  }

  if (shared.status !== "ok") {
    return <ShareAccessMessage status={shared.status} />;
  }

  return (
    <SharedChatViewer
      shareId={shareId}
      thread={shared.thread}
      initialMessages={initialMessages}
      initialCursor={shared.messages.continueCursor}
      initialIsDone={shared.messages.isDone}
    />
  );
}



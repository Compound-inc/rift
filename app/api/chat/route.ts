import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { getLanguageModel } from "@/lib/ai/ai-providers";
import { api } from "@/convex/_generated/api";
import { fetchMutation } from "convex/nextjs";
import { withAuth } from "@workos-inc/authkit-nextjs";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    modelId,
    threadId,
  }: { messages: UIMessage[]; modelId: string; threadId: string } =
    await req.json();

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      const assistantMessageId = crypto.randomUUID();
      let assistantMessageStarted = false;
      let finalizationPromise: Promise<void> | null = null;

      // Fetch auth lazily in parallel
      let accessToken: string | undefined;
      const authPromise = withAuth()
        .then(({ accessToken: token }) => {
          accessToken = token;
        })
        .catch((err) => {
          console.error("withAuth failed", err);
        });

      // Immediately signal start to the client so spinner shows instantly
      writer.write({ type: "start", messageId: assistantMessageId });

      const languageModel = getLanguageModel(modelId);
      console.debug("AI streaming with model", modelId);

      // Batch persistence every ~800ms without affecting client stream
      let pendingDelta = "";
      let lastFlushAt = Date.now();
      const FLUSH_EVERY_MS = 1500;
      let gotAnyDelta = false;
      let startAssistantPromise: Promise<any> | null = null;

      const ensureAuth = async () => {
        if (!accessToken) {
          await authPromise;
        }
      };

      const flush = async () => {
        if (pendingDelta.length === 0) return;
        // Ensure assistant message doc exists before appending deltas
        if (startAssistantPromise) {
          try {
            await startAssistantPromise;
          } catch {
            // If creation failed, skip persisting deltas
          }
        }
        await ensureAuth();
        const toSend = pendingDelta;
        pendingDelta = "";
        lastFlushAt = Date.now();
        fetchMutation(
          api.threads.appendAssistantMessageDelta,
          {
            messageId: assistantMessageId,
            delta: toSend,
          },
          { token: accessToken },
        ).catch(() => {});
      };

      // Start streaming from the model
      const result = streamText({
        // @ts-ignore accept union model from registry
        model: languageModel,
        messages: convertToModelMessages(messages),
        onChunk: async ({ chunk }) => {
          if (chunk.type === "text-delta" && chunk.text.length > 0) {
            gotAnyDelta = true;
            pendingDelta += chunk.text;
            const now = Date.now();
            if (now - lastFlushAt >= FLUSH_EVERY_MS) {
              await flush();
            }
          }
        },
        onFinish: async ({ text }) => {
          await flush();

          // Prevent duplicate finalization with atomic promise
          if (finalizationPromise) {
            return finalizationPromise;
          }

          finalizationPromise = (async () => {
            await ensureAuth();
            const ok = gotAnyDelta || (text?.length ?? 0) > 0;
            return fetchMutation(
              api.threads.finalizeAssistantMessage,
              {
                messageId: assistantMessageId,
                ok,
                error: ok
                  ? undefined
                  : {
                      type: "empty",
                      message: "No tokens received from provider",
                    },
              },
              { token: accessToken },
            ).catch(() => {});
          })();

          return finalizationPromise;
        },
        onError: async (e) => {
          console.error("streamText error", e);
          await flush();

          // Prevent duplicate finalization with atomic promise
          if (finalizationPromise) {
            return finalizationPromise;
          }

          finalizationPromise = (async () => {
            return fetchMutation(
              api.threads.finalizeAssistantMessage,
              {
                messageId: assistantMessageId,
                ok: false,
                error: { type: "generation", message: "stream error" },
              },
              { token: accessToken },
            ).catch(() => {});
          })();

          return finalizationPromise;
        },
      });
      writer.merge(result.toUIMessageStream({ sendStart: false }));

      // Persist user message first, then start assistant message (proper order)
      startAssistantPromise = (async () => {
        try {
          await ensureAuth();

          // First, persist the user message
          const lastUser = [...messages]
            .reverse()
            .find((m) => m.role === "user");
          const lastUserText =
            lastUser?.parts
              ?.map((p: any) => (p?.type === "text" ? p.text : ""))
              .join("") ?? "";
          const lastUserId = (lastUser as any)?.id as string | undefined;

          if (lastUser && lastUserId) {
            await fetchMutation(
              api.threads.sendMessage,
              {
                threadId,
                content: lastUserText,
                model: modelId,
                messageId: lastUserId,
              },
              { token: accessToken },
            );
          }

          // Then start assistant message (only once)
          if (!assistantMessageStarted) {
            assistantMessageStarted = true;
            return await fetchMutation(
              api.threads.startAssistantMessage,
              {
                threadId,
                messageId: assistantMessageId,
                model: modelId,
              },
              { token: accessToken },
            );
          }
        } catch (err) {
          console.error("startAssistantMessage failed", err);
          throw err;
        }
      })();
    },
  });

  return createUIMessageStreamResponse({ stream });
}

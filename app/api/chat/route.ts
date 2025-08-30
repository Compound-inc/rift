import { streamText, UIMessage, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, smoothStream } from 'ai';
import { getLanguageModel } from '@/lib/ai/ai-providers';
import { api } from '@/convex/_generated/api';
import { fetchMutation } from 'convex/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    modelId,
    threadId,
  }: { messages: UIMessage[]; modelId: string; threadId: string } = await req.json();

  const { accessToken } = await withAuth();

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      const assistantMessageId = crypto.randomUUID();

      // Persist the latest user message first to avoid reordering/flicker
      try {
        const sanitizedUIMessages: UIMessage[] = (messages || [])
          .map((m) => ({
            ...m,
            parts: (m.parts || []).filter(
              (p: any) => p?.type === 'text' && typeof p.text === 'string' && p.text.trim().length > 0,
            ),
          }))
          .filter((m) => (m.parts && m.parts.length > 0));

        const lastUser = [...sanitizedUIMessages].reverse().find((m) => m.role === 'user');
        const lastUserText = lastUser?.parts?.map((p: any) => p?.type === 'text' ? p.text : '').join('') ?? '';
        const lastUserId = (lastUser as any)?.id as string | undefined;

        if (lastUser && lastUserText.trim().length > 0 && lastUserId) {
          await fetchMutation(api.threads.sendMessage, {
            threadId,
            content: lastUserText,
            model: modelId,
            messageId: lastUserId,
          }, { token: accessToken });
        }
      } catch (err) {
        console.error('persist user message failed', err);
      }

      try {
        await fetchMutation(api.threads.startAssistantMessage, {
          threadId,
          messageId: assistantMessageId,
          model: modelId,
        }, { token: accessToken });
      } catch (err) {
        console.error('startAssistantMessage failed', err);
      }

      writer.write({ type: 'start', messageId: assistantMessageId });

      const languageModel = getLanguageModel(modelId);
      console.debug('AI streaming with model', modelId);

      // Sanitize messages for Google: remove empty parts/messages
      const sanitizedUIMessages: UIMessage[] = (messages || [])
        .map((m) => ({
          ...m,
          parts: (m.parts || []).filter(
            (p: any) => p?.type === 'text' && typeof p.text === 'string' && p.text.trim().length > 0,
          ),
        }))
        .filter((m) => (m.parts && m.parts.length > 0));

      // Batch persistence every ~800ms without affecting client stream
      let pendingDelta = '';
      let lastFlushAt = Date.now();
      const FLUSH_EVERY_MS = 800;
      let gotAnyDelta = false;
      const flush = async () => {
        if (pendingDelta.length === 0) return;
        const toSend = pendingDelta;
        pendingDelta = '';
        lastFlushAt = Date.now();
        fetchMutation(api.threads.appendAssistantMessageDelta, {
          messageId: assistantMessageId,
          delta: toSend,
        }, { token: accessToken }).catch(() => {});
      };

      const result = streamText({
        // @ts-ignore accept union model from registry
        model: languageModel,
        messages: convertToModelMessages(sanitizedUIMessages),
        onChunk: async ({ chunk }) => {
          if (chunk.type === 'text-delta' && chunk.text.length > 0) {
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
          const ok = gotAnyDelta || (text?.length ?? 0) > 0;
          fetchMutation(api.threads.finalizeAssistantMessage, {
            messageId: assistantMessageId,
            ok,
            error: ok ? undefined : { type: 'empty', message: 'No tokens received from provider' },
          }, { token: accessToken }).catch(() => {});
        },
        onError: async (e) => {
          console.error('streamText error', e);
          await flush();
          fetchMutation(api.threads.finalizeAssistantMessage, {
            messageId: assistantMessageId,
            ok: false,
            error: { type: 'generation', message: 'stream error' },
          }, { token: accessToken }).catch(() => {});
        },
        experimental_transform: smoothStream({
          delayInMs: 10,
          chunking: 'word',
        }),
      });
      writer.merge(result.toUIMessageStream({ sendStart: false }));
    },
  });

  return createUIMessageStreamResponse({ stream });
}
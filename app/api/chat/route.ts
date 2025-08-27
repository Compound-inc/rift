import { ChatSDKError } from "../../../lib/errors";
import { attempt } from "../../../lib/try-catch";
import { generateUUID, getTrailingMessageId } from "../../../lib/utils";
import { getLanguageModel, DEFAULT_MODEL } from "../../../lib/ai/ai-providers";
import type { UIMessage } from "ai";
import {
  APICallError,
  appendClientMessage,
  appendResponseMessages,
  NoSuchProviderError,
  streamText,
} from "ai";
import { NextResponse } from "next/server";
import { RequestHints, systemPrompt } from "../../../lib/ai/prompts";
import { geolocation } from "@vercel/functions";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Simple title generation function
function generateSimpleTitle(message: UIMessage): string {
  if (message.parts && message.parts.length > 0) {
    const firstPart = message.parts[0];
    if (firstPart.type === "text" && firstPart.text) {
      const text = firstPart.text.trim();
      return text.length > 50 ? text.substring(0, 50) + "..." : text;
    }
  }
  return "New Chat";
}

export async function POST(req: Request) {
  // get the last message from the client:
  const { message, id, model, apiKeys } = await req.json();

  try {
    // Since we're using guest users, we don't need Clerk authentication
    const userId = "guest-user";

    // Check rate limit for sending messages using Convex rate limiter
    const rateLimitStatus = await convex.action(api.rateLimiting.checkMessageRateLimit, {
      userId,
    });

    if (!rateLimitStatus.ok) {
      const retryAfter = rateLimitStatus.retryAfter || 60000; // Default to 1 minute
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          status: 429,
          retryAfter,
        },
        { status: 429 },
      );
    }

    // Try to get the existing chat by UUID
    const [chat, chatError] = await attempt(
      convex.query(api.chats.getChatById, { uuid: id })
    );

    if (chatError) {
      console.error("💥 Error in chat route", chatError);
    }

    let chatId: Id<"chats">;

    if (!chat) {
      // Check rate limit for creating new chats
      const chatCreationRateLimit = await convex.action(api.rateLimiting.checkChatCreationRateLimit, {});
      
      if (!chatCreationRateLimit.ok) {
        const retryAfter = chatCreationRateLimit.retryAfter || 3600000; // Default to 1 hour
        return NextResponse.json(
          {
            error: "Chat creation rate limit exceeded. Please try again later.",
            status: 429,
            retryAfter,
          },
          { status: 429 },
        );
      }

      // Create a new chat with the UUID
      const title = generateSimpleTitle(message);

      // Create chat in Convex
      chatId = await convex.mutation(api.chats.createChat, {
        title,
        uuid: id,
      });
    } else {
      // Use existing chat's Convex ID
      chatId = chat._id;
    }

    // load the previous messages from Convex:
    const previousMessages = await convex.query(api.messages.getMessagesByChatId, { 
      chatId 
    });

    // Convert Convex messages to the format expected by AI SDK
    const convertedMessages = previousMessages.map(msg => ({
      id: msg._id,
      role: msg.role as "user" | "assistant" | "system",
      content: msg.parts?.[0]?.text || "",
      parts: msg.parts,
      createdAt: new Date(msg._creationTime),
      annotations: msg.annotations,
    }));

    // append the new message to the previous messages:
    const messages = appendClientMessage({
      messages: convertedMessages,
      message,
    });

    const { longitude, latitude, city, country } = geolocation(req);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
      time: new Date().toLocaleString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    // Save the user message to Convex
    const [, saveMessagesError] = await attempt(async () => {
      return await convex.mutation(api.messages.saveMessages, {
        messages: [
          {
            chatId,
            role: "user",
            parts: message.parts,
            annotations: [],
          },
        ],
      });
    });

    if (saveMessagesError) {
      console.error("💥 Error in chat route", saveMessagesError);
    }

    const selectedModel = model || DEFAULT_MODEL;
    const languageModel = getLanguageModel(selectedModel, apiKeys);

    let errorMessage = {
      error: "An unexpected error occurred. Please try again later.",
      status: 500,
    };

    const result = streamText({
      model: languageModel,
      messages,
      system: systemPrompt({ requestHints }),
      abortSignal: req.signal,
      experimental_generateMessageId: generateUUID,

      async onError({ error }) {
        if (error instanceof APICallError) {
          errorMessage = {
            error: error.message,
            status: error.statusCode || 500,
          };
        }

        if (error instanceof Error) {
          // use this function to save the messages that are immediately stopped by the user
          if (error.name === "ResponseAborted") {
            const [, saveMessagesError] = await attempt(async () => {
              return await convex.mutation(api.messages.saveMessages, {
                messages: [
                  {
                    chatId,
                    role: "assistant",
                    parts: [
                      {
                        type: "text",
                        text: "",
                      },
                    ],
                    annotations: [
                      {
                        hasStopped: true,
                        modelId: languageModel.modelId,
                      },
                    ],
                  },
                ],
              });
            });

            if (saveMessagesError) {
              throw new ChatSDKError(
                "bad_request:database",
                "Failed to save messages",
              );
            }
          }
        }
      },

      async onFinish({ response }) {
        try {
          const assistantId = getTrailingMessageId({
            messages: response.messages.filter(
              (message) => message.role === "assistant",
            ),
          });

          if (!assistantId) {
            throw new Error("No assistant message found!");
          }

          const [, assistantMessage] = appendResponseMessages({
            messages: [message],
            responseMessages: response.messages,
          });

          await convex.mutation(api.messages.saveMessages, {
            messages: [
              {
                chatId,
                role: assistantMessage.role,
                parts: assistantMessage.parts,
                annotations: [
                  {
                    modelId: languageModel.modelId,
                  },
                ],
              },
            ],
          });
        } catch (error) {
          console.error("💥 Error in chat route", error);
        }
      },
    });

    // consume the stream to ensure it runs to completion & triggers onFinish
    // even when the client response is aborted:
    result.consumeStream(); // no await

    return result.toDataStreamResponse({
      getErrorMessage() {
        return errorMessage.error + "-" + errorMessage.status;
      },
    });
  } catch (error) {
    if (error instanceof APICallError) {
      return NextResponse.json(
        {
          error: error.message,
          status: error.statusCode,
        },
        { status: error.statusCode },
      );
    }

    if (error instanceof NoSuchProviderError) {
      return NextResponse.json(
        {
          error: "No such provider. Please check your API keys.",
          status: 400,
        },
        { status: 400 },
      );
    }

    if (error instanceof APICallError) {
      return NextResponse.json(
        {
          error: error.message,
          status: error.statusCode,
        },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again later.",
        status: 500,
      },
      { status: 500 },
    );
  }
}

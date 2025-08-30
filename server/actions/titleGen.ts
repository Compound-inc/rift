// "use server";

// import { generateText, UIMessage } from "ai";
// import { ChatSDKError } from "@/lib/errors";
// import { attempt } from "@/lib/try-catch";
// import { getLanguageModel } from "@/lib/ai/ai-providers";

// export async function generateTitleFromUserMessage({
//   message,
//   apiKeys,
//   model,
// }: {
//   message: UIMessage;
//   apiKeys?: { openai?: string; openrouter?: string };
//   model?: string;
// }) {
//   // Use the user's selected model for title generation if provided
//   // This ensures consistency - same model for chat and title generation
//   let modelId: string;

//   if (model) {
//     // User has selected a specific model, use that
//     modelId = model;
//   } else {
//     // Fallback to smart selection if no model specified:
//     // 1. If user has OpenRouter API key, use Claude 3.5 Sonnet
//     // 2. If user has OpenAI API key, use GPT-4o Mini
//     // 3. Otherwise fallback to Mistral (environment variables)
//     if (apiKeys?.openrouter) {
//       modelId = "openrouter:anthropic/claude-3.5-sonnet";
//     } else if (apiKeys?.openai) {
//       modelId = "openai:gpt-4o-mini";
//     } else {
//       modelId = "mistral:mistral-small-latest";
//     }
//   }

//   const languageModel = getLanguageModel(modelId, apiKeys);

//   const { text: title } = await generateText({
//     // @ts-ignore - accept union type for model
//     model: languageModel,
//     system: `\n
//       - you will generate a short title based on the first message a user begins a conversation with
//       - ensure it is not more than 80 characters long
//       - the title should be a summary of the user's message
//       - do not use quotes or colons`,
//     prompt: JSON.stringify(message),
//   });

//   return title;
// }

// export async function getMessagesByChatId({ id }: { id: string }) {
//   // Note: This function now requires the Convex client to be called from the client side
//   // Server actions cannot directly call Convex functions
//   // Consider moving this logic to the client or creating a Convex query
//   throw new Error("getMessagesByChatId should be called from the client using Convex");
// }

// export async function saveMessages({
//   messages,
// }: {
//   messages: Array<any>;
// }) {
//   // Note: This function now requires the Convex client to be called from the client side
//   // Server actions cannot directly call Convex functions
//   // Consider moving this logic to the client or creating a Convex mutation
//   throw new Error("saveMessages should be called from the client using Convex");
// }

// export async function getMessageById({ id }: { id: string }) {
//   // Note: This function now requires the Convex client to be called from the client side
//   // Server actions cannot directly call Convex functions
//   // Consider moving this logic to the client or creating a Convex query
//   throw new Error("getMessageById should be called from the client using Convex");
// }

// export async function deleteMessagesByChatIdAfterTimestamp({
//   chatId,
//   timestamp,
// }: {
//   chatId: string;
//   timestamp: number;
// }) {
//   // Note: This function now requires the Convex client to be called from the client side
//   // Server actions cannot directly call Convex functions
//   // Consider moving this logic to the client or creating a Convex mutation
//   throw new Error("deleteMessagesByChatIdAfterTimestamp should be called from the client using Convex");
// }

// export async function deleteTrailingMessages({ messageId }: { messageId: string }) {
//   // Note: This function now requires the Convex client to be called from the client side
//   // Server actions cannot directly call Convex functions
//   // Consider moving this logic to the client or creating a Convex mutation
//   throw new Error("deleteTrailingMessages should be called from the client using Convex");
// }

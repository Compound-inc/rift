// "use server";

// import { attempt } from "@/lib/try-catch";
// import type { UIMessage } from "ai";
// import { ChatSDKError } from "@/lib/errors";
// import { saveMessages } from "./titleGen";
// import { revalidateTag, unstable_cache } from "next/cache";

// export type Message = Omit<UIMessage, "content">;

// export async function storePausedMessages({
//   id,
//   responseMessage,
//   modelId,
// }: {
//   id: string;
//   responseMessage: Message;
//   modelId: string;
// }) {
//   // use this function to save the messages that are paused
//   // when the user stops the stream
//   const [, error] = await attempt(
//     saveMessages({
//       messages: [
//         {
//           chatId: id,
//           id: responseMessage.id,
//           role: "assistant",
//           parts: responseMessage.parts,
//           annotations: [
//             {
//               hasStopped: true,
//               modelId,
//             },
//           ],
//           createdAt: new Date(),
//         },
//       ],
//     }),
//   );

//   if (error) {
//     throw new ChatSDKError("bad_request:database", "Failed to save chat");
//   }
// }

// export async function createChat({
//   id,
//   userId,
//   title,
// }: {
//   id: string;
//   userId: string;
//   title: string;
// }) {
//   // Note: This function now requires the Convex client to be called from the client side
//   // Server actions cannot directly call Convex functions
//   // Consider moving this logic to the client or creating a Convex mutation
//   throw new Error("createChat should be called from the client using Convex");
// }

// export async function deleteChat({ id }: { id: string }) {
//   // Note: This function now requires the Convex client to be called from the client side
//   // Server actions cannot directly call Convex functions
//   // Consider moving this logic to the client or creating a Convex mutation
//   throw new Error("deleteChat should be called from the client using Convex");
// }

// export async function getChatById({ id }: { id: string }) {
//   // Note: This function now requires the Convex client to be called from the client side
//   // Server actions cannot directly call Convex functions
//   // Consider moving this logic to the client or creating a Convex query
//   throw new Error("getChatById should be called from the client using Convex");
// }

// export const getChatHistory = unstable_cache(
//   async function getChatHistory({ userId }: { userId: string }) {
//     // Note: This function now requires the Convex client to be called from the client side
//     // Server actions cannot directly call Convex functions
//     // Consider moving this logic to the client or creating a Convex query
//     throw new Error("getChatHistory should be called from the client using Convex");
//   },
//   ["userId"],
//   {
//     revalidate: 60 * 60,
//     tags: ["chat-history"],
//   },
// );

// export async function toggleChatPin({ id }: { id: string }) {
//   // Note: This function now requires the Convex client to be called from the client side
//   // Server actions cannot directly call Convex functions
//   // Consider moving this logic to the client or creating a Convex mutation
//   throw new Error("toggleChatPin should be called from the client using Convex");
// }

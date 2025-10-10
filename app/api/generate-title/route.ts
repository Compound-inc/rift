import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { api } from "@/convex/_generated/api";
import { fetchMutation } from "convex/nextjs";
import { withAuth } from "@workos-inc/authkit-nextjs";

const TITLE_GENERATION_MODEL = google("gemini-2.0-flash-lite");

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const { accessToken } = await withAuth();
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId, userMessage } = await request.json();

    if (!threadId || !userMessage) {
      return NextResponse.json(
        { error: "Missing threadId or userMessage" },
        { status: 400 },
      );
    }

    // Generate a short title
    const { text } = await generateText({
      model: TITLE_GENERATION_MODEL,
      prompt: `Summarize the conversation in 5 words or fewer. Be as concise as possible without losing the context of the conversation, respond in the same language as the user message.

User message: ${userMessage}`,
      temperature: 0.3,
      maxOutputTokens: 50,
      maxRetries: 3,
    });

    // Clean the generated title - remove any potential markdown, quotes, or symbols
    const cleanTitle = text
      .replace(/[#*_`"'~-]/g, "") // Remove markdown characters
      .replace(/[^\w\s]/g, "") // Remove any non-alphanumeric characters except spaces
      .trim()
      .split(/\s+/) // Split by whitespace
      .slice(0, 8) // Take only first 12 words
      .join(" ")
      .slice(0, 50); // Ensure it's not too long

    // Update the thread title using Convex mutation with auth
    await fetchMutation(
      api.threads.autoUpdateThreadTitle,
      {
        threadId,
        title: cleanTitle || "Nuevo Chat",
      },
      { token: accessToken },
    );

    return NextResponse.json({ title: cleanTitle });
  } catch (error) {
    console.error("Error generating title:", error);
    return NextResponse.json(
      { error: "Failed to generate title" },
      { status: 500 },
    );
  }
}

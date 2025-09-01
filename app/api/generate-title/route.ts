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
      prompt: `Generate a short, descriptive title (maximum 3 words) for this conversation based on the user's message. Only respond with the title, no quotes, no markdown, no punctuation:

User message: ${userMessage}`,
      temperature: 0.3,
      maxOutputTokens: 24,
      maxRetries: 3,
    });

    // Clean the generated title - remove any potential markdown, quotes, or symbols
    const cleanTitle = text
      .replace(/[#*_`"'~-]/g, "") // Remove markdown characters
      .replace(/[^\w\s]/g, "") // Remove any non-alphanumeric characters except spaces
      .trim()
      .split(/\s+/) // Split by whitespace
      .slice(0, 3) // Take only first 3 words
      .join(" ")
      .slice(0, 50); // Ensure it's not too long

    // Update the thread title using Convex mutation with auth
    await fetchMutation(
      api.threads.autoUpdateThreadTitle,
      {
        threadId,
        title: cleanTitle || "New Chat",
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

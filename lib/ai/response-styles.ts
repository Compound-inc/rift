/**
 * Response style configuration for AI chat responses.
 * Each style modifies the system prompt to adjust AI response characteristics.
 */

export type ResponseStyle = "regular" | "learning" | "technical" | "concise";

export interface ResponseStyleConfig {
  id: ResponseStyle;
  name: string;
  description: string;
  systemPromptModifier: string;
}

export const RESPONSE_STYLES: Record<ResponseStyle, ResponseStyleConfig> = {
  regular: {
    id: "regular",
    name: "Regular",
    description: "Respuestas equilibradas con estilo de conversación natural",
    systemPromptModifier: "",
  },
  learning: {
    id: "learning",
    name: "Aprendizaje",
    description: "Respuestas explicativas y educativas con ejemplos y contexto",
    systemPromptModifier: `Response Style Guidelines:
- Provide educational, step-by-step explanations
- Include relevant examples and analogies to aid understanding
- Break down complex concepts into digestible parts
- Encourage questions and provide context for better learning
- Use clear structure with headings and bullet points when helpful
- Explain the "why" behind concepts, not just the "what"`,
  },
  technical: {
    id: "technical",
    name: "Técnico",
    description: "Respuestas detalladas y precisas con profundidad técnica y precisión",
    systemPromptModifier: `Response Style Guidelines:
- Provide highly detailed, technically accurate responses
- Use precise terminology and avoid oversimplification
- Include relevant technical specifications, code examples, and implementation details
- Cite sources and reference documentation when applicable
- Structure responses with clear technical sections
- Assume the user has technical background and provide depth accordingly`,
  },
  concise: {
    id: "concise",
    name: "Conciso",
    description: "Respuestas breves y directas que van al grano",
    systemPromptModifier: `Response Style Guidelines:
- Be brief and direct - get straight to the point
- Avoid unnecessary explanations or verbose language
- Use bullet points or numbered lists for clarity
- Focus on key information without extra context
- Skip examples unless specifically requested
- Prioritize essential facts and actionable information`,
  },
};

/**
 * Builds a system prompt by combining base prompt with response style modifier.
 * If style is "regular" or undefined, returns base prompt unchanged.
 */
export function buildSystemPromptWithStyle(
  basePrompt: string | undefined,
  responseStyle: ResponseStyle | undefined = "regular",
): string | undefined {
  if (!basePrompt) {
    return undefined;
  }

  const style = responseStyle || "regular";
  const styleConfig = RESPONSE_STYLES[style];

  // Regular style adds no modifications
  if (style === "regular" || !styleConfig.systemPromptModifier) {
    return basePrompt;
  }

  // Combine base prompt with style modifier
  return `${basePrompt}\n\n${styleConfig.systemPromptModifier}`;
}

/**
 * Gets the display configuration for a response style.
 */
export function getResponseStyleConfig(
  style: ResponseStyle | undefined = "regular",
): ResponseStyleConfig {
  return RESPONSE_STYLES[style || "regular"];
}


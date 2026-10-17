/** Shared tokenizer approximation for RAG, prompt limits, quota, and the UI. */
export const LATIN_CHARS_PER_TOKEN = 4
export const CJK_TOKENS_PER_CHAR = 1.2

const CJK_CHARACTER =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff00-\uffef]/u

/**
 * Latin prose averages four Unicode characters/token. Han, kana and Hangul
 * average roughly 1 to 1.5 tokens/character; use 1.2 consistently across planners.
 * Count Unicode characters rather than UTF-8 bytes or UTF-16 surrogate halves.
 * Context checks add their separate 10% framing/tokenization margin.
 */
export function estimateTokensFromText(text: string): number {
  let cjk = 0
  let other = 0
  for (const character of text) {
    if (CJK_CHARACTER.test(character)) cjk += 1
    else other += 1
  }
  return Math.max(
    1,
    Math.ceil(other / LATIN_CHARS_PER_TOKEN + cjk * CJK_TOKENS_PER_CHAR),
  )
}

/** Largest Unicode-safe prefix whose estimate fits the given token allowance. */
export function textWithinTokenBudget(text: string, maxTokens: number): string {
  if (maxTokens < 1) return ''
  const characters = Array.from(text)
  let low = 0
  let high = characters.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (
      estimateTokensFromText(characters.slice(0, middle).join('')) <= maxTokens
    )
      low = middle
    else high = middle - 1
  }
  return characters.slice(0, low).join('')
}

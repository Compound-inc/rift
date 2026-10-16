import { RAG_CONFIG } from '../domain/config'

/**
 * Signals available to build the text we embed for retrieval.
 */
export type RetrievalQueryInput = {
  /** Latest user message, with `/skill` tokens already expanded. */
  readonly latestUserText: string
  /** The user message before it, used to resolve short follow-ups. */
  readonly previousUserText?: string
  /** Generated thread title; omit while it is still the placeholder. */
  readonly threadTitle?: string
  /** Project custom instruction. */
  readonly customInstruction?: string
  /** Names of the files in play this turn. */
  readonly fileNames?: readonly string[]
}

function clip(text: string | undefined, maxChars: number): string {
  const trimmed = (text ?? '').trim()
  return trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed
}

/**
 * Compose the retrieval query.
 *
 * A substantive message is embedded as-is: appending the thread title or a
 * long project instruction to a specific question only dilutes the vector
 * (measured: a title suffix lowered the matching chunk's score and pushed an
 * unrelated one over the relevance floor). Short or empty messages ("and the
 * second one?", ".", "yes") carry no signal on their own, so they are
 * expanded with the previous user message and the task hints (thread title,
 * file names, project instruction).
 * This is a cheap stand-in for LLM query rewriting that adds no latency.
 */
export function composeRetrievalQuery(input: RetrievalQueryInput): string {
  const { query } = RAG_CONFIG
  const literal = clip(input.latestUserText, query.maxLiteralChars)
  const title = clip(input.threadTitle, query.maxHintChars)

  if (literal.length >= query.substantiveMinChars) return literal

  const fileNames = (input.fileNames ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
  const parts = [
    clip(input.previousUserText, query.maxHintChars),
    literal,
    title ? `Conversation: ${title}` : '',
    fileNames.length > 0 ? `Files: ${fileNames.join(', ')}` : '',
    input.customInstruction
      ? `Task: ${clip(input.customInstruction, query.maxHintChars)}`
      : '',
  ]
  return parts.filter((part) => part.length > 0).join('\n')
}

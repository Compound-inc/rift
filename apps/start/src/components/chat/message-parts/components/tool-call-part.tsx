import { ChevronRight, Code2, Globe, Loader2, Wrench } from 'lucide-react'
import { boundedJson } from '@/lib/shared/chat-contracts/bounded-json'
import { persistToolParts } from '@/lib/shared/chat-contracts/generation-parts'
import type { UIMessage } from 'ai'
import { m } from '@/paraglide/messages.js'

function inputText(
  input: unknown,
  keys: readonly string[],
): string | undefined {
  if (!input || typeof input !== 'object') return undefined
  const record = input as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') return value
    if (Array.isArray(value) && value.every((item) => typeof item === 'string'))
      return value.join(', ')
  }
  if (record.action && typeof record.action === 'object')
    return inputText(record.action, keys)
  return undefined
}

function displayJson(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 8_192)
  return JSON.stringify(boundedJson(value, 8_192), null, 2) ?? ''
}

/** Native disclosures keep completed activity quiet and honor reduced motion. */
export function ToolCallPart({
  part,
  isMessageStreaming,
}: {
  part: UIMessage['parts'][number]
  isMessageStreaming: boolean
}) {
  const stored = persistToolParts([part])[0]
  if (!stored) return null
  const { toolName, state } = stored
  const pending = state === 'input-available'
  const running = pending && isMessageStreaming
  const search = /search|fetch|browse/i.test(toolName)
  const execution = /code|exec|python|bash/i.test(toolName)
  const query =
    inputText(stored.input, ['query', 'queries', 'search_query', 'url']) ??
    inputText(stored.output, ['query', 'queries'])
  const code = execution
    ? inputText(stored.input, ['code', 'command', 'script'])
    : undefined
  const siteCount =
    stored.output &&
    typeof stored.output === 'object' &&
    !Array.isArray(stored.output)
      ? (stored.output as Record<string, unknown>).siteCount
      : undefined
  let label: string
  if (state === 'output-error') {
    label = m.chat_tool_failed({ name: toolName })
  } else if (pending && !running) {
    label = m.chat_tool_interrupted({ name: toolName })
  } else if (search && running) {
    label = query
      ? m.chat_tool_searching_query({ query })
      : m.chat_tool_searching()
  } else if (search) {
    label =
      siteCount === 1
        ? m.chat_tool_searched_site()
        : typeof siteCount === 'number' && siteCount > 0
          ? m.chat_tool_searched_sites({ count: siteCount })
          : m.chat_tool_searched()
  } else if (execution) {
    label = running ? m.chat_tool_executing() : m.chat_tool_executed()
  } else {
    label = running
      ? m.chat_tool_running({ name: toolName })
      : m.chat_tool_completed({ name: toolName })
  }
  const Icon = running ? Loader2 : search ? Globe : execution ? Code2 : Wrench
  return (
    <details className="group min-w-0 text-xs text-foreground-tertiary">
      <summary className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-1 transition-colors hover:text-foreground-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        <Icon
          aria-hidden
          className={`size-3.5 shrink-0 ${running ? 'animate-spin motion-reduce:animate-none' : ''}`}
        />
        <span className="truncate" title={label}>
          {label}
        </span>
        <ChevronRight
          aria-hidden
          className="size-3 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
      </summary>
      <div className="space-y-2 rounded-md bg-surface-raised px-3 py-2">
        {query && !running ? <p className="break-words">{query}</p> : null}
        <p className="font-medium">{m.chat_tool_input()}</p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">
          {code ?? displayJson(stored.input)}
        </pre>
        {stored.output !== undefined ? (
          <>
            <p className="font-medium">{m.chat_tool_output()}</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">
              {displayJson(stored.output)}
            </pre>
          </>
        ) : null}
        {stored.errorText ? (
          <p className="break-words">{stored.errorText}</p>
        ) : null}
      </div>
    </details>
  )
}

import { createExtensionRuntime } from '@mariozechner/pi-coding-agent'
import { getWritingParentPath, normalizeWritingPath } from '@/lib/shared/writing/path-utils'

export function createResourceLoader(input: {
  readonly systemPrompt: string
  readonly appendedPrompts: readonly string[]
}) {
  return {
    getExtensions: () => ({
      extensions: [],
      errors: [],
      runtime: createExtensionRuntime(),
    }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => input.systemPrompt,
    getAppendSystemPrompt: () => [...input.appendedPrompts],
    extendResources: () => {},
    reload: async () => {},
  }
}

export function extractAssistantText(messages: readonly any[]): string {
  const assistant = [...messages]
    .reverse()
    .find((message) => message?.role === 'assistant')
  if (!assistant?.content || !Array.isArray(assistant.content)) {
    return ''
  }

  return assistant.content
    .filter(
      (part: any) => part?.type === 'text' && typeof part.text === 'string',
    )
    .map((part: any) => part.text)
    .join('')
    .trim()
}

export function formatEntryList(
  entries: readonly { path: string; kind: string }[],
  directoryPath: string,
) {
  const normalizedDirectory = normalizeWritingPath(directoryPath)
  const lines = entries
    .filter((entry) => getWritingParentPath(entry.path) === normalizedDirectory)
    .map((entry) => `${entry.kind === 'folder' ? 'dir' : 'file'} ${entry.path}`)

  return lines.length > 0 ? lines.join('\n') : '(empty directory)'
}

export function createToolResult(text: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    details: details ?? {},
  }
}

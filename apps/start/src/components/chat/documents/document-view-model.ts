import type { UIMessage } from 'ai'

export type DocumentPreview = {
  callId: string
  threadId: string
  documentId?: string
  title: string
  kind: 'markdown' | 'code'
  language?: string
  version?: number
  content?: string
  writing: boolean
  failed: boolean
  creating: boolean
  reading?: boolean
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/** Accept partial v7 inputs without mistaking empty content for missing content. */
export function documentPreview(
  part: UIMessage['parts'][number],
  threadId: string,
): DocumentPreview | undefined {
  const name =
    part.type === 'dynamic-tool'
      ? part.toolName
      : part.type.replace(/^tool-/, '')
  if (
    name !== 'create_document' &&
    name !== 'update_document' &&
    name !== 'read_document'
  )
    return undefined
  const value = record(part)
  const input = record(value.input)
  const output = record(value.output)
  return {
    callId: String(value.toolCallId),
    threadId,
    documentId:
      typeof output.documentId === 'string'
        ? output.documentId
        : typeof input.documentId === 'string'
          ? input.documentId
          : undefined,
    title:
      typeof output.title === 'string'
        ? output.title
        : typeof input.title === 'string'
          ? input.title
          : '',
    kind: (input.kind ?? output.kind) === 'code' ? 'code' : 'markdown',
    language: typeof input.language === 'string' ? input.language : undefined,
    version: typeof output.version === 'number' ? output.version : undefined,
    content: typeof input.content === 'string' ? input.content : undefined,
    writing:
      value.state === 'input-streaming' || value.state === 'input-available',
    failed:
      output.ok === false ||
      value.state === 'output-error' ||
      value.state === 'output-denied',
    creating: name === 'create_document',
    reading: name === 'read_document',
  }
}

/** Quoting each line keeps multiline passages distinct from the user's next request. */
export function buildDocumentReference(input: {
  documentId: string
  version: number
  title: string
  passage: string
}): string {
  const passage = input.passage.trim().slice(0, 8000)
  if (!passage) return ''
  return `[Document ${JSON.stringify(input.title)} | ${input.documentId} | v${input.version}]\n${passage
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')}\n\n`
}

export function documentFilename(
  title: string,
  kind: 'markdown' | 'code',
  language?: string,
): string {
  const extensions: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    bash: 'sh',
    shell: 'sh',
    ruby: 'rb',
    rust: 'rs',
    cpp: 'cpp',
    csharp: 'cs',
    go: 'go',
    java: 'java',
    html: 'html',
    css: 'css',
    json: 'json',
    sql: 'sql',
    yaml: 'yml',
    jsx: 'jsx',
    tsx: 'tsx',
    markdown: 'md',
  }
  const extension =
    kind === 'markdown'
      ? 'md'
      : (extensions[language?.toLowerCase() ?? ''] ?? 'txt')
  const safeTitle = Array.from(title)
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('')
  const base =
    safeTitle
      .replace(/[/\\:*?"<>|]/g, '')
      .trim()
      .slice(0, 150) || 'document'
  return base.endsWith(`.${extension}`) ? base : `${base}.${extension}`
}

/** Resolve historical/live content without presenting a current draft as an older version. */
export function documentPanelView(input: {
  preview?: DocumentPreview
  document?: { currentVersion: number }
  versions: readonly { version: number; content: string }[]
  selectedVersion: number | null
}) {
  const latestVersion = Math.max(
    input.document?.currentVersion ?? 0,
    input.preview?.version ?? 0,
    1,
  )
  const version = input.selectedVersion ?? latestVersion
  const storedVersion = input.versions.find((row) => row.version === version)
  const writing = !!input.preview?.writing && input.selectedVersion === null
  const previewContent =
    input.selectedVersion === null && !input.preview?.failed
      ? input.preview?.content
      : undefined
  const content = writing
    ? (previewContent ?? '')
    : (storedVersion?.content ?? previewContent ?? '')
  return {
    latestVersion,
    version,
    writing,
    content,
    available: !!storedVersion || previewContent !== undefined,
    canEdit: !!input.document && !!storedVersion && !input.preview?.writing,
  }
}

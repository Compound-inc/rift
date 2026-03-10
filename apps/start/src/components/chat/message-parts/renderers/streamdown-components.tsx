import { isValidElement, memo } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { bundledLanguages, type BundledLanguage } from 'shiki'
import type { Components } from 'streamdown'
import { cn } from '@rift/utils'
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockFilename,
  CodeBlockFullscreenButton,
  CodeBlockHeader,
  CodeBlockLineWrapButton,
  CodeBlockTitle,
} from '../components/code-block'
import {
  TableBlock,
  TableBlockCopyButton,
  TableBlockDownloadButton,
  TableBlockFloatingControls,
  TableBlockFullscreenButton,
  TableBlockTable,
} from '../components/table-block'
import { m } from '@/paraglide/messages.js'

const LANGUAGE_CLASS_PREFIX = 'language-'
const FALLBACK_LANGUAGE: BundledLanguage = 'markdown'
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
}
const SUPPORTED_LANGUAGES = new Set(Object.keys(bundledLanguages))

function toTextContent(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (!Array.isArray(children)) return ''
  return children.map((child) => toTextContent(child)).join('')
}

function extractLanguage(className?: string): BundledLanguage {
  if (!className) return FALLBACK_LANGUAGE

  const token = className
    .split(/\s+/)
    .find((part) => part.startsWith(LANGUAGE_CLASS_PREFIX))

  const rawLanguage = token
    ? token.slice(LANGUAGE_CLASS_PREFIX.length).trim().toLowerCase()
    : ''

  if (!rawLanguage) return FALLBACK_LANGUAGE

  const normalized = LANGUAGE_ALIASES[rawLanguage] ?? rawLanguage
  if (!SUPPORTED_LANGUAGES.has(normalized)) return FALLBACK_LANGUAGE

  return normalized as BundledLanguage
}

function toLanguageLabel(language: string): string {
  if (!language || language === FALLBACK_LANGUAGE) return m.chat_code_block_language_text_fallback()
  return language
}

const Pre: NonNullable<Components['pre']> = ({ children }) => <>{children}</>

const RenderedCodeBlock = memo(function RenderedCodeBlock({
  code,
  language,
}: {
  code: string
  language: BundledLanguage
}) {
  return (
    <CodeBlock className="my-4" code={code} language={language}>
      <CodeBlockHeader>
        <CodeBlockTitle>
          <CodeBlockFilename>{toLanguageLabel(language)}</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton
            aria-label={m.common_copy()}
            className="h-7 w-7 rounded-md border border-transparent p-1.5 text-foreground-tertiary transition-colors duration-100 hover:bg-surface-raised hover:text-foreground-primary focus-visible:border-border-base focus-visible:ring-0"
            variant="ghost"
          />
          <CodeBlockDownloadButton
            aria-label={m.chat_code_block_download_aria_label()}
            className="h-7 w-7 rounded-md border border-transparent p-1.5 text-foreground-tertiary transition-colors duration-100 hover:bg-surface-raised hover:text-foreground-primary focus-visible:border-border-base focus-visible:ring-0"
            variant="ghost"
          />
          <CodeBlockLineWrapButton
            aria-label={m.chat_code_block_toggle_line_wrap_aria_label()}
            className="h-7 w-7 rounded-md border border-transparent p-1.5 text-foreground-tertiary transition-colors duration-100 hover:bg-surface-raised hover:text-foreground-primary focus-visible:border-border-base focus-visible:ring-0"
            size="icon"
            variant="ghost"
          />
          <CodeBlockFullscreenButton
            aria-label={m.chat_code_block_toggle_fullscreen_aria_label()}
            className="h-7 w-7 rounded-md border border-transparent p-1.5 text-foreground-tertiary transition-colors duration-100 hover:bg-surface-raised hover:text-foreground-primary focus-visible:border-border-base focus-visible:ring-0"
            size="icon"
            variant="ghost"
          />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  )
}, areRenderedCodeBlocksEqual)

function areRenderedCodeBlocksEqual(
  previous: { code: string; language: BundledLanguage },
  next: { code: string; language: BundledLanguage },
): boolean {
  return previous.code === next.code && previous.language === next.language
}

const Code: NonNullable<Components['code']> = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { children?: ReactNode }) => {
  const code = toTextContent(children).replace(/\n$/, '')
  const language = extractLanguage(className)

  const isBlockCode = Boolean(
    className?.includes(LANGUAGE_CLASS_PREFIX) || code.includes('\n'),
  )
  if (!isBlockCode) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }

  return <RenderedCodeBlock code={code} language={language} />
}

function toTableContentSignature(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) {
    return node.map((child) => toTableContentSignature(child)).join('|')
  }
  if (!isValidElement(node)) return ''

  const componentType =
    typeof node.type === 'string'
      ? undefined
      : (node.type as { displayName?: string; name?: string })
  const typeName =
    typeof node.type === 'string'
      ? node.type
      : (componentType?.displayName ?? componentType?.name ?? 'component')
  const propsRecord = node.props as {
    children?: ReactNode
    colSpan?: number
    rowSpan?: number
    align?: string
  }

  return [
    typeName,
    propsRecord.colSpan ?? '',
    propsRecord.rowSpan ?? '',
    propsRecord.align ?? '',
    toTableContentSignature(propsRecord.children),
  ].join(':')
}

const RenderedTableBlock = memo(function RenderedTableBlock({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableElement> & { children?: ReactNode }) {
  return (
    <TableBlock className="my-4" label={m.chat_table_block_label()}>
      <TableBlockFloatingControls>
        <TableBlockCopyButton aria-label={m.chat_table_block_copy_tsv_aria_label()} />
        <TableBlockDownloadButton aria-label={m.chat_table_block_download_csv_aria_label()} />
        <TableBlockFullscreenButton aria-label={m.chat_table_block_toggle_fullscreen_aria_label()} />
      </TableBlockFloatingControls>
      <TableBlockTable className={cn(className)} {...props}>
        {children}
      </TableBlockTable>
    </TableBlock>
  )
}, areRenderedTablesEqual)

function areRenderedTablesEqual(
  previous: HTMLAttributes<HTMLTableElement> & { children?: ReactNode },
  next: HTMLAttributes<HTMLTableElement> & { children?: ReactNode },
): boolean {
  if (previous.className !== next.className) return false
  if (previous.children === next.children) return true
  return toTableContentSignature(previous.children) === toTableContentSignature(next.children)
}

const Table: NonNullable<Components['table']> = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableElement> & { children?: ReactNode }) => (
  <RenderedTableBlock className={className} {...props}>
    {children}
  </RenderedTableBlock>
)

/**
 * Streamdown element overrides used by the chat renderer.
 *
 * We replace fenced code rendering with the shared chat `CodeBlock` component
 * so code snippets have consistent styling/actions across message parts.
 */
export const streamdownStaticComponents: Components = {
  pre: Pre,
  code: Code,
  table: Table,
}

/**
 * Streaming markdown keeps the normal styled codeblock and table renderers,
 * with memo boundaries to avoid repainting unchanged blocks during token flow.
 */
export const streamdownStreamingComponents: Components = {
  pre: Pre,
  code: Code,
  table: Table,
}

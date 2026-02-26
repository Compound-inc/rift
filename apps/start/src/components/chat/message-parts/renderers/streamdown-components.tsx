import type { HTMLAttributes, ReactNode } from 'react'
import { bundledLanguages, type BundledLanguage } from 'shiki'
import type { Components } from 'streamdown'
import { cn } from '@rift/utils'
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockFullscreenButton,
  CodeBlockCopyButton,
  CodeBlockFilename,
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
  if (!language || language === FALLBACK_LANGUAGE) return 'text'
  return language
}

const Pre: NonNullable<Components['pre']> = ({ children }) => <>{children}</>

const Code: NonNullable<Components['code']> = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { children?: ReactNode }) => {
  const code = toTextContent(children).replace(/\n$/, '')
  const language = extractLanguage(className)

  const isBlockCode = Boolean(className?.includes(LANGUAGE_CLASS_PREFIX) || code.includes('\n'))
  if (!isBlockCode) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }

  return (
    <CodeBlock className="my-4" code={code} language={language}>
      <CodeBlockHeader>
        <CodeBlockTitle>
          <CodeBlockFilename>{toLanguageLabel(language)}</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockLineWrapButton
            aria-label="Toggle line wrap"
            className="h-6 w-6 rounded-md border border-transparent p-0 text-content-subtle transition-colors duration-100 hover:bg-bg-muted hover:text-content-default focus-visible:border-border-default focus-visible:ring-0"
            size="icon"
            variant="ghost"
          />
          <CodeBlockFullscreenButton
            aria-label="Toggle fullscreen"
            className="h-6 w-6 rounded-md border border-transparent p-0 text-content-subtle transition-colors duration-100 hover:bg-bg-muted hover:text-content-default focus-visible:border-border-default focus-visible:ring-0"
            size="icon"
            variant="ghost"
          />
          <CodeBlockCopyButton
            aria-label="Copy code"
            className="h-6 w-6 rounded-md border border-transparent p-0 text-content-subtle transition-colors duration-100 hover:bg-bg-muted hover:text-content-default focus-visible:border-border-default focus-visible:ring-0"
            variant="ghost"
          />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  )
}

const Table: NonNullable<Components['table']> = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableElement> & { children?: ReactNode }) => (
  <TableBlock className="my-4" label="Markdown table">
    <TableBlockFloatingControls>
      <TableBlockFullscreenButton aria-label="Toggle table fullscreen" />
      <TableBlockCopyButton aria-label="Copy table as tab-separated text" />
      <TableBlockDownloadButton aria-label="Download table as CSV" />
    </TableBlockFloatingControls>
    <TableBlockTable className={cn(className)} {...props}>
      {children}
    </TableBlockTable>
  </TableBlock>
)

/**
 * Streamdown element overrides used by the TanStack chat renderer.
 *
 * We replace fenced code rendering with the shared chat `CodeBlock` component
 * so code snippets have consistent styling/actions across message parts.
 */
export const streamdownComponents: Components = {
  pre: Pre,
  code: Code,
  table: Table,
}

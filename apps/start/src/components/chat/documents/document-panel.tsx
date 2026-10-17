import { useEffect, useRef, useState } from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Pencil,
  Printer,
  X,
} from 'lucide-react'
import { queries, mutators } from '@/integrations/zero'
import { useRightSidebar } from '@/components/layout/right-sidebar-context'
import { AssistantTextPart } from '../message-parts/renderers/assistant-text-part'
import { CodeBlock } from '../message-parts/components/code-block'
import type { CodeBlockLanguage } from '../message-parts/components/code-block'
import {
  getComposerDraftValue,
  setComposerDraft,
} from '../composer-draft-store'
import { documentContentSchema } from '@/lib/shared/documents/contracts'
import { m } from '@/paraglide/messages.js'
import { useDocumentPreview } from './document-preview-store'
import {
  buildDocumentReference,
  documentFilename,
  documentPanelView,
} from './document-view-model'
import './document-print.css'

/** Zero owns saved versions; partial v7 tool input supplies the live preview. */
export function DocumentPanel({
  callId,
  threadId,
  focusOnOpen = false,
}: {
  callId: string
  threadId: string
  focusOnOpen?: boolean
}) {
  const preview = useDocumentPreview(callId)
  const z = useZero()
  const { close, registerCloseGuard } = useRightSidebar()
  const [documents] = useQuery(queries.documents.byThread({ threadId }))
  const document = documents.find((row) => row.id === preview?.documentId)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const targetVersion =
    selectedVersion ??
    Math.max(document?.currentVersion ?? 0, preview?.version ?? 0, 1)
  const [versionRow, versionsStatus] = useQuery(
    queries.documents.version({
      threadId,
      documentId: preview?.documentId ?? '',
      version: targetVersion,
    }),
  )
  const versions = versionRow ? [versionRow] : []
  const [editor, setEditor] = useState<{
    content: string
    baseVersion: number
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [passage, setPassage] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef(editor)
  editorRef.current = editor
  const title = document?.title ?? preview?.title ?? m.document_untitled()
  const kind = document?.kind ?? preview?.kind ?? 'markdown'
  const language = document?.language ?? preview?.language ?? undefined
  const { latestVersion, version, writing, content, available, canEdit } =
    documentPanelView({ preview, document, versions, selectedVersion })

  useEffect(
    () =>
      registerCloseGuard(() => {
        if (!editorRef.current) return true
        setError(m.document_unsaved())
        return false
      }),
    [registerCloseGuard],
  )

  useEffect(() => {
    const previousFocus = window.document.activeElement
    if (focusOnOpen) closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (editorRef.current) {
        event.preventDefault()
        event.stopPropagation()
        setError(m.document_unsaved())
        return
      }
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      if (
        focusOnOpen &&
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      )
        previousFocus.focus()
    }
  }, [close, focusOnOpen])
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [editor?.content])

  async function save(nextContent: string, baseVersion: number) {
    if (!document || saving) return
    if (!documentContentSchema.safeParse(nextContent).success) {
      setError(m.document_size_limit())
      return
    }
    setError('')
    setSaving(true)
    try {
      const result = await z.mutate(
        mutators.documents.save({
          documentId: document.id,
          threadId,
          expectedVersion: baseVersion,
          content: nextContent,
        }),
      ).server
      if (result.type === 'error') throw new Error('document_save_failed')
      setEditor(null)
      setSelectedVersion(null)
    } catch {
      setError(m.document_save_failed())
    } finally {
      setSaving(false)
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(editor?.content ?? content)
      setCopied(true)
    } catch {
      setError(m.document_action_failed())
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([editor?.content ?? content], {
        type: 'text/plain;charset=utf-8',
      }),
    )
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = documentFilename(title, kind, language)
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function readSelection() {
    const selection = window.getSelection()
    const root = contentRef.current
    setPassage(
      selection &&
        root &&
        selection.anchorNode &&
        selection.focusNode &&
        root.contains(selection.anchorNode) &&
        root.contains(selection.focusNode)
        ? selection.toString().trim().slice(0, 8000)
        : '',
    )
  }
  function ask() {
    if (!document || !passage) return
    const reference = buildDocumentReference({
      documentId: document.id,
      title,
      version,
      passage,
    })
    const draft = getComposerDraftValue()
    setComposerDraft(`${draft}${draft ? '\n\n' : ''}${reference}`)
    setPassage('')
    close()
    // Wait for the mobile dialog's focus restoration before focusing the composer.
    window.setTimeout(
      () =>
        window.document
          .querySelector<HTMLTextAreaElement>(
            'textarea[data-document-composer]',
          )
          ?.focus(),
      0,
    )
  }

  return (
    <section
      className="document-panel flex min-h-0 flex-1 flex-col text-foreground-primary"
      aria-label={title}
    >
      <header className="document-toolbar space-y-2 border-b border-border-base pb-3">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 break-words pt-2 text-base font-medium text-foreground-strong">
            {title || m.document_untitled()}
          </h2>
          <Button
            ref={closeRef}
            size="icon"
            variant="ghost"
            aria-label={m.document_close()}
            onClick={() => (editor ? setError(m.document_unsaved()) : close())}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label={m.document_history()}
          >
            <Button
              size="icon"
              variant="ghost"
              aria-label={m.document_previous_version()}
              disabled={!!editor || writing || version <= 1}
              onClick={() => {
                setSelectedVersion(version - 1)
                setCopied(false)
                setPassage('')
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs tabular-nums">
              {m.document_version({ version })}
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label={m.document_next_version()}
              disabled={!!editor || writing || version >= latestVersion}
              onClick={() => {
                const next = version + 1
                setSelectedVersion(next === latestVersion ? null : next)
                setCopied(false)
                setPassage('')
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label={copied ? m.document_copied() : m.document_copy()}
            title={copied ? m.document_copied() : m.document_copy()}
            disabled={!available}
            onClick={copy}
          >
            <Copy className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={m.document_export()}
            title={m.document_export()}
            disabled={!available}
            onClick={download}
          >
            <Download className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={m.document_print()}
            title={m.document_print()}
            disabled={!available || !!editor}
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={m.document_edit()}
            title={m.document_edit()}
            disabled={!canEdit || version !== latestVersion || !!editor}
            onClick={() => {
              setEditor({ content, baseVersion: latestVersion })
              setError('')
              window.setTimeout(() => textareaRef.current?.focus(), 0)
            }}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
        <div className="text-xs text-foreground-tertiary" role="status">
          {writing
            ? m.document_writing()
            : preview?.failed
              ? m.document_write_failed()
              : kind === 'code'
                ? (language ?? m.document_kind_code())
                : m.document_kind_markdown()}
        </div>
        {selectedVersion !== null && selectedVersion !== latestVersion && (
          <Button
            variant="ghost"
            disabled={!canEdit || saving || !!editor}
            onClick={() => save(content, latestVersion)}
          >
            {m.document_restore()}
          </Button>
        )}
        {editor && (
          <div className="flex gap-2">
            <Button
              disabled={saving}
              onClick={() => save(editor.content, editor.baseVersion)}
            >
              {saving ? m.document_saving() : m.document_save()}
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setEditor(null)
                setError('')
              }}
            >
              {m.document_cancel()}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-foreground-error">
            {error}
          </p>
        )}
      </header>
      {passage && !editor && document && (
        <div className="document-toolbar border-b border-border-base py-1">
          <Button variant="ghost" onClick={ask}>
            {m.document_ask()}
          </Button>
        </div>
      )}
      <div
        className="document-scroll min-h-0 flex-1 overflow-auto py-4"
        onMouseUp={readSelection}
        onTouchEnd={readSelection}
        onKeyUp={readSelection}
      >
        {editor ? (
          <textarea
            ref={textareaRef}
            aria-label={m.document_editor()}
            className="min-h-80 w-full resize-none rounded-md border border-border-base bg-surface-base p-3 font-geist-mono text-sm leading-6 focus-visible:outline-2 focus-visible:outline-accent-primary"
            value={editor.content}
            disabled={saving}
            onChange={(event) =>
              setEditor({ ...editor, content: event.target.value })
            }
          />
        ) : (
          <div
            ref={contentRef}
            className="document-print-content min-w-0 text-sm leading-relaxed"
          >
            <h1 className="document-print-title">{title}</h1>
            {!available && !writing ? (
              <p role="status">
                {versionsStatus.type === 'complete'
                  ? m.document_load_failed()
                  : m.document_loading()}
              </p>
            ) : kind === 'code' ? (
              <CodeBlock
                code={content}
                language={(language ?? 'text') as CodeBlockLanguage}
              />
            ) : (
              <AssistantTextPart text={content} isMessageStreaming={writing} />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

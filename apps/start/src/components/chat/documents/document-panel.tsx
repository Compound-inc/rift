import { useEffect, useRef, useState } from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Pencil,
  Printer,
  X,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
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
  DocumentToolbar,
  DocumentToolbarButton,
  DocumentToolbarDivider,
} from './document-toolbar'
import {
  buildDocumentReference,
  documentFilename,
  documentPanelView,
} from './document-view-model'
import './document-panel.css'
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
      window.setTimeout(() => setCopied(false), 1600)
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

  const kindLabel =
    kind === 'code'
      ? (language ?? m.document_kind_code())
      : m.document_kind_markdown()
  const statusLabel = writing
    ? m.document_writing()
    : preview?.failed
      ? m.document_write_failed()
      : null

  return (
    // The sidebar shell pads its children by 12px (p-3) on desktop and in the
    // mobile dialog. The panel cancels that so the header rule can run edge to
    // edge and the document gets its own reading margins.
    <section
      className="document-panel -m-3 flex min-h-0 flex-1 flex-col text-foreground-primary"
      aria-label={title}
    >
      <header className="document-toolbar border-b border-border-base px-5 pb-3 pt-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="line-clamp-2 text-[15px] font-medium leading-snug text-balance text-foreground-strong">
              {title || m.document_untitled()}
            </h2>
            <p
              className="mt-1 text-xs text-foreground-tertiary tabular-nums"
              role="status"
            >
              {statusLabel ?? kindLabel}
            </p>
          </div>
          <Button
            ref={closeRef}
            size="icon"
            variant="ghost"
            className="-mr-1.5 shrink-0"
            aria-label={m.document_close()}
            onClick={() => (editor ? setError(m.document_unsaved()) : close())}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="mt-3">
          <DocumentToolbar label={m.document_toolbar()}>
            <div
              className="flex items-center"
              role="group"
              aria-label={m.document_history()}
            >
              <DocumentToolbarButton
                label={m.document_previous_version()}
                icon={<ChevronLeft className="size-4" />}
                disabled={!!editor || writing || version <= 1}
                onClick={() => {
                  setSelectedVersion(version - 1)
                  setCopied(false)
                  setPassage('')
                }}
              />
              <span className="min-w-[4.75rem] px-1 text-center text-xs text-foreground-tertiary tabular-nums">
                {m.document_version({ version })}
              </span>
              <DocumentToolbarButton
                label={m.document_next_version()}
                icon={<ChevronRight className="size-4" />}
                disabled={!!editor || writing || version >= latestVersion}
                onClick={() => {
                  const next = version + 1
                  setSelectedVersion(next === latestVersion ? null : next)
                  setCopied(false)
                  setPassage('')
                }}
              />
            </div>
            <DocumentToolbarDivider />
            <DocumentToolbarButton
              label={m.document_edit()}
              icon={<Pencil className="size-3.5" />}
              showLabel
              disabled={!canEdit || version !== latestVersion || !!editor}
              onClick={() => {
                setEditor({ content, baseVersion: latestVersion })
                setError('')
                window.setTimeout(() => textareaRef.current?.focus(), 0)
              }}
            />
            <DocumentToolbarDivider />
            <div className="flex items-center" role="group">
              <DocumentToolbarButton
                label={copied ? m.document_copied() : m.document_copy()}
                icon={<CopyIcon copied={copied} />}
                disabled={!available}
                onClick={copy}
              />
              <DocumentToolbarButton
                label={m.document_export()}
                icon={<Download className="size-4" />}
                disabled={!available}
                onClick={download}
              />
              <DocumentToolbarButton
                label={m.document_print()}
                icon={<Printer className="size-4" />}
                disabled={!available || !!editor}
                onClick={() => window.print()}
              />
            </div>
          </DocumentToolbar>
        </div>
        {selectedVersion !== null && selectedVersion !== latestVersion && (
          <div className="mt-3">
            <Button
              variant="outline"
             
              disabled={!canEdit || saving || !!editor}
              onClick={() => save(content, latestVersion)}
            >
              {m.document_restore()}
            </Button>
          </div>
        )}
        {editor && (
          <div className="mt-3 flex gap-2">
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
          <p role="alert" className="mt-3 text-sm text-foreground-error">
            {error}
          </p>
        )}
      </header>
      {passage && !editor && document && (
        <div className="document-toolbar border-b border-border-base px-5 py-2">
          <Button variant="ghost" className="-ml-2" onClick={ask}>
            {m.document_ask()}
          </Button>
        </div>
      )}
      <div
        className="document-scroll min-h-0 flex-1 overflow-auto px-5 pb-12 pt-5"
        onMouseUp={readSelection}
        onTouchEnd={readSelection}
        onKeyUp={readSelection}
      >
        {editor ? (
          <textarea
            ref={textareaRef}
            aria-label={m.document_editor()}
            className="min-h-80 w-full resize-none rounded-lg border border-border-base bg-surface-base p-4 font-geist-mono text-sm leading-6 focus-visible:outline-2 focus-visible:outline-accent-primary"
            value={editor.content}
            disabled={saving}
            onChange={(event) =>
              setEditor({ ...editor, content: event.target.value })
            }
          />
        ) : (
          <div
            ref={contentRef}
            className="document-print-content min-w-0 text-pretty"
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

/** Copy morphs into a check for a moment after copying (skipped for reduced motion). */
function CopyIcon({ copied }: { readonly copied: boolean }) {
  const reducedMotion = useReducedMotion()
  const hidden = reducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.25, filter: 'blur(4px)' }
  const shown = reducedMotion
    ? { opacity: 1 }
    : { opacity: 1, scale: 1, filter: 'blur(0px)' }
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={copied ? 'check' : 'copy'}
        className="inline-flex"
        initial={hidden}
        animate={shown}
        exit={hidden}
        transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </motion.span>
    </AnimatePresence>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@rocicorp/zero/react'
import {
  BadgeCheck,
  Bot,
  Clock3,
  FileText,
  FolderTree,
  History,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  WandSparkles,
} from 'lucide-react'
import { Button } from '@rift/ui/button'
import { Input } from '@rift/ui/input'
import { Switch } from '@rift/ui/switch'
import { Textarea } from '@rift/ui/textarea'
import { toast } from 'sonner'
import { ContentPage } from '@/components/layout'
import { queries } from '@/integrations/zero'
import {
  acceptWritingHunks,
  createWritingChat,
  createWritingCheckpoint,
  createWritingFolder,
  discardWritingChangeSet,
  manualSaveWritingFile,
  readWritingFile,
  rejectWritingHunks,
  renameWritingProject,
  restoreWritingCheckpoint,
  setWritingAutoAcceptMode,
} from '@/lib/frontend/writing'
import { getWritingHunkPreviewText } from '@/lib/shared/writing'

type WritingWorkspacePageProps = {
  readonly projectId: string
}

function pathDepth(path: string) {
  return Math.max(0, path.split('/').filter(Boolean).length - 1)
}

function statusTone(status: string) {
  if (status === 'applied') return 'bg-emerald-500/10 text-emerald-600'
  if (status === 'conflicted') return 'bg-amber-500/10 text-amber-700'
  if (status === 'rejected') return 'bg-zinc-500/10 text-zinc-600'
  return 'bg-blue-500/10 text-blue-700'
}

function getWritingRouteErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as {
      error?: string | { message?: string }
      requestId?: string
    }
    const baseMessage =
      typeof record.error === 'string'
        ? record.error
        : typeof record.error?.message === 'string'
          ? record.error.message
          : fallback

    if (typeof record.requestId === 'string' && !baseMessage.includes(record.requestId)) {
      return `${baseMessage} (requestId: ${record.requestId})`
    }

    return baseMessage
  }

  return fallback
}

/**
 * Functional workspace shell for v1 writing projects.
 *
 * The page keeps interactions straightforward on purpose: server functions for
 * writes, Zero queries for live state, and a single-screen layout that exposes
 * the full persistence and approval model for developer testing.
 */
export function WritingWorkspacePage({ projectId }: WritingWorkspacePageProps) {
  const renameProjectFn = useServerFn(renameWritingProject)
  const setAutoAcceptModeFn = useServerFn(setWritingAutoAcceptMode)
  const createChatFn = useServerFn(createWritingChat)
  const readFileFn = useServerFn(readWritingFile)
  const saveFileFn = useServerFn(manualSaveWritingFile)
  const createFolderFn = useServerFn(createWritingFolder)
  const createCheckpointFn = useServerFn(createWritingCheckpoint)
  const restoreCheckpointFn = useServerFn(restoreWritingCheckpoint)
  const acceptHunksFn = useServerFn(acceptWritingHunks)
  const rejectHunksFn = useServerFn(rejectWritingHunks)
  const discardChangeSetFn = useServerFn(discardWritingChangeSet)

  const [projectRows] = useQuery(queries.writing.projectById({ projectId }))
  const [entries] = useQuery(queries.writing.entriesByProject({ projectId }))
  const [chats] = useQuery(queries.writing.chatsByProject({ projectId }))
  const [snapshots] = useQuery(queries.writing.snapshotsByProject({ projectId }))
  const [changeSets] = useQuery(queries.writing.changeSetsByProject({ projectId }))

  const project = Array.isArray(projectRows) ? projectRows[0] : projectRows
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [editorValue, setEditorValue] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [chatTitle, setChatTitle] = useState('')
  const [checkpointSummary, setCheckpointSummary] = useState('Checkpoint')
  const [newFolderPath, setNewFolderPath] = useState('/research')
  const [prompt, setPrompt] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [savingFile, setSavingFile] = useState(false)
  const [submittingPrompt, setSubmittingPrompt] = useState(false)

  const actionableChangeSets = useMemo(
    () =>
      changeSets.filter((changeSet: any) =>
        ['pending', 'partially_applied', 'conflicted'].includes(changeSet.status),
      ),
    [changeSets],
  )

  const selectedChangeSetId = useMemo(() => {
    return actionableChangeSets[0]?.id ?? '__none__'
  }, [actionableChangeSets])

  const [messages] = useQuery(
    queries.writing.messagesByChat({ chatId: selectedChatId ?? '__none__' }),
  )
  const [changes] = useQuery(
    queries.writing.changesByChangeSet({ changeSetId: selectedChangeSetId }),
  )
  const [hunks] = useQuery(
    queries.writing.hunksByChangeSet({ changeSetId: selectedChangeSetId }),
  )

  const fileEntries = useMemo(
    () => entries.filter((entry: any) => entry.kind === 'file'),
    [entries],
  )

  useEffect(() => {
    if (project?.title) {
      setProjectTitle(project.title)
    }
  }, [project?.title])

  useEffect(() => {
    if (!selectedChatId && chats[0]?.id) {
      setSelectedChatId(chats[0].id)
    }
  }, [chats, selectedChatId])

  useEffect(() => {
    if (!selectedPath) {
      const preferred = fileEntries[0]
      if (preferred) {
        setSelectedPath(preferred.path)
      }
    }
  }, [fileEntries, selectedPath])

  useEffect(() => {
    if (!selectedPath) {
      return
    }

    let cancelled = false
    setLoadingFile(true)
    readFileFn({
      data: {
        projectId,
        path: selectedPath,
      },
    })
      .then((result) => {
        if (!cancelled) {
          setEditorValue((result as { content: string }).content)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load file')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingFile(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [projectId, readFileFn, selectedPath])

  async function handleRenameProject() {
    if (!projectTitle.trim()) {
      toast.error('Project title is required')
      return
    }
    try {
      await renameProjectFn({
        data: {
          projectId,
          title: projectTitle,
        },
      })
      toast.success('Project renamed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rename project')
    }
  }

  async function handleToggleAutoAccept(enabled: boolean) {
    try {
      await setAutoAcceptModeFn({
        data: {
          projectId,
          enabled,
        },
      })
      toast.success(enabled ? 'Auto-accept enabled' : 'Manual review enabled')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update auto-accept mode')
    }
  }

  async function handleCreateChat() {
    try {
      const result = (await createChatFn({
        data: {
          projectId,
          title: chatTitle || undefined,
        },
      })) as { chatId: string }
      setChatTitle('')
      setSelectedChatId(result.chatId)
      toast.success('Project chat created')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create chat')
    }
  }

  async function handleSaveFile() {
    if (!selectedPath) {
      toast.error('Choose a file first')
      return
    }

    setSavingFile(true)
    try {
      await saveFileFn({
        data: {
          projectId,
          path: selectedPath,
          content: editorValue,
          expectedHeadSnapshotId: project?.headSnapshotId || undefined,
          summary: `Manual edit for ${selectedPath}`,
        },
      })
      toast.success('File saved and checkpointed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save file')
    } finally {
      setSavingFile(false)
    }
  }

  async function handleCreateFolder() {
    try {
      await createFolderFn({
        data: {
          projectId,
          path: newFolderPath,
          expectedHeadSnapshotId: project?.headSnapshotId || undefined,
        },
      })
      toast.success('Folder created')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create folder')
    }
  }

  async function handleCreateCheckpoint() {
    try {
      await createCheckpointFn({
        data: {
          projectId,
          summary: checkpointSummary,
        },
      })
      toast.success('Checkpoint created')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create checkpoint')
    }
  }

  async function handleRestoreSnapshot(snapshotId: string) {
    try {
      await restoreCheckpointFn({
        data: {
          projectId,
          snapshotId,
          expectedHeadSnapshotId: project?.headSnapshotId || undefined,
        },
      })
      toast.success('Checkpoint restored as a new head snapshot')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore checkpoint')
    }
  }

  async function handleSubmitPrompt() {
    if (!selectedChatId || !prompt.trim()) {
      toast.error('Choose a chat and enter a prompt')
      return
    }

    setSubmittingPrompt(true)
    try {
      const response = await fetch('/api/writing/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          chatId: selectedChatId,
          prompt,
        }),
      })
      const payload = await response.json().catch(() => undefined)
      if (!response.ok) {
        throw new Error(getWritingRouteErrorMessage(payload, 'Writing agent request failed'))
      }

      setPrompt('')
      toast.success(
        payload.changeSetId
          ? 'AI changes staged for review'
          : 'AI response completed without file edits',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to run writing agent')
    } finally {
      setSubmittingPrompt(false)
    }
  }

  async function handleAcceptHunks(hunkIds: readonly string[]) {
    if (!selectedChangeSetId || selectedChangeSetId === '__none__') {
      return
    }
    try {
      await acceptHunksFn({
        data: {
          changeSetId: selectedChangeSetId,
          hunkIds: [...hunkIds],
        },
      })
      toast.success('Selected hunks accepted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept hunks')
    }
  }

  async function handleRejectHunks(hunkIds: readonly string[]) {
    if (!selectedChangeSetId || selectedChangeSetId === '__none__') {
      return
    }
    try {
      await rejectHunksFn({
        data: {
          changeSetId: selectedChangeSetId,
          hunkIds: [...hunkIds],
        },
      })
      toast.success('Selected hunks rejected')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject hunks')
    }
  }

  async function handleDiscardChangeSet() {
    if (!selectedChangeSetId || selectedChangeSetId === '__none__') {
      return
    }
    try {
      await discardChangeSetFn({
        data: {
          changeSetId: selectedChangeSetId,
        },
      })
      toast.success('Pending AI changes discarded')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to discard change set')
    }
  }

  return (
    <ContentPage className="lg:pt-6">
      <div className="mb-4">
        <Link
          to="/writing"
          className="text-sm font-medium text-foreground-secondary transition hover:text-foreground-strong"
        >
          ← Back to writing projects
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="space-y-4 rounded-2xl border border-border-base bg-surface-base/95 p-4 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderTree className="size-4 text-foreground-secondary" />
              <h1 className="text-lg font-semibold text-foreground-strong">Project</h1>
            </div>
            <Input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} />
            <Button onClick={handleRenameProject}>
              Rename project
            </Button>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border-base px-3 py-2 text-sm text-foreground-secondary">
              <span>Auto-accept AI changes</span>
              <Switch
                checked={Boolean(project?.autoAcceptMode)}
                onCheckedChange={handleToggleAutoAccept}
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-foreground-secondary" />
              <h2 className="text-sm font-semibold text-foreground-strong">File tree</h2>
            </div>
            <div className="max-h-[380px] space-y-1 overflow-auto rounded-xl border border-border-base bg-surface-muted/50 p-2">
              {entries.map((entry: any) => {
                const depth = pathDepth(entry.path)
                const isFile = entry.kind === 'file'
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => isFile && setSelectedPath(entry.path)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                      selectedPath === entry.path
                        ? 'bg-primary/10 text-foreground-strong'
                        : 'text-foreground-secondary hover:bg-surface-muted'
                    }`}
                    style={{ paddingLeft: `${depth * 14 + 8}px` }}
                  >
                    <span className="shrink-0 text-xs opacity-70">
                      {isFile ? 'md' : 'dir'}
                    </span>
                    <span className="truncate">{entry.path}</span>
                  </button>
                )
              })}
            </div>
            <div className="space-y-2">
              <Input
                value={newFolderPath}
                onChange={(event) => setNewFolderPath(event.target.value)}
                placeholder="/research"
              />
              <Button onClick={handleCreateFolder} variant="outline" className="w-full">
                <Plus className="mr-2 size-4" />
                Create folder
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border-base bg-surface-base/95 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground-strong">
                {selectedPath || 'Markdown editor'}
              </h2>
              <p className="text-sm text-foreground-secondary">
                Manual edits create a new snapshot and stay rollbackable.
              </p>
            </div>
            <Button onClick={handleSaveFile} disabled={savingFile || !selectedPath}>
              <Save className="mr-2 size-4" />
              {savingFile ? 'Saving...' : 'Save file'}
            </Button>
          </div>

          <Textarea
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
            className="min-h-[420px] font-mono text-sm"
            placeholder={loadingFile ? 'Loading file…' : 'Select a markdown file from the tree.'}
          />

          <div className="rounded-2xl border border-border-base bg-surface-muted/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="size-4 text-foreground-secondary" />
              <h3 className="text-sm font-semibold text-foreground-strong">Project chats</h3>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {chats.map((chat: any) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    selectedChatId === chat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-base text-foreground-secondary hover:text-foreground-strong'
                  }`}
                >
                  {chat.title}
                </button>
              ))}
            </div>
            <div className="mb-3 flex gap-2">
              <Input
                value={chatTitle}
                onChange={(event) => setChatTitle(event.target.value)}
                placeholder="New chat title"
              />
              <Button onClick={handleCreateChat} variant="outline">
                Create
              </Button>
            </div>
            <div className="mb-3 max-h-56 space-y-2 overflow-auto rounded-xl border border-border-base bg-surface-base/80 p-3">
              {messages.map((message: any) => (
                <div key={message.id} className="rounded-xl border border-border-base px-3 py-2">
                  <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-foreground-secondary">
                    {message.role === 'assistant' ? <Bot className="size-3.5" /> : <BadgeCheck className="size-3.5" />}
                    {message.role}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground-strong">{message.content}</p>
                </div>
              ))}
              {messages.length === 0 ? (
                <p className="text-sm text-foreground-secondary">
                  No chat messages yet. Ask the AI to revise your project files.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask the AI to revise multiple markdown files, search the project, or draft new sections."
                className="min-h-28"
              />
              <Button onClick={handleSubmitPrompt} disabled={submittingPrompt || !selectedChatId}>
                <WandSparkles className="mr-2 size-4" />
                {submittingPrompt ? 'Running agent...' : 'Ask AI'}
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border-base bg-surface-base/95 p-4 shadow-sm">
          <div className="rounded-2xl border border-border-base bg-surface-muted/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <RefreshCw className="size-4 text-foreground-secondary" />
              <h2 className="text-sm font-semibold text-foreground-strong">Pending AI changes</h2>
            </div>

            <div className="mb-3 space-y-2">
              {actionableChangeSets.map((changeSet: any) => (
                <div key={changeSet.id} className="rounded-xl border border-border-base px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground-strong">{changeSet.summary}</p>
                      <p className="text-xs text-foreground-secondary">{changeSet.id}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone(changeSet.status)}`}>
                      {changeSet.status}
                    </span>
                  </div>
                </div>
              ))}
              {actionableChangeSets.length === 0 ? (
                <p className="text-sm text-foreground-secondary">
                  No AI change sets yet.
                </p>
              ) : null}
            </div>

            <div className="mb-3 space-y-2">
              {changes.map((change: any) => (
                <div key={change.id} className="rounded-xl border border-border-base px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground-strong">{change.path}</span>
                    <span className={`rounded-full px-2 py-1 text-xs ${statusTone(change.status)}`}>
                      {change.operation}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                onClick={() => handleAcceptHunks(hunks.map((hunk: any) => hunk.id))}
                disabled={hunks.length === 0}
              >
                Accept all hunks
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRejectHunks(hunks.map((hunk: any) => hunk.id))}
                disabled={hunks.length === 0}
              >
                Reject all hunks
              </Button>
              <Button
                variant="ghost"
                onClick={handleDiscardChangeSet}
                disabled={!selectedChangeSetId || selectedChangeSetId === '__none__'}
              >
                Discard set
              </Button>
            </div>

            <div className="max-h-[360px] space-y-3 overflow-auto">
              {hunks.map((hunk: any) => (
                <div key={hunk.id} className="rounded-xl border border-border-base bg-surface-base/80 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone(hunk.status)}`}>
                      {hunk.status}
                    </span>
                    <div className="flex gap-2">
                      <Button onClick={() => handleAcceptHunks([hunk.id])}>
                        Accept
                      </Button>
                      <Button variant="outline" onClick={() => handleRejectHunks([hunk.id])}>
                        Reject
                      </Button>
                    </div>
                  </div>
                  <pre className="overflow-auto whitespace-pre-wrap text-xs text-foreground-secondary">
                    {getWritingHunkPreviewText(hunk.patchText) || hunk.patchText}
                  </pre>
                </div>
              ))}
              {hunks.length === 0 ? (
                <p className="text-sm text-foreground-secondary">
                  No pending hunks in the selected change set.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border-base bg-surface-muted/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <History className="size-4 text-foreground-secondary" />
              <h2 className="text-sm font-semibold text-foreground-strong">Checkpoints</h2>
            </div>
            <div className="mb-3 flex gap-2">
              <Input
                value={checkpointSummary}
                onChange={(event) => setCheckpointSummary(event.target.value)}
                placeholder="Checkpoint summary"
              />
              <Button onClick={handleCreateCheckpoint} variant="outline">
                Save
              </Button>
            </div>
            <div className="max-h-[240px] space-y-2 overflow-auto">
              {snapshots.map((snapshot: any) => (
                <div key={snapshot.id} className="rounded-xl border border-border-base px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground-strong">
                        {snapshot.summary}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-foreground-secondary">
                        <Clock3 className="size-3" />
                        {snapshot.source}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => handleRestoreSnapshot(snapshot.id)}>
                      Restore
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </ContentPage>
  )
}

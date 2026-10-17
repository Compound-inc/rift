import { useEffect, useState } from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { Form } from '@rift/ui/form'
import { Button } from '@rift/ui/button'
import { Textarea } from '@rift/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@rift/ui/dialog'
import { ContentPage } from '@/components/layout'
import { mutators, queries } from '@/integrations/zero'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { managePersonalizationMemory } from '@/lib/frontend/settings/personalization/personalization.functions'
import {
  CUSTOM_INSTRUCTION_LIMIT,
  resolveMemoryPolicy,
} from '@/lib/shared/personalization/policy'
import { m } from '@/paraglide/messages.js'

type Instructions = {
  instructionsEnabled: boolean
  aboutYou: string
  responsePreferences: string
}
type MemoryPage = {
  memories: { id: string; text: string }[]
  page: number
  totalPages: number
}
const defaults: Instructions = {
  instructionsEnabled: true,
  aboutYou: '',
  responsePreferences: '',
}

function PersonalizationSettings() {
  const z = useZero()
  const { activeOrganizationId, isAnonymous } = useAppAuth()
  const [stored, instructionsResult] = useQuery(
    queries.personalization.current(),
  )
  const [preference, memoryResult] = useQuery(queries.personalization.memory())
  const [org, orgResult] = useQuery(queries.orgPolicy.current())
  const [draft, setDraft] = useState<Instructions | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [memories, setMemories] = useState<MemoryPage | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const value = draft ?? stored ?? defaults

  useEffect(() => {
    let active = true
    void managePersonalizationMemory({
      data: {
        action: 'status',
        organizationId: activeOrganizationId ?? undefined,
      },
    })
      .then((result) => {
        if (active && 'configured' in result)
          setConfigured(Boolean(result.configured))
      })
      .catch(() => {
        if (active) setError(m.personalization_load_error())
      })
    return () => {
      active = false
    }
  }, [activeOrganizationId])

  const policy = resolveMemoryPolicy({
    configured: configured === true,
    organizationId: activeOrganizationId ?? undefined,
    orgMemoryEnabled: org?.memoryEnabled,
    requireZdr: Boolean(org?.complianceFlags.require_zdr),
    userEnabled: preference?.enabled ?? stored?.memoryDefaultEnabled,
  })
  const memoryExplanation =
    configured === null
      ? m.personalization_loading()
      : policy.reason === 'unconfigured'
        ? m.personalization_memory_unavailable()
        : policy.reason === 'zdr'
          ? m.personalization_memory_zdr()
          : policy.reason === 'organization'
            ? m.personalization_memory_org_disabled()
            : policy.reason === 'no-organization'
              ? m.personalization_memory_no_org()
              : m.personalization_memory_description()
  const canToggleMemory =
    !isAnonymous &&
    configured === true &&
    Boolean(activeOrganizationId) &&
    org?.memoryEnabled !== false &&
    !org?.complianceFlags.require_zdr &&
    instructionsResult.type === 'complete' &&
    memoryResult.type === 'complete' &&
    orgResult.type === 'complete'

  async function perform(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      await action()
    } catch {
      setError(m.personalization_save_error())
    } finally {
      setBusy(false)
    }
  }

  async function loadMemories(page = 1) {
    const result = await managePersonalizationMemory({
      data: {
        action: 'list',
        page,
        organizationId: activeOrganizationId ?? undefined,
      },
    })
    if (result.page) setMemories(result.page)
  }

  return (
    <ContentPage
      title={m.personalization_title()}
      description={m.personalization_description()}
    >
      {error && (
        <p role="alert" className="text-sm text-foreground-error">
          {error}
        </p>
      )}
      <Form
        title={m.personalization_instructions_title()}
        description={m.personalization_instructions_description()}
        headerToggle={{
          checked: value.instructionsEnabled,
          onCheckedChange: (checked) => {
            setDraft({ ...value, instructionsEnabled: checked })
            setSaved(false)
          },
          disabled:
            busy || isAnonymous || instructionsResult.type !== 'complete',
          enabledLabel: m.personalization_on(),
          disabledLabel: m.personalization_off(),
        }}
        contentSlot={
          <div className="space-y-5">
            {(['aboutYou', 'responsePreferences'] as const).map((field) => {
              const label =
                field === 'aboutYou'
                  ? m.personalization_about_you()
                  : m.personalization_respond()
              return (
                <div key={field} className="space-y-2">
                  <label
                    htmlFor={field}
                    className="text-sm font-medium text-foreground-strong"
                  >
                    {label}
                  </label>
                  <Textarea
                    id={field}
                    value={value[field]}
                    maxLength={CUSTOM_INSTRUCTION_LIMIT}
                    rows={4}
                    disabled={
                      busy ||
                      isAnonymous ||
                      instructionsResult.type !== 'complete'
                    }
                    aria-describedby={`${field}-count`}
                    onChange={(event) => {
                      setDraft({ ...value, [field]: event.target.value })
                      setSaved(false)
                    }}
                  />
                  <p
                    id={`${field}-count`}
                    className="text-right text-xs tabular-nums text-foreground-tertiary"
                  >
                    {m.personalization_character_count({
                      count: value[field].length,
                      limit: CUSTOM_INSTRUCTION_LIMIT,
                    })}
                  </p>
                </div>
              )
            })}
          </div>
        }
        forceActions
        buttonText={
          busy ? m.personalization_saving() : m.personalization_save()
        }
        buttonDisabled={busy || !draft || isAnonymous}
        success={saved ? m.personalization_saved() : undefined}
        onSubmit={(event) => {
          event.preventDefault()
          void perform(async () => {
            const result = await z.mutate(
              mutators.personalization.saveInstructions({
                instructionsEnabled: value.instructionsEnabled,
                aboutYou: value.aboutYou,
                responsePreferences: value.responsePreferences,
              }),
            ).server
            if (result.type === 'error') throw new Error('Save failed')
            setDraft(null)
            setSaved(true)
          })
        }}
      />
      <Form
        title={m.personalization_memory_title()}
        description={memoryExplanation}
        helpText={m.personalization_memory_privacy()}
        headerToggle={{
          checked: policy.enabled,
          onCheckedChange: (enabled) =>
            void perform(async () => {
              const result = await z.mutate(
                mutators.personalization.setMemoryEnabled({ enabled }),
              ).server
              if (result.type === 'error') throw new Error('Save failed')
            }),
          disabled: busy || !canToggleMemory,
          enabledLabel: m.personalization_on(),
          disabledLabel: m.personalization_off(),
        }}
        contentSlot={
          configured !== null && activeOrganizationId ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !configured}
                  onClick={() => void perform(() => loadMemories())}
                >
                  {m.personalization_manage_memories()}
                </Button>
                <Button
                  type="button"
                  variant="dangerLight"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  {m.personalization_delete_all()}
                </Button>
              </div>
              {memories && (
                <div aria-live="polite">
                  {!memories.memories.length && (
                    <p className="text-sm text-foreground-tertiary">
                      {m.personalization_memories_empty()}
                    </p>
                  )}
                  <ul className="divide-y divide-border-base">
                    {memories.memories.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 py-3">
                        <p className="min-w-0 flex-1 break-words text-sm">
                          {item.text}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-10 shrink-0"
                          disabled={busy}
                          aria-label={m.personalization_delete_memory({
                            memory: item.text.slice(0, 80),
                          })}
                          onClick={() =>
                            void perform(async () => {
                              await managePersonalizationMemory({
                                data: {
                                  action: 'delete',
                                  id: item.id,
                                  organizationId:
                                    activeOrganizationId ?? undefined,
                                },
                              })
                              await loadMemories(memories.page)
                            })
                          }
                        >
                          {m.personalization_delete()}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {memories.totalPages > 1 && (
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy || memories.page <= 1}
                        onClick={() =>
                          void perform(() => loadMemories(memories.page - 1))
                        }
                      >
                        {m.personalization_previous()}
                      </Button>
                      <span className="text-xs tabular-nums">
                        {m.personalization_page({
                          page: memories.page,
                          total: memories.totalPages,
                        })}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy || memories.page >= memories.totalPages}
                        onClick={() =>
                          void perform(() => loadMemories(memories.page + 1))
                        }
                      >
                        {m.personalization_next()}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : undefined
        }
      />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent showCloseButton={false}>
          <DialogTitle>{m.personalization_delete_all_question()}</DialogTitle>
          <DialogDescription>
            {m.personalization_delete_all_description()}
          </DialogDescription>
          {error && (
            <p role="alert" className="text-sm text-foreground-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              {m.personalization_cancel()}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await managePersonalizationMemory({
                    data: {
                      action: 'delete-all',
                      organizationId: activeOrganizationId ?? undefined,
                    },
                  })
                  setMemories({ memories: [], page: 1, totalPages: 0 })
                  setConfirmDelete(false)
                })
              }
            >
              {busy
                ? m.personalization_deleting()
                : m.personalization_delete_all()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentPage>
  )
}

/** Remount org-specific state on workspace changes; no old memory list may persist. */
export function PersonalizationPage() {
  const { user, activeOrganizationId } = useAppAuth()
  return <PersonalizationSettings key={`${user?.id}:${activeOrganizationId}`} />
}

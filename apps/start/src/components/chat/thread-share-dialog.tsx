import { useEffect, useState } from 'react'
import { Button } from '@rift/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@rift/ui/dialog'
import { Label } from '@rift/ui/label'
import { Switch } from '@rift/ui/switch'
import { RadioGroup, RadioGroupItem } from '@rift/ui/radio-group'
import { copyToClipboard } from '@rift/utils'
import { toast } from 'sonner'
import { manageThreadShare } from '@/lib/frontend/thread-sharing/thread-sharing.functions'
import { shareReasonMessage } from '@/lib/frontend/thread-sharing/share-reason-message'
import { m } from '@/paraglide/messages.js'

type Settings = Exclude<
  Awaited<ReturnType<typeof manageThreadShare>>,
  { error: unknown }
>
const OPEN_EVENT = 'rift:share-thread'

/** The dialog lives outside row menus so closing a menu cannot unmount it. */
export function openThreadShare(threadId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: threadId }))
}
export function ThreadShareDialogHost() {
  const [threadId, setThreadId] = useState<string | null>(null)
  useEffect(() => {
    const open = (event: Event) =>
      setThreadId((event as CustomEvent<string>).detail)
    window.addEventListener(OPEN_EVENT, open)
    return () => window.removeEventListener(OPEN_EVENT, open)
  }, [])
  return threadId ? (
    <ThreadShareDialog
      key={threadId}
      threadId={threadId}
      onClose={() => setThreadId(null)}
    />
  ) : null
}

function ThreadShareDialog({
  threadId,
  onClose,
}: {
  threadId: string
  onClose: () => void
}) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [orgOnly, setOrgOnly] = useState(false)
  const [shareName, setShareName] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void manageThreadShare({ data: { threadId, action: 'settings' } })
      .then((value) => {
        if (cancelled) return
        if ('error' in value) {
          setFailed(shareReasonMessage(value.error))
          return
        }
        setSettings(value)
        setOrgOnly(
          value.publicSharingAllowed ? value.orgOnly : value.hasOrganization,
        )
        setShareName(value.shareName)
      })
      .catch(() => {
        if (!cancelled) setFailed(m.share_failed())
      })
    return () => {
      cancelled = true
    }
  }, [threadId])
  const save = async (action: 'activate' | 'revoke') => {
    setBusy(true)
    try {
      const next = await manageThreadShare({
        data: { threadId, action, orgOnly, shareName },
      })
      if ('error' in next) {
        toast.error(shareReasonMessage(next.error))
        return
      }
      setSettings(next)
      setOrgOnly(
        next.publicSharingAllowed ? next.orgOnly : next.hasOrganization,
      )
      setShareName(next.shareName)
    } catch {
      toast.error(m.share_failed())
    } finally {
      setBusy(false)
    }
  }
  const url = settings?.shareId
    ? `${window.location.origin}/share/${settings.shareId}`
    : null
  const dirty =
    settings &&
    (settings.orgOnly !== orgOnly || settings.shareName !== shareName)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogTitle>{m.share_title()}</DialogTitle>
        <DialogDescription>{m.share_description()}</DialogDescription>
        {!settings ? (
          <p role="status">{failed ?? m.share_loading()}</p>
        ) : (
          <>
            <fieldset disabled={busy} className="space-y-3">
              <legend className="mb-2 font-medium">{m.share_audience()}</legend>
              <RadioGroup
                aria-label={m.share_audience()}
                value={orgOnly ? 'workspace' : 'public'}
                onValueChange={(value) => setOrgOnly(value === 'workspace')}
                disabled={busy || Boolean(settings.activationBlockedReason)}
              >
                {[false, ...(settings.hasOrganization ? [true] : [])].map(
                  (value) => (
                    <label
                      key={String(value)}
                      className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border-base px-3 has-[[data-checked]]:border-accent-primary has-[[data-checked]]:bg-surface-info/25 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
                    >
                      <RadioGroupItem
                        aria-label={value ? m.share_org() : m.share_public()}
                        value={value ? 'workspace' : 'public'}
                        disabled={!value && !settings.publicSharingAllowed}
                      />
                      {value ? m.share_org() : m.share_public()}
                    </label>
                  ),
                )}
              </RadioGroup>
              <div className="flex min-h-10 items-center justify-between gap-4">
                <Label htmlFor="share-name">{m.share_name()}</Label>
                <Switch
                  id="share-name"
                  checked={shareName}
                  onCheckedChange={setShareName}
                />
              </div>
            </fieldset>
            {settings.publicSharingBlockedReason && (
              <p className="text-sm text-foreground-secondary">
                {shareReasonMessage(settings.publicSharingBlockedReason)}
              </p>
            )}
            {settings.activationBlockedReason && (
              <p className="text-sm text-foreground-secondary">
                {shareReasonMessage(settings.activationBlockedReason)}
              </p>
            )}
            {url && (
              <input
                aria-label={m.share_copy()}
                readOnly
                value={url}
                className="w-full rounded-lg border border-border-base bg-surface-base p-2 text-sm"
                onFocus={(event) => event.target.select()}
              />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {url && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void save('revoke')}
                >
                  {m.share_revoke()}
                </Button>
              )}
              {url && !dirty ? (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void copyToClipboard(url)
                      .then(() => toast.success(m.share_copied()))
                      .catch(() => toast.error(m.share_failed()))
                  }
                >
                  {m.share_copy()}
                </Button>
              ) : (
                <Button
                  disabled={
                    busy ||
                    Boolean(settings.activationBlockedReason) ||
                    (!orgOnly && !settings.publicSharingAllowed)
                  }
                  onClick={() => void save('activate')}
                >
                  {url ? m.share_save() : m.share_create()}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

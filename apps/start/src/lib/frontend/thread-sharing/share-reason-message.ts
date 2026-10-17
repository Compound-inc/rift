import type { ShareActionReason } from '@/lib/shared/thread-sharing/reasons'
import { m } from '@/paraglide/messages.js'

/** Resolve at render time so settings and action failures follow the current locale. */
export function shareReasonMessage(reason: ShareActionReason): string {
  const messages = {
    instance_locked: m.share_reason_instance_locked,
    workspace_policy: m.share_reason_workspace_policy,
    anonymous_owner: m.share_reason_anonymous_owner,
    rate_limited: m.share_reason_rate_limited,
    wrong_workspace: m.share_reason_wrong_workspace,
    too_large: m.share_reason_too_large,
  } satisfies Record<ShareActionReason, () => string>
  return messages[reason]()
}

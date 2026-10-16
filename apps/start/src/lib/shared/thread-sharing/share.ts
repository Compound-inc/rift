import { resolveCanonicalBranch } from '@/lib/shared/chat-branching/branch-resolver'
import type { BranchableMessage } from '@/lib/shared/chat-branching/branch-resolver'

export const PUBLIC_SHARING_DISABLED_FLAG = 'disable_public_sharing'

export type ShareSubject = {
  shareId?: string | null
  shareStatus?: 'active' | 'revoked' | null
  sharedAt?: number | null
  orgOnly?: boolean | null
  ownerOrgId?: string | null
}

/** Membership comes from the database, never the viewer's selected organization. */
export function canReadShare(
  thread: ShareSubject | null | undefined,
  viewer: {
    userId?: string
    isAnonymous: boolean
    isMember: boolean
  },
): boolean {
  if (!thread?.shareId || thread.shareStatus !== 'active') return false
  return (
    !thread.orgOnly ||
    Boolean(
      thread.ownerOrgId &&
      viewer.userId &&
      !viewer.isAnonymous &&
      viewer.isMember,
    )
  )
}

/** Revoked tokens are never reused. Keeping an active token makes settings edits stable. */
export function activateShare(
  current: ShareSubject,
  now: number,
  newId: () => string,
) {
  const active = current.shareStatus === 'active' && current.shareId
  return {
    shareId: active ? current.shareId! : newId(),
    shareStatus: 'active' as const,
    sharedAt: active ? (current.sharedAt ?? now) : now,
    // File access needs a share-aware download endpoint. Until then share names only.
    allowAttachments: false,
  }
}

export type ShareMessageSource = BranchableMessage & {
  content: string
  status: string
  attachmentsIds?: readonly string[]
}
export type SharedMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  attachmentNames: string[]
}

/**
 * Resolve lineage before filtering deleted messages so their children cannot
 * become roots or cause another branch to be selected. Only completed text is
 * published; reasoning, tools, sources and error payloads stay private.
 */
export function buildSharedMessages(
  messages: readonly ShareMessageSource[],
  activeChildByParent: unknown,
  attachments: readonly {
    id: string
    fileName: string
    status: string | null
  }[],
): SharedMessage[] {
  const names = new Map(
    attachments
      .filter((a) => a.status !== 'deleted')
      .map((a) => [a.id, a.fileName]),
  )
  return resolveCanonicalBranch(messages, activeChildByParent)
    .canonicalMessages.filter(
      (message) => message.status === 'done' && message.role !== 'system',
    )
    .map((message) => ({
      id: message.messageId,
      role: message.role as 'user' | 'assistant',
      text: message.content,
      attachmentNames: (message.attachmentsIds ?? []).flatMap((id) =>
        names.has(id) ? [names.get(id)!] : [],
      ),
    }))
}

export type SharedThread = {
  title: string
  sharedAt: number
  orgOnly: boolean
  sharerName: string | null
  messages: SharedMessage[]
}

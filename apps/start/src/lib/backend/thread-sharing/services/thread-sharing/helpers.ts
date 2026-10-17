import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import type { ZeroServerTransaction } from '@/lib/backend/chat/infra/zero/db'
import type { ServerAuthContext } from '@/lib/backend/server-effect/http/auth-context'
import { getPublicInstanceEnvironmentSnapshot } from '@/lib/backend/self-host/instance-settings.service'
import {
  buildSharedMessages,
  canReadShare,
  PUBLIC_SHARING_DISABLED_FLAG,
} from '@/lib/shared/thread-sharing/share'
import type { SharedThread } from '@/lib/shared/thread-sharing/share'
import { ShareActionError, ShareUnavailableError } from '../../domain/errors'

export const MAX_SHARE_MESSAGES = 300
export const MAX_SHARE_ATTACHMENTS = 600
export const MAX_SHARE_BYTES = 4 * 1024 * 1024
export const FORK_WINDOW_MS = 5 * 60 * 1000
export const unavailable = () =>
  new ShareUnavailableError({ message: 'Share unavailable' })
export type OwnerInput = { threadId: string; viewer: ServerAuthContext }

export async function publicAppLocked() {
  const instance = await getPublicInstanceEnvironmentSnapshot()
  return instance.instanceMode === 'self_hosted' && instance.publicAppLocked
}

export async function loadOwnedThread(
  tx: ZeroServerTransaction,
  input: OwnerInput,
) {
  const { viewer } = input
  if (!viewer.userId) throw unavailable()
  const thread = await tx.run(
    zql.thread
      .where('threadId', input.threadId)
      .where('userId', viewer.userId)
      .one(),
  )
  if (!thread || (thread.ownerOrgId ?? undefined) !== viewer.organizationId)
    throw unavailable()
  if (thread.projectId) {
    const project = await tx.run(
      zql.project.where('id', thread.projectId).one(),
    )
    if (!project || project.deletedAt != null) throw unavailable()
  }
  if (thread.ownerOrgId) {
    const membership =
      !viewer.isAnonymous &&
      (await tx.run(
        zql.member
          .where('organizationId', thread.ownerOrgId)
          .where('userId', viewer.userId)
          .one(),
      ))
    if (!membership) throw unavailable()
  }
  return thread
}

/** Missing source organizations fail closed, including after the source is deleted. */
export async function publicPolicyAllowed(
  tx: ZeroServerTransaction,
  organizationIds: readonly string[],
) {
  for (const organizationId of new Set(organizationIds)) {
    const org = await tx.run(zql.organization.where('id', organizationId).one())
    if (!org) return false
    const policy = await tx.run(
      zql.orgAiPolicy.where('organizationId', organizationId).one(),
    )
    if (policy?.complianceFlags[PUBLIC_SHARING_DISABLED_FLAG]) return false
  }
  return true
}

export function sourceOrganizations(thread: {
  ownerOrgId?: string | null
  shareProvenance?: { organizationIds: readonly string[] } | null
}) {
  return [
    ...new Set([
      ...(thread.shareProvenance?.organizationIds ?? []),
      ...(thread.ownerOrgId ? [thread.ownerOrgId] : []),
    ]),
  ]
}

const tooLarge = () =>
  new ShareActionError({
    code: 'too_large',
    message:
      'This conversation is too large to share or continue. The limit is 300 messages, 600 attachments and 4 MB.',
  })

/** Check sizes in Postgres before materializing message bodies or private payloads. */
async function assertBounded(
  tx: ZeroServerTransaction,
  threadId: string,
  userId: string,
) {
  const { rows } = await tx.dbTransaction.wrappedTransaction.query<{
    messages: string
    attachments: string
    bytes: string
  }>(
    `
    WITH m AS (SELECT * FROM messages WHERE thread_id = $1 AND user_id = $2 LIMIT $3),
         a AS (SELECT * FROM attachments WHERE thread_id = $1 AND user_id = $2 LIMIT $4)
    SELECT (SELECT count(*) FROM m) AS messages,
           (SELECT count(*) FROM a) AS attachments,
           (COALESCE((SELECT sum(octet_length(row_to_json(m)::text)) FROM m), 0) +
            COALESCE((SELECT sum(octet_length(row_to_json(a)::text)) FROM a), 0)) AS bytes
  `,
    [threadId, userId, MAX_SHARE_MESSAGES + 1, MAX_SHARE_ATTACHMENTS + 1],
  )
  const size = rows[0]
  if (
    Number(size.messages) > MAX_SHARE_MESSAGES ||
    Number(size.attachments) > MAX_SHARE_ATTACHMENTS ||
    Number(size.bytes) > MAX_SHARE_BYTES
  )
    throw tooLarge()
}

export async function loadSharedThread(
  tx: ZeroServerTransaction,
  shareId: string,
  viewer: ServerAuthContext,
) {
  if ((await publicAppLocked()) && (!viewer.userId || viewer.isAnonymous))
    throw unavailable()
  const thread = await tx.run(zql.thread.where('shareId', shareId).one())
  const membership =
    thread?.orgOnly && thread.ownerOrgId && viewer.userId && !viewer.isAnonymous
      ? await tx.run(
          zql.member
            .where('organizationId', thread.ownerOrgId)
            .where('userId', viewer.userId)
            .one(),
        )
      : null
  if (
    !thread ||
    !canReadShare(thread, { ...viewer, isMember: Boolean(membership) })
  )
    throw unavailable()
  if (thread.ownerOrgId) {
    const org = await tx.run(
      zql.organization.where('id', thread.ownerOrgId).one(),
    )
    const owner = await tx.run(
      zql.member
        .where('organizationId', thread.ownerOrgId)
        .where('userId', thread.userId)
        .one(),
    )
    if (!org || !owner) throw unavailable()
  }
  if (thread.projectId) {
    const project = await tx.run(
      zql.project.where('id', thread.projectId).one(),
    )
    if (!project || project.deletedAt != null) throw unavailable()
  }
  const publicSharingAllowed = await publicPolicyAllowed(
    tx,
    sourceOrganizations(thread),
  )
  if (!thread.orgOnly && !publicSharingAllowed) throw unavailable()
  await assertBounded(tx, thread.threadId, thread.userId)
  const rows = await tx.run(
    zql.message
      .where('threadId', thread.threadId)
      .where('userId', thread.userId)
      .limit(MAX_SHARE_MESSAGES + 1),
  )
  const attachments = await tx.run(
    zql.attachment
      .where('threadId', thread.threadId)
      .where('userId', thread.userId)
      .limit(MAX_SHARE_ATTACHMENTS + 1),
  )
  // Recheck the bounded rows because another transaction can append after preflight.
  if (
    rows.length > MAX_SHARE_MESSAGES ||
    attachments.length > MAX_SHARE_ATTACHMENTS ||
    new TextEncoder().encode(JSON.stringify([rows, attachments])).byteLength >
      MAX_SHARE_BYTES
  )
    throw tooLarge()
  const owner = thread.shareName
    ? await tx.run(zql.user.where('id', thread.userId).one())
    : null
  const snapshot: SharedThread = {
    title: thread.title,
    sharedAt: thread.sharedAt ?? thread.createdAt,
    orgOnly: thread.orgOnly ?? false,
    sharerName: owner?.name ?? null,
    messages: buildSharedMessages(
      rows.map((row) => ({ ...row, createdAt: row.created_at })),
      thread.activeChildByParent,
      attachments,
    ),
  }
  return { thread, snapshot, publicSharingAllowed }
}

const markdown = unified().use(remarkParse)

/** Remove parsed HTML nodes, including comments and hidden HTML blocks, while
 * preserving markdown and literal HTML examples inside code spans/fences. */
export function sanitizeForkText(text: string): string {
  const tree = markdown.parse(text)
  const ranges: { start: number; end: number }[] = []
  const openElements: { tag: string; start: number }[] = []
  const voidElements = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ])
  function visit(
    node: {
      type: string
      value?: string
      position?: { start: { offset?: number }; end: { offset?: number } }
      children?: readonly (typeof node)[]
    },
    parentType?: string,
  ) {
    if (
      node.type === 'html' &&
      node.position?.start.offset != null &&
      node.position.end.offset != null
    ) {
      const start = node.position.start.offset
      const end = node.position.end.offset
      ranges.push({ start, end })
      const value = node.value ?? ''
      const closing = /^<\/([a-z][\w-]*)\s*>$/i.exec(value)
      const opening = /^<([a-z][\w-]*)\b/i.exec(value)
      if (closing) {
        const index = openElements.map(element => element.tag).lastIndexOf(closing[1].toLowerCase())
        if (index !== -1) {
          ranges.push({ start: openElements[index].start, end })
          openElements.splice(index)
        }
      } else if (
        opening &&
        parentType &&
        !['root', 'blockquote', 'listItem'].includes(parentType) &&
        !value.endsWith('/>') &&
        !voidElements.has(opening[1].toLowerCase())
      ) {
        openElements.push({ tag: opening[1].toLowerCase(), start })
      }
    } else node.children?.forEach((child) => visit(child, node.type))
  }
  visit(tree)
  // Drop element contents too: CSS/hidden attributes can conceal text between inline tags.
  for (const element of openElements)
    ranges.push({ start: element.start, end: text.length })
  const merged: { start: number; end: number }[] = []
  for (const range of ranges.sort((a, b) => a.start - b.start)) {
    const previous = merged.at(-1)
    if (previous && range.start <= previous.end)
      previous.end = Math.max(previous.end, range.end)
    else merged.push({ ...range })
  }
  for (const { start, end } of merged.reverse())
    text = text.slice(0, start) + text.slice(end)
  return text
}

import { Link } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@rift/ui/dialog'
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CircleAlert,
} from 'lucide-react'
import type { SingularityUserListItem } from '../shared/singularity-admin'
import { formatSingularityDate } from './singularity-format'
import { SingularityCopyButton, SingularityStatus } from './singularity-ui'

/** User inspection stays read-only; workspace membership actions retain their existing authorization. */
export function SingularityUserDialog({
  user,
  onClose,
}: {
  user: SingularityUserListItem | undefined
  onClose: () => void
}) {
  return (
    <Dialog
      open={user != null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none sm:max-w-xl">
        {user && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 pr-7">
                <Avatar className="size-11">
                  <AvatarImage src={user.image ?? undefined} alt="" />
                  <AvatarFallback>
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <DialogTitle className="break-words">{user.name}</DialogTitle>
                  <DialogDescription className="mt-1 break-all text-foreground-tertiary">
                    {user.email}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <dl className="space-y-3 rounded-lg bg-surface-overlay p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-xs text-foreground-tertiary">User ID</dt>
                <dd className="flex min-w-0 items-center gap-1 break-all">
                  {user.userId}
                  <SingularityCopyButton
                    value={user.userId}
                    label="Copy user ID"
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-foreground-tertiary">Registered</dt>
                <dd>{formatSingularityDate(user.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs text-foreground-tertiary">
                  Email verification
                </dt>
                <dd className="inline-flex items-center gap-1.5">
                  {user.emailVerified ? (
                    <CheckCircle2 className="size-3.5" aria-hidden />
                  ) : (
                    <CircleAlert className="size-3.5" aria-hidden />
                  )}
                  {user.emailVerified ? 'Verified' : 'Unverified'}
                </dd>
              </div>
            </dl>
            <section aria-label="Workspace memberships" className="space-y-3">
              <h3 className="text-sm font-medium text-foreground-strong">
                Workspace memberships{' '}
                <span className="ml-1 text-foreground-tertiary">
                  {user.memberships.length}
                </span>
              </h3>
              {!user.memberships.length && (
                <p className="rounded-lg border border-border-base p-4 text-sm text-foreground-tertiary">
                  This account has not joined a workspace.
                </p>
              )}
              {user.memberships.map((membership) => (
                <Link
                  key={membership.memberId}
                  to="/singularity/orgs/$organizationId"
                  params={{ organizationId: membership.organizationId }}
                  search={{ tab: 'members', member: user.email }}
                  className="flex items-center gap-3 rounded-lg border border-border-base p-3 outline-none transition-colors hover:bg-surface-inverse/5 focus-visible:ring-2 focus-visible:ring-border-strong"
                >
                  <Building2
                    className="size-4 shrink-0 text-foreground-tertiary"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground-strong">
                      {membership.organizationName}
                    </p>
                    <p className="mt-1 text-xs capitalize text-foreground-tertiary">
                      {membership.role}
                    </p>
                    {membership.accessReason && (
                      <p className="mt-1 text-xs text-foreground-tertiary">
                        {membership.accessReason.replaceAll('_', ' ')}
                      </p>
                    )}
                  </div>
                  <SingularityStatus
                    warning={membership.accessStatus !== 'active'}
                  >
                    {membership.accessStatus === 'active'
                      ? 'Active'
                      : 'Restricted'}
                  </SingularityStatus>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-foreground-tertiary"
                    aria-hidden
                  />
                </Link>
              ))}
              {user.memberships.length > 0 && (
                <p className="text-xs text-foreground-tertiary">
                  Open a workspace to manage this person's role or access.
                </p>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

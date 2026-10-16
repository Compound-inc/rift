import { useMemo, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Button } from '@rift/ui/button'
import { Input } from '@rift/ui/input'
import { Label } from '@rift/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rift/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@rift/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rift/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@rift/ui/table'
import {
  Download,
  LoaderCircle,
  MoreHorizontal,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import {
  getDefaultAuthDisplayName,
  isValidEmailAddress,
} from '@/components/auth/auth-shared'
import type { SingularityOrganizationDetail } from '../shared/singularity-admin'
import { matchesSingularitySearch } from '../shared/singularity-search'
import type { SingularityOrgActions } from './singularity-org-detail-page.logic'
import {
  SingularityConfirmDialog,
  SingularityEmpty,
  SingularityPagination,
  SingularitySearch,
  SingularityStatus,
} from './singularity-ui'
import { downloadSingularityCsv } from './singularity-export'

type DirectoryRow = {
  id: string
  name: string
  email: string
  userId: string
  image: string | null
  role: string
  status: 'active' | 'restricted' | 'pending'
  reason: string | null
  kind: 'member' | 'invitation'
}

type DirectoryAction = {
  row: DirectoryRow
  type: 'remove' | 'cancel' | 'role'
  role?: 'admin' | 'member'
}

/** Keep pending invitations visible even if an existing member has the same email. */
export function buildSingularityDirectory(
  organization: SingularityOrganizationDetail,
): Array<DirectoryRow> {
  return [
    ...organization.members.map(
      (member): DirectoryRow => ({
        id: member.memberId,
        userId: member.userId,
        name: member.name,
        email: member.email,
        image: member.image,
        role: member.role,
        status:
          member.accessStatus.toLowerCase() === 'active'
            ? 'active'
            : 'restricted',
        reason: member.accessReason,
        kind: 'member',
      }),
    ),
    ...organization.invitations
      .filter((invitation) => invitation.status.toLowerCase() === 'pending')
      .map(
        (invitation): DirectoryRow => ({
          id: invitation.invitationId,
          userId: '',
          name: getDefaultAuthDisplayName(invitation.email),
          email: invitation.email,
          image: null,
          role: invitation.role,
          status: 'pending',
          reason: null,
          kind: 'invitation',
        }),
      ),
  ].sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  )
}

function SingularityInviteDialog({
  organization,
  actions,
  open,
  onOpenChange,
}: {
  organization: SingularityOrganizationDetail
  actions: SingularityOrgActions
  open: boolean
  onOpenChange: (value: boolean) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const availableSeats = Math.max(
    0,
    organization.seatCount -
      organization.memberCount -
      organization.pendingInvitationCount,
  )
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!actions.isPending) onOpenChange(value)
      }}
    >
      <DialogContent
        showCloseButton={!actions.isPending}
        className="motion-reduce:animate-none sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Invite to {organization.name}</DialogTitle>
          <DialogDescription className="text-foreground-tertiary">
            Send a workspace invitation by email.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            if (await actions.handleInvite(email, role)) {
              setEmail('')
              setRole('member')
              onOpenChange(false)
            }
          }}
          className="space-y-4"
          aria-busy={actions.isPending}
        >
          <div className="space-y-2">
            <Label htmlFor="singularity-invite-email">Email address</Label>
            <Input
              id="singularity-invite-email"
              type="email"
              required
              maxLength={320}
              autoComplete="email"
              placeholder="person@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={actions.isPending || actions.needsRefresh}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="singularity-invite-role">Workspace role</Label>
            <Select
              value={role}
              onValueChange={(value) =>
                setRole(value === 'admin' ? 'admin' : 'member')
              }
            >
              <SelectTrigger
                id="singularity-invite-role"
                className="w-full"
                disabled={actions.isPending || actions.needsRefresh}
              >
                <SelectValue>
                  {role === 'admin' ? 'Admin' : 'Member'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-foreground-tertiary">
              {role === 'admin'
                ? 'Admins can manage members and workspace settings.'
                : 'Members can use the workspace without managing its settings.'}
            </p>
          </div>
          <p className="rounded-lg bg-surface-overlay p-3 text-xs text-foreground-tertiary">
            {availableSeats > 0
              ? `${availableSeats} seat${availableSeats === 1 ? '' : 's'} available. Pending invitations reserve a seat.`
              : 'No seats available. Increase the seat limit in Billing before inviting another member.'}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="large"
              disabled={actions.isPending || actions.needsRefresh}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="large"
              className="gap-2"
              disabled={
                actions.isPending ||
                actions.needsRefresh ||
                availableSeats === 0 ||
                !isValidEmailAddress(email)
              }
            >
              {actions.isPending && (
                <LoaderCircle
                  className="size-4 motion-safe:animate-spin"
                  aria-hidden
                />
              )}
              {actions.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function SingularityMemberDirectory({
  organization,
  actions,
  initialQuery = '',
}: {
  organization: SingularityOrganizationDetail
  actions: SingularityOrgActions
  initialQuery?: string
}) {
  const rows = useMemo(
    () => buildSingularityDirectory(organization),
    [organization],
  )
  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState('all')
  const [role, setRole] = useState('all')
  const [requestedPage, setPage] = useState(1)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [action, setAction] = useState<DirectoryAction | null>(null)
  const filtered = rows.filter(
    (row) =>
      (filter === 'all' ||
        (filter === 'members'
          ? row.kind === 'member'
          : row.status === filter)) &&
      (role === 'all' || row.role === role) &&
      matchesSingularitySearch(query, [
        row.name,
        row.email,
        row.userId,
        row.id,
        row.role,
        row.reason ?? '',
      ]),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25))
  const page = Math.min(requestedPage, pageCount)
  const owners = organization.members.filter(
    (member) => member.role.toLowerCase() === 'owner',
  ).length
  const restricted = rows.filter((row) => row.status === 'restricted').length
  return (
    <section aria-label="Member directory" className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-foreground-strong">
            People & invitations
          </h2>
          <p className="mt-1 text-sm text-foreground-tertiary">
            {organization.memberCount} members ·{' '}
            {organization.pendingInvitationCount} pending invitations
            {restricted > 0 && ` · ${restricted} restricted`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="large"
            className="gap-2"
            disabled={!filtered.length}
            onClick={() =>
              downloadSingularityCsv('singularity-members.csv', [
                ['Name', 'Email', 'Role', 'Status', 'User ID', 'Reason'],
                ...filtered.map((row) => [
                  row.name,
                  row.email,
                  row.role,
                  row.status,
                  row.userId,
                  row.reason ?? '',
                ]),
              ])
            }
          >
            <Download aria-hidden />
            Export
          </Button>
          <Button
            type="button"
            size="large"
            className="gap-2"
            disabled={actions.isPending || actions.needsRefresh}
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus aria-hidden />
            Invite member
          </Button>
        </div>
      </header>
      <div className="flex flex-col gap-2 sm:flex-row">
        <SingularitySearch
          value={query}
          label="Search people"
          placeholder="Search name, email, or user ID…"
          onChange={(value) => {
            setQuery(value)
            setPage(1)
          }}
        />
        <Select
          value={filter}
          onValueChange={(value) => {
            setFilter(value ?? 'all')
            setPage(1)
          }}
        >
          <SelectTrigger
            className="h-10 min-w-36"
            aria-label="Filter member status"
          >
            <SelectValue>
              {
                {
                  all: 'Everyone',
                  members: 'Members',
                  pending: 'Invitations',
                  restricted: 'Restricted access',
                }[filter]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="members">Members</SelectItem>
            <SelectItem value="pending">Invitations</SelectItem>
            <SelectItem value="restricted">Restricted access</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={role}
          onValueChange={(value) => {
            setRole(value ?? 'all')
            setPage(1)
          }}
        >
          <SelectTrigger
            className="h-10 min-w-28"
            aria-label="Filter member role"
          >
            <SelectValue>
              {role === 'all'
                ? 'All roles'
                : role.charAt(0).toUpperCase() + role.slice(1)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-hidden rounded-xl border border-border-base">
        {!filtered.length ? (
          <SingularityEmpty
            title="No people found"
            description="Try another search or change the status and role filters."
            action={
              (query || filter !== 'all' || role !== 'all') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="large"
                  onClick={() => {
                    setQuery('')
                    setFilter('all')
                    setRole('all')
                    setPage(1)
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-raised">
                <TableHead className="pl-5">Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice((page - 1) * 25, page * 25).map((row) => (
                <TableRow key={`${row.kind}:${row.id}`}>
                  <TableCell className="py-3 pl-5">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarImage src={row.image ?? undefined} alt="" />
                        <AvatarFallback className="text-xs">
                          {row.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="max-w-64 truncate font-medium text-foreground-strong">
                          {row.name}
                        </div>
                        <div className="mt-0.5 text-xs text-foreground-tertiary">
                          {row.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 capitalize">
                      {row.role === 'owner' && (
                        <ShieldCheck
                          className="size-3.5 text-foreground-tertiary"
                          aria-hidden
                        />
                      )}
                      {row.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <SingularityStatus warning={row.status === 'restricted'}>
                      {row.status === 'pending'
                        ? 'Invited'
                        : row.status === 'restricted'
                          ? 'Restricted'
                          : 'Active'}
                    </SingularityStatus>
                    {row.reason && (
                      <p className="mt-1 max-w-64 whitespace-normal text-xs text-foreground-tertiary">
                        {row.reason.replaceAll('_', ' ')}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${row.email}`}
                            disabled={actions.isPending || actions.needsRefresh}
                          >
                            <MoreHorizontal aria-hidden />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        {row.kind === 'member' && row.role !== 'owner' && (
                          <DropdownMenuItem
                            onClick={() =>
                              setAction({
                                row,
                                type: 'role',
                                role: row.role === 'admin' ? 'member' : 'admin',
                              })
                            }
                          >
                            {row.role === 'admin'
                              ? 'Change to member'
                              : 'Make admin'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={
                            row.kind === 'member' &&
                            row.role === 'owner' &&
                            owners <= 1
                          }
                          onClick={() =>
                            setAction({
                              row,
                              type: row.kind === 'member' ? 'remove' : 'cancel',
                            })
                          }
                        >
                          {row.kind === 'invitation'
                            ? 'Cancel invitation'
                            : row.kind === 'member' &&
                                row.role === 'owner' &&
                                owners <= 1
                              ? 'Last owner is protected'
                              : 'Remove member'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <SingularityPagination
        page={page}
        pageCount={pageCount}
        count={filtered.length}
        pageSize={25}
        onPageChange={setPage}
      />
      <SingularityInviteDialog
        organization={organization}
        actions={actions}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
      <SingularityConfirmDialog
        open={action != null}
        onOpenChange={(value) => {
          if (!value) setAction(null)
        }}
        title={
          action?.type === 'role'
            ? 'Change workspace role?'
            : action?.type === 'cancel'
              ? 'Cancel invitation?'
              : 'Remove workspace member?'
        }
        description={action ? `${action.row.email} · ${organization.name}` : ''}
        confirmLabel={
          action?.type === 'role'
            ? `Change to ${action.role}`
            : action?.type === 'cancel'
              ? 'Cancel invitation'
              : 'Remove member'
        }
        danger={action?.type !== 'role'}
        isPending={actions.isPending}
        onConfirm={() => {
          if (!action) return Promise.resolve(false)
          if (action.type === 'role')
            return actions.handleRoleChange(action.row.id, action.role!)
          return action.type === 'cancel'
            ? actions.handleCancelInvitation(action.row.id)
            : actions.handleRemoveMember(action.row.id)
        }}
      >
        <p className="text-sm text-foreground-primary">
          {action?.type === 'role'
            ? action.role === 'admin'
              ? 'This person will be able to manage members and workspace settings.'
              : 'This person will lose admin permissions and keep member access.'
            : action?.type === 'cancel'
              ? 'This invitation will no longer be valid. You can send a new invitation later.'
              : 'This person will lose access to the workspace. They can be invited again later.'}
        </p>
      </SingularityConfirmDialog>
    </section>
  )
}

'use client'

import { Button } from '@rift/ui/button'
import { FormDialog } from '@rift/ui/dialog'
import { Input } from '@rift/ui/input'
import { Label } from '@rift/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rift/ui/select'
import { Plus, UserPlus } from 'lucide-react'
import {
  INVITE_BATCH_MAX,
  INVITE_ROLES,
  useInviteMembersDialogLogic,
} from './invite-members-dialog.logic'


export function InviteMembersDialog() {
  const {
    inviteDialogOpen,
    onDialogOpenChange,
    inviteEntries,
    setInviteEntryEmail,
    setInviteEntryRole,
    addInviteEntry,
    submitButtonDisabled,
    submitError,
    submitSuccess,
    handleSubmit,
  } = useInviteMembersDialogLogic()

  return (
    <FormDialog
      open={inviteDialogOpen}
      onOpenChange={onDialogOpenChange}
      trigger={
        <Button variant="default">
          <UserPlus aria-hidden />
          Invite members
        </Button>
      }
      title="Invite member"
      description="Send an invitation to join this organization."
      buttonText="Send invitation"
      submitButtonDisabled={submitButtonDisabled}
      error={submitError}
      success={submitSuccess}
      handleSubmit={handleSubmit}
    >
      <div className="space-y-3">
        <Label>Email address</Label>
        <div className="space-y-2">
          {inviteEntries.map((entry) => (
            <div key={entry.id} className="flex gap-2">
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={entry.email}
                onChange={(e) => setInviteEntryEmail(entry.id, e.target.value)}
                autoComplete="email"
                className="flex-1 min-w-0"
              />
              <Select
                value={entry.role}
                onValueChange={(value) =>
                  setInviteEntryRole(entry.id, value ?? 'member')
                }
              >
                <SelectTrigger className="w-28 shrink-0" size="default">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="default"
          className="border border-border-base"
          disabled={inviteEntries.length >= INVITE_BATCH_MAX}
          onClick={addInviteEntry}
        >
          <Plus aria-hidden className="size-4" />
          Add another
        </Button>
      </div>
    </FormDialog>
  )
}

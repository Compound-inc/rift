import { CheckIcon, CopyIcon, EditIcon, RedoIcon } from '@rift/ui/icons/svg-icons'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import {
  MessageActionButton,
  MessageActions,
} from './message-actions-primitives'
import { useMessageCopyAction } from './use-message-copy-action'
import { m } from '@/paraglide/messages.js'

const PENDING_REGEN_BRANCH_PREFIX = '__pending_regen_branch__'
const PENDING_EDIT_BRANCH_PREFIX = '__pending_edit_branch__'

type UserMessageActionsProps = {
  messageId: string
  text: string
  canRegenerate: boolean
  canEdit: boolean
  isEditing: boolean
  isSavingEdit: boolean
  onRegenerate: (messageId: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onConfirmEdit: () => void
  branchSelector?: {
    optionMessageIds: readonly string[]
    selectedMessageId: string
    disabled?: boolean
    onSelectMessageId: (messageId: string) => void
  }
}

/**
 * User-message action cluster.
 */
export function UserMessageActions({
  messageId,
  text,
  canRegenerate,
  canEdit,
  isEditing,
  isSavingEdit,
  onRegenerate,
  onStartEdit,
  onCancelEdit,
  onConfirmEdit,
  branchSelector,
}: UserMessageActionsProps) {
  const { isCopied, copy } = useMessageCopyAction(text)
  const actionButtonClassName = 'h-8 w-8 p-0'
  const optionIds = branchSelector?.optionMessageIds ?? []
  const selectedIndex = optionIds.findIndex(
    (optionMessageId) => optionMessageId === branchSelector?.selectedMessageId,
  )
  const selectedOptionIndex = selectedIndex >= 0 ? selectedIndex : optionIds.length - 1
  const totalOptions = optionIds.length
  const selectedDisplayIndex =
    totalOptions > 0 ? Math.max(0, selectedOptionIndex) + 1 : 0
  const selectedOptionId = totalOptions > 0 ? optionIds[selectedOptionIndex] : undefined
  const isPendingSelectedOption =
    !!selectedOptionId &&
    (selectedOptionId.startsWith(PENDING_REGEN_BRANCH_PREFIX) ||
      selectedOptionId.startsWith(PENDING_EDIT_BRANCH_PREFIX))
  const canNavigateBranches =
    !!branchSelector &&
    totalOptions > 1 &&
    !isEditing &&
    !isPendingSelectedOption &&
    !branchSelector.disabled

  const findNavigableIndex = (
    startIndex: number,
    step: 1 | -1,
  ): number | null => {
    if (!branchSelector) return null
    for (
      let index = startIndex + step;
      index >= 0 && index < optionIds.length;
      index += step
    ) {
      const candidate = optionIds[index]
      if (
        !candidate.startsWith(PENDING_REGEN_BRANCH_PREFIX) &&
        !candidate.startsWith(PENDING_EDIT_BRANCH_PREFIX)
      ) {
        return index
      }
    }
    return null
  }

  const previousIndex = canNavigateBranches
    ? findNavigableIndex(selectedOptionIndex, -1)
    : null
  const nextIndex = canNavigateBranches
    ? findNavigableIndex(selectedOptionIndex, 1)
    : null

  return (
    <div className="flex w-full flex-col items-end gap-2">
      <div className="flex items-center justify-end gap-2">
        <MessageActions className="justify-end py-1 opacity-0 transition-opacity group-hover:opacity-100">
          {isEditing ? (
            <>
              <MessageActionButton
                tooltip={m.chat_message_action_cancel_edit()}
                label={m.chat_message_action_cancel_edit()}
                className={actionButtonClassName}
                size="default"
                disabled={isSavingEdit}
                onClick={onCancelEdit}
              >
                <XIcon className="size-4" />
              </MessageActionButton>
              <MessageActionButton
                tooltip={isSavingEdit ? m.chat_message_action_saving() : m.chat_message_action_save_edit()}
                label={isSavingEdit ? m.chat_message_action_saving_edit() : m.chat_message_action_save_edit()}
                variant="default"
                className={actionButtonClassName}
                size="default"
                disabled={!canEdit || isSavingEdit}
                onClick={onConfirmEdit}
              >
                <CheckIcon className="size-4" />
              </MessageActionButton>
            </>
          ) : (
            <>
              <MessageActionButton
                tooltip={m.chat_message_action_regenerate()}
                label={m.chat_message_action_regenerate()}
                className={actionButtonClassName}
                size="default"
                disabled={!canRegenerate}
                onClick={() => {
                  if (!canRegenerate) return
                  onRegenerate(messageId)
                }}
              >
                <RedoIcon className="size-4" />
              </MessageActionButton>
              <MessageActionButton
                tooltip={m.chat_message_action_edit_message()}
                label={m.chat_message_action_edit_message()}
                className={actionButtonClassName}
                size="default"
                disabled={!canEdit}
                onClick={() => {
                  if (!canEdit) return
                  onStartEdit()
                }}
              >
                <EditIcon className="size-4" />
              </MessageActionButton>
              <MessageActionButton
                tooltip={m.chat_message_action_copy_text()}
                label={m.chat_message_action_copy_text()}
                className={actionButtonClassName}
                size="default"
                onClick={() => {
                  void copy()
                }}
              >
                {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              </MessageActionButton>
            </>
          )}
        </MessageActions>
        {!isEditing && branchSelector && branchSelector.optionMessageIds.length > 1 ? (
          <div className="flex items-center gap-0 py-1">
            <MessageActionButton
              tooltip={m.chat_message_action_previous_branch_version()}
              label={m.chat_message_action_previous_branch_version()}
              className={actionButtonClassName}
              size="default"
              disabled={!canNavigateBranches || previousIndex == null}
              onClick={() => {
                if (!branchSelector || previousIndex == null) return
                const targetId = optionIds[previousIndex]
                if (!targetId) return
                branchSelector.onSelectMessageId(targetId)
              }}
            >
              <ChevronLeftIcon className="size-4 rtl:scale-x-[-1]" aria-hidden />
            </MessageActionButton>
            <div className="flex h-8 min-w-10 items-center justify-center rounded-lg px-0.5 text-sm text-foreground-secondary">
              {selectedDisplayIndex}/{totalOptions}
            </div>
            <MessageActionButton
              tooltip={m.chat_message_action_next_branch_version()}
              label={m.chat_message_action_next_branch_version()}
              className={actionButtonClassName}
              size="default"
              disabled={!canNavigateBranches || nextIndex == null}
              onClick={() => {
                if (!branchSelector || nextIndex == null) return
                const targetId = optionIds[nextIndex]
                if (!targetId) return
                branchSelector.onSelectMessageId(targetId)
              }}
            >
              <ChevronRightIcon className="size-4 rtl:scale-x-[-1]" aria-hidden />
            </MessageActionButton>
          </div>
        ) : null}
      </div>
    </div>
  )
}

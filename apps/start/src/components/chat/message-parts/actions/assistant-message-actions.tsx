import { memo, useCallback, useRef } from 'react'
import { CheckIcon, CopyIcon, RedoIcon } from '@rift/ui/icons/svg-icons'
import {
  MessageActionButton,
  MessageActions,
} from './message-actions-primitives'
import { useMessageCopyAction } from './use-message-copy-action'
import { m } from '@/paraglide/messages.js'

type AssistantMessageActionsProps = {
  messageId: string
  text: string
  modelName?: string | null
  canRegenerate: boolean
  onRegenerate: (messageId: string) => void
}

/**
 * Assistant-message action cluster plus optional model caption.
 */
type AssistantMessageActionsInnerProps = {
  messageId: string
  modelName?: string | null
  canRegenerate: boolean
  onRegenerate: (messageId: string) => void
  getText: () => string
}

const AssistantMessageActionsInner = memo(function AssistantMessageActionsInner({
  messageId,
  modelName,
  canRegenerate,
  onRegenerate,
  getText,
}: AssistantMessageActionsInnerProps) {
  const { isCopied, copy } = useMessageCopyAction(getText)

  return (
    <div className="flex items-center gap-2">
      <MessageActions className="mt-1 opacity-0 transition-opacity group-hover:opacity-100">
        <MessageActionButton
          tooltip={m.chat_message_action_regenerate()}
          label={m.chat_message_action_regenerate()}
          disabled={!canRegenerate}
          onClick={() => {
            if (!canRegenerate) return
            onRegenerate(messageId)
          }}
        >
          <RedoIcon className="size-4" />
        </MessageActionButton>
        <MessageActionButton
          tooltip={m.chat_message_action_copy_text()}
          label={m.chat_message_action_copy_text()}
          onClick={() => {
            void copy()
          }}
        >
          {isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
        </MessageActionButton>
      </MessageActions>
      {modelName ? (
        <span className="mt-1 text-sm text-foreground-secondary opacity-0 transition-opacity group-hover:opacity-100">
          {modelName}
        </span>
      ) : null}
    </div>
  )
},
areAssistantMessageActionsEqual)

function areAssistantMessageActionsEqual(
  previous: AssistantMessageActionsInnerProps,
  next: AssistantMessageActionsInnerProps,
): boolean {
  return (
    previous.messageId === next.messageId &&
    previous.modelName === next.modelName &&
    previous.canRegenerate === next.canRegenerate &&
    previous.onRegenerate === next.onRegenerate &&
    previous.getText === next.getText
  )
}

export function AssistantMessageActions({
  messageId,
  text,
  modelName,
  canRegenerate,
  onRegenerate,
}: AssistantMessageActionsProps) {
  const latestTextRef = useRef(text)
  latestTextRef.current = text

  const getText = useCallback(() => latestTextRef.current, [])

  return (
    <AssistantMessageActionsInner
      messageId={messageId}
      modelName={modelName}
      canRegenerate={canRegenerate}
      onRegenerate={onRegenerate}
      getText={getText}
    />
  )
}

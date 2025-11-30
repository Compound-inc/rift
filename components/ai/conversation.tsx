'use client';

import { Button } from '@/components/ai/ui/button';
import { cn } from '@/lib/utils';
import { ArrowDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useCallback } from 'react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn(
      'relative h-full w-full flex-1 min-h-0 min-w-0 max-w-[100vw] overflow-x-hidden',
      className
    )}
    initial="instant"
    resize="instant"
    role="log"
    {...props}
  />
);

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content
    className={cn(
      'p-4 w-full min-w-0 max-w-[100vw] overflow-x-hidden',
      className
    )}
    {...props}
  />
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        className={cn(
          'absolute bottom-32 left-[50%] translate-x-[-50%] rounded-full z-20',
          className
        )}
        onClick={handleScrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
};
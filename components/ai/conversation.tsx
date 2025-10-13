'use client';

import { Button } from '@/components/ai/ui/button';
import { cn } from '@/lib/utils';
import { ArrowDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useCallback } from 'react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';

export type ConversationProps = ComponentProps<typeof StickToBottom> & {
  children?: React.ReactNode;
};

export const Conversation = ({ className, children, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn('relative h-full flex-1 min-h-0', className)}
    initial="instant"
    resize="smooth"
    role="log"
    {...props}
  >
    {children}
  </StickToBottom>
);

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
> & {
  children?: React.ReactNode;
};

export const ConversationContent = ({
  className,
  children,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content className={cn('relative h-full flex-1 min-h-0 overflow-y-auto flex flex-col-reverse', className)} {...props}>
    <div className="mx-auto w-full max-w-3xl p-4 pb-30">
      {children}
    </div>
  </StickToBottom.Content>
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
          'absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full',
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

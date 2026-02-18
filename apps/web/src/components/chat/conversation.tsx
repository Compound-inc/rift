'use client';

import { cn } from '@rift/utils';
import { forwardRef, type ComponentProps } from 'react';

export type ConversationProps = ComponentProps<'div'>;

export const Conversation = forwardRef<HTMLDivElement, ConversationProps>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative h-full w-full flex-1 min-h-0 min-w-0 max-w-[100vw] overflow-y-auto',
        className
      )}
      style={{
        scrollbarGutter: 'stable both-edges',
        overflowAnchor: 'none',
        ...style,
      }}
      role="log"
      {...props}
    />
  )
);
Conversation.displayName = 'Conversation';

export type ConversationContentProps = ComponentProps<'div'> & {
  withScrollAnchor?: boolean;
};

export const ConversationContent = forwardRef<HTMLDivElement, ConversationContentProps>(
  ({ className, children, withScrollAnchor = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'p-4 w-full min-w-0 max-w-[100vw] overflow-x-hidden',
        className
      )}
      {...props}
    >
      {children}
      {withScrollAnchor && (
        <div 
          aria-hidden="true"
          style={{ height: 1, overflowAnchor: 'auto', contain: 'strict' }} 
        />
      )}
    </div>
  )
);
ConversationContent.displayName = 'ConversationContent';

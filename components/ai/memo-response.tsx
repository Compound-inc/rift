'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo } from 'react';
import { Streamdown } from '@/components/streamdown/memo-streamdown';

type ResponseProps = Omit<ComponentProps<typeof Streamdown>, 'children'> & {
  messageId: string;
  partIdx: number;
};

export const MemoResponse = memo(
  ({ className, messageId, partIdx, ...props }: ResponseProps) => (
    <Streamdown
      messageId={messageId}
      partIdx={partIdx}
      className={cn(
        'size-full min-w-0 max-w-full break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-[16px] leading-[28px] font-normal tracking-[0.015em] proportional-nums',
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.messageId === nextProps.messageId &&
    prevProps.partIdx === nextProps.partIdx
);

MemoResponse.displayName = 'MemoResponse';


import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@rift/ui/avatar';
import { cn } from '@rift/utils';
import type { UIMessage } from 'ai';
import type { ComponentProps, HTMLAttributes } from 'react';

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage['role'];
};

export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        'group flex w-full min-w-0 max-w-full items-end justify-end gap-2',
        from === 'user' ? 'is-user' : 'is-assistant flex-row-reverse justify-end',
        from === 'assistant' ? '[&>div]:w-full' : '[&>div]:max-w-[80%]',
        className
      )}
      {...props}
    />
  );
}

export type MessageContentProps = HTMLAttributes<HTMLDivElement> & {
  from?: UIMessage['role'];
};

export function MessageContent({ children, className, from, ...props }: MessageContentProps) {
  return (
    <div
      className={cn(
        'group flex min-w-0 max-w-full flex-col gap-2 px-1 text-foreground text-sm break-words',
        from === 'user'
          ? 'bg-hover text-secondary rounded-lg py-3 px-4 dark:bg-popover-main dark:text-popover-text dark:border-popover-secondary shadow-sm overflow-hidden'
          : 'bg-transparent text-foreground py-0 overflow-visible',
        'is-user:dark',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export function MessageAvatar({ src, name, className, ...props }: MessageAvatarProps) {
  return (
    <Avatar className={cn('size-8 ring-1 ring-border', className)} {...props}>
      <AvatarImage alt="" className="mt-0 mb-0" src={src} />
      <AvatarFallback>{name?.slice(0, 2) || 'ME'}</AvatarFallback>
    </Avatar>
  );
}

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ai/ui/avatar';
import { cn } from '@/lib/utils';
import type { UIMessage } from 'ai';
import type { ComponentProps, HTMLAttributes } from 'react';

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage['role'];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      'group flex w-full items-end justify-end gap-2',
      from === 'user' ? 'is-user' : 'is-assistant flex-row-reverse justify-end',
      from === 'assistant' ? '[&>div]:w-full' : '[&>div]:max-w-[80%]',
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement> & {
  from?: UIMessage['role'];
};

export const MessageContent = ({
  children,
  className,
  from,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      'group flex flex-col gap-2 overflow-hidden px-4 text-foreground text-sm',
      from === 'user' 
        ? 'bg-hover text-secondary rounded-lg py-3' 
        : 'bg-transparent text-foreground py-0',
      'is-user:dark',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn('size-8 ring-1 ring-border', className)} {...props}>
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || 'ME'}</AvatarFallback>
  </Avatar>
);

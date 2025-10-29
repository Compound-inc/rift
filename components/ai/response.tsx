'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo } from 'react';
import { Streamdown } from 'streamdown';

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
    controls={false}
      className={cn(
        'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-[16px] leading-[28px] [&_h1]:mt-12 [&_h1]:mb-6 [&_h2]:mt-12 [&_h2]:mb-6 [&_h3]:mt-12 [&_h3]:mb-6',
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = 'Response';

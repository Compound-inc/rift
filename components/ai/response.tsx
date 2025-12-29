'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo, useEffect, useRef } from 'react';
import { Streamdown } from 'streamdown';

type ResponseProps = ComponentProps<typeof Streamdown> & {
  onReady?: () => void;
};

export const Response = memo(
  ({ className, onReady, ...props }: ResponseProps) => {
    const hasNotifiedRef = useRef(false);

    useEffect(() => {
      if (onReady && !hasNotifiedRef.current) {
        let timeoutId: NodeJS.Timeout | null = null;
        let rafId2: number | null = null;
        
        const rafId1 = requestAnimationFrame(() => {
          rafId2 = requestAnimationFrame(() => {
            timeoutId = setTimeout(() => {
              if (!hasNotifiedRef.current) {
                hasNotifiedRef.current = true;
                onReady();
              }
            }, 0);
          });
        });
        
        return () => {
          cancelAnimationFrame(rafId1);
          if (rafId2 !== null) cancelAnimationFrame(rafId2);
          if (timeoutId) clearTimeout(timeoutId);
        };
      }
    }, [onReady]);

    return (
      <Streamdown
        controls={false}
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-[16px] leading-[28px] [&_h1]:mt-12 [&_h1]:mb-6 [&_h2]:mt-12 [&_h2]:mb-6 [&_h3]:mt-12 [&_h3]:mb-6',
          className
        )}
        {...props}
      />
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = 'Response';

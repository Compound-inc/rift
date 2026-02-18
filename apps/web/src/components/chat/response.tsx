'use client';

import { cn } from '@rift/utils';
import { type ComponentProps, useEffect, useRef } from 'react';
import { Streamdown, type PluginConfig } from 'streamdown';
import { code } from '@streamdown/code';
import { mermaid } from '@streamdown/mermaid';
import { math } from '@streamdown/math';

// Hoist static objects to module level to prevent new references on each render
// See: https://streamdown.ai/docs/memoization
const plugins = { code, mermaid, math } as PluginConfig;
const shikiTheme: ['github-light', 'github-dark'] = ['github-light', 'github-dark'];

type ResponseProps = ComponentProps<typeof Streamdown> & {
  onReady?: () => void;
};

export function Response({ className, onReady, ...props }: ResponseProps) {
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    if (onReady && !hasNotifiedRef.current) {
      let rafId1: number | null = null;
      let rafId2: number | null = null;
      let timeoutId: NodeJS.Timeout | null = null;

      rafId1 = requestAnimationFrame(() => {
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
        if (rafId1 !== null) cancelAnimationFrame(rafId1);
        if (rafId2 !== null) cancelAnimationFrame(rafId2);
        if (timeoutId !== null) clearTimeout(timeoutId);
      };
    }
  }, [onReady]);

  return (
    <Streamdown
      plugins={plugins}
      shikiTheme={shikiTheme}
      controls={false}
      className={cn(
        'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-[16px] leading-[28px] [&_h1]:mt-12 [&_h1]:mb-6 [&_h2]:mt-12 [&_h2]:mb-6 [&_h3]:mt-12 [&_h3]:mb-6',
        className
      )}
      {...props}
    />
  );
}

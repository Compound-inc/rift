'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@rift/utils';
import { Streamdown, type PluginConfig } from 'streamdown';
import { code } from '@streamdown/code';
import { mermaid } from '@streamdown/mermaid';
import { math } from '@streamdown/math';
import { components as customComponents } from '@/components/streamdown/lib/components';

// Hoist static objects to module level to prevent new references on each render
// This is critical for Streamdown's memoization to work correctly
// See: https://streamdown.ai/docs/memoization
const plugins = { code, mermaid, math } as PluginConfig;
const shikiTheme: ['github-light', 'github-dark'] = ['github-light', 'github-dark'];
const streamdownControls = {
  code: true,
  table: true,
  mermaid: {
    download: true,
    copy: true,
    fullscreen: true,
    panZoom: false,
  },
} as const;
// Cast components once at module level
const streamdownComponents = customComponents as Record<string, React.ComponentType<unknown>>;

type MemoResponseProps = {
  messageId: string;
  partIdx: number;
  onReady?: () => void;
  text?: string;
  isStreaming?: boolean;
  className?: string;
};

export const MemoResponse = React.memo(function MemoResponse({
  className,
  messageId,
  partIdx,
  onReady,
  text,
  isStreaming = false,
}: MemoResponseProps) {
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    if (!onReady || hasNotifiedRef.current) return;

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
  }, [onReady]);

  const content = typeof text === 'string' ? text : '';

  if (!content.trim()) {
    return null;
  }

  return (
    <Streamdown
      key={`${messageId}-${partIdx}`}
      plugins={plugins}
      shikiTheme={shikiTheme}
      isAnimating={isStreaming}
      mode={isStreaming ? 'streaming' : 'static'}
      components={streamdownComponents}
      controls={streamdownControls}
      className={cn(
        'size-full min-w-0 max-w-full break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-[16px] leading-[28px] font-normal tracking-[0.015em] proportional-nums',
        className
      )}
    >
      {content}
    </Streamdown>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.messageId === nextProps.messageId &&
    prevProps.partIdx === nextProps.partIdx &&
    prevProps.text === nextProps.text &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.className === nextProps.className
  );
});

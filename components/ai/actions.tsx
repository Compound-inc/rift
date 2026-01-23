'use client';

import React from 'react';
import { Button } from '@/components/ai/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ai/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

export type ActionsProps = ComponentProps<'div'>;

export function Actions({ className, children, ...props }: ActionsProps) {
  return (
    <div className={cn('flex items-center gap-1', className)} {...props}>
      {children}
    </div>
  );
}

export type ActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

// Memoize Action to prevent unnecessary re-renders of Tooltip components
// TooltipProvider should be wrapped at a higher level (e.g., ChatInterface)
export const Action = React.memo(function Action({
  tooltip,
  children,
  label,
  className,
  variant = 'ghost',
  size = 'sm',
  ...props
}: ActionProps) {
  const button = (
    <Button
      className={cn(
        'size-10 p-2 text-black hover:bg-hover hover:text-secondary dark:text-popover-text dark:hover:bg-popover dark:hover:bg-hover/60 relative',
        className
      )}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={0}>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
});

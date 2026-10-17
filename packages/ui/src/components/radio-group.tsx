'use client'

import * as React from 'react'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { Radio } from '@base-ui/react/radio'
import { cn } from '@rift/utils'

/** Base UI supplies roving focus, arrow-key selection and native form semantics. */
function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn('grid gap-2', className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof Radio.Root>) {
  return (
    <Radio.Root
      data-slot="radio-group-item"
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-base',
        'data-[checked]:border-accent-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-border-strong/50',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <Radio.Indicator className="size-2 rounded-full bg-accent-primary" />
    </Radio.Root>
  )
}

export { RadioGroup, RadioGroupItem }

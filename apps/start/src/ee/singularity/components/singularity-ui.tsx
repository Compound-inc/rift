import { useRef, useState } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import type { ReactNode } from 'react'
import { copyToClipboard, cn } from '@rift/utils'
import { Button } from '@rift/ui/button'
import { Input } from '@rift/ui/input'
import { Badge } from '@rift/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@rift/ui/dialog'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  LoaderCircle,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

export function SingularityPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-xl border border-border-base bg-surface-raised',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-base p-5">
        <div className="space-y-1">
          <h2 className="text-base font-medium text-foreground-strong">
            {title}
          </h2>
          {description && (
            <p className="max-w-prose text-sm text-foreground-tertiary">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function SingularityStatus({
  children,
  warning = false,
}: {
  children: ReactNode
  warning?: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-border-base font-normal',
        warning
          ? 'bg-surface-warning text-foreground-warning'
          : 'bg-surface-overlay text-foreground-primary',
      )}
    >
      {children}
    </Badge>
  )
}

export function SingularityCopyButton({
  value,
  label,
}: {
  value: string
  label: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => {
        void copyToClipboard(value)
          .then(() => toast.success(`${label.replace(/^Copy /, '')} copied.`))
          .catch(() =>
            toast.error('Could not copy. Select and copy the value manually.'),
          )
      }}
    >
      <Copy className="size-3.5" aria-hidden />
    </Button>
  )
}

export function SingularitySearch({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
}) {
  const inputRef = useRef<HTMLDivElement>(null)
  // Hidden profile panels keep their drafts mounted; only the visible search
  // field handles the shortcut, and dialogs keep their own keyboard focus.
  useHotkey(
    '/',
    (event) => {
      if (
        !inputRef.current?.offsetParent ||
        document.querySelector('[role="dialog"]')
      )
        return
      event.preventDefault()
      inputRef.current.querySelector('input')?.focus()
    },
    { ignoreInputs: true, preventDefault: false },
  )
  return (
    <div
      ref={inputRef}
      className="relative min-w-0 flex-1"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && value) {
          event.stopPropagation()
          onChange('')
        }
      }}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-tertiary"
        aria-hidden
      />
      <Input
        type="search"
        aria-label={label}
        aria-keyshortcuts="/"
        title={`${label}. Press / to focus.`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 pl-9 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            onChange('')
            inputRef.current?.querySelector('input')?.focus()
          }}
        >
          <X className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  )
}

export function SingularityPagination({
  page,
  pageCount,
  count,
  pageSize,
  onPageChange,
}: {
  page: number
  pageCount: number
  count: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs text-foreground-tertiary">
      <span role="status" className="tabular-nums">
        {count === 0
          ? '0 results'
          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} of ${count.toLocaleString()} results`}
      </span>
      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="tabular-nums">
            {page} / {pageCount}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next page"
            disabled={page === pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </nav>
      )}
    </div>
  )
}

export function SingularityEmpty({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <Search className="mb-1 size-5 text-foreground-tertiary" aria-hidden />
      <p className="font-medium text-foreground-strong">{title}</p>
      <p className="max-w-sm text-sm text-foreground-tertiary">{description}</p>
      {action}
    </div>
  )
}

/** A failed mutation leaves the review dialog open; only a confirmed success closes it. */
export function SingularityConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  isPending,
  danger = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children?: ReactNode
  confirmLabel: string
  onConfirm: () => Promise<boolean>
  isPending: boolean
  danger?: boolean
}) {
  const [submitting, setSubmitting] = useState(false)
  const busy = submitting || isPending
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value)
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="pr-7">{title}</DialogTitle>
          <DialogDescription className="text-foreground-tertiary">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="large"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={danger ? 'danger' : 'default'}
            size="large"
            className="gap-2"
            disabled={busy}
            onClick={async () => {
              setSubmitting(true)
              try {
                if (await onConfirm()) onOpenChange(false)
              } finally {
                setSubmitting(false)
              }
            }}
          >
            {busy ? (
              <LoaderCircle
                className="size-4 motion-safe:animate-spin"
                aria-hidden
              />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            {busy ? 'Saving…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

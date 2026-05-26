/**
 * Empty-state for the global Skills page. Three sample preview cards
 * stacked in a faux carousel above the heading + primary CTA. Sample
 * cards mirror `SkillRowCard` so users see what populated cards will
 * look like.
 */
'use client'

import { Button } from '@rift/ui/button'
import { cn } from '@rift/utils'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Share2 from 'lucide-react/dist/esm/icons/share-2'
import User from 'lucide-react/dist/esm/icons/user'
import Users from 'lucide-react/dist/esm/icons/users'

import { m } from '@/paraglide/messages.js'

import { formatSkillTitle } from './skill-title'

export function SkillsEmptyState({
  onCreateSkill,
}: {
  onCreateSkill: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-10 py-12 text-center sm:py-20">
      <SkillPreviewStack />

      <div className="flex max-w-md flex-col items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground-primary sm:text-2xl">
          {m.chat_skill_empty_heading()}
        </h2>
        <p className="text-pretty text-sm leading-relaxed text-foreground-secondary">
          {m.chat_skill_empty_description()}
        </p>
      </div>

      <Button type="button" onClick={onCreateSkill}>
        <Plus className="size-4" aria-hidden />
        {m.chat_skill_action_new()}
      </Button>
    </div>
  )
}

type SamplePreview = {
  readonly name: string
  readonly description: string
  readonly body: string
  readonly isShared: boolean
}

function SkillPreviewStack() {
  // Centre is the org-shared sample — it's the more interesting state
  // to telegraph (sharing is a feature; personal-only is the default).
  const previews: readonly [SamplePreview, SamplePreview, SamplePreview] = [
    {
      name: m.chat_skill_empty_sample_plan_name(),
      description: m.chat_skill_empty_sample_plan_description(),
      body: 'Outline an approach before you write code.\n\n1. Restate the goal in one sentence.\n2. List the smallest set of changes.\n3. Note risks and rollbacks.',
      isShared: false,
    },
    {
      name: m.chat_skill_empty_sample_review_name(),
      description: m.chat_skill_empty_sample_review_description(),
      body: 'Audit the diff for bugs, perf, and clarity.\n\n- Correctness first, then performance.\n- Flag anything that needs a test.\n- Suggest a simpler shape if one exists.',
      isShared: true,
    },
    {
      name: m.chat_skill_empty_sample_standup_name(),
      description: m.chat_skill_empty_sample_standup_description(),
      body: 'Summarise yesterday, today, and blockers.\n\n- Yesterday: what shipped or progressed.\n- Today: the single most important thing.\n- Blockers: anyone whose help unblocks me.',
      isShared: false,
    },
  ]

  return (
    // Flanking previews tuck behind the centre card via negative margins.
    // `aria-hidden` because the cards repeat the empty-state intent
    // already conveyed by the heading.
    <div
      aria-hidden
      className="relative flex w-full max-w-3xl items-stretch justify-center"
    >
      <SkillPreviewCard preview={previews[0]} variant="left" />
      <SkillPreviewCard preview={previews[1]} variant="center" />
      <SkillPreviewCard preview={previews[2]} variant="right" />
    </div>
  )
}

const VARIANT_CLASSES = {
  left: '-mr-8 -translate-y-1 rotate-[-3deg] scale-95 opacity-40 blur-[1.5px]',
  center: 'z-10 shadow-lg shadow-black/5 dark:shadow-black/30',
  right: '-ml-8 -translate-y-1 rotate-[3deg] scale-95 opacity-40 blur-[1.5px]',
} as const

function SkillPreviewCard({
  preview,
  variant,
}: {
  preview: SamplePreview
  variant: keyof typeof VARIANT_CLASSES
}) {
  const Icon = preview.isShared ? Users : User
  const label = preview.isShared
    ? m.chat_skill_indicator_shared()
    : m.chat_skill_indicator_personal()
  return (
    <div
      className={cn(
        'flex w-72 flex-col overflow-hidden rounded-xl border border-surface-strong bg-transparent text-left',
        VARIANT_CLASSES[variant],
      )}
    >
      <div className="relative flex flex-col bg-surface-strong/50">
        <div className="relative z-10 flex flex-col gap-3 rounded-b-2xl bg-surface-raised p-5 shadow-[0_2px_12px_rgb(0,0,0,0.05)]">
          {/* Decorative share icon — real cards gate it on creator + non-project. */}
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground-strong">
              {formatSkillTitle(preview.name)}
            </p>
            <span className="-mr-1.5 -mt-1.5 inline-flex size-7.5 shrink-0 items-center justify-center rounded-md text-foreground-primary">
              <Share2 className="size-4" aria-hidden />
            </span>
          </div>
          <p className="line-clamp-2 text-sm text-foreground-secondary">
            {preview.description}
          </p>
          <div className="relative flex h-24 w-full flex-col items-stretch overflow-hidden rounded-md">
            <pre className="line-clamp-4 whitespace-pre-wrap break-words px-3 py-2 font-mono text-xs leading-relaxed text-foreground-secondary">
              {preview.body}
            </pre>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-12 backdrop-blur-[1.5px]"
              style={{
                maskImage:
                  'linear-gradient(to top, rgb(0 0 0) 30%, rgb(0 0 0 / 0) 100%)',
                WebkitMaskImage:
                  'linear-gradient(to top, rgb(0 0 0) 30%, rgb(0 0 0 / 0) 100%)',
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-raised via-surface-raised/60 to-transparent"
            />
          </div>
        </div>
        <div className="relative z-0 -mt-3 flex items-center justify-between gap-3 rounded-b-xl border-t border-border-faint bg-surface-strong/50 px-4 pb-3 pt-5">
          {/* No tooltip wrapper — focusable nodes inside `aria-hidden` warn. */}
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-tertiary">
            <Icon className="size-3.5" aria-hidden />
            {label}
          </span>
          <div className="flex h-8 items-center">
            <Button type="button" variant="ghost" size="default" tabIndex={-1}>
              {m.chat_skill_action_edit()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

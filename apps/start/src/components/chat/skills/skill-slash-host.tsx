/**
 * Slash-skill autocomplete plumbed into the chat composer:
 *   - watches the cursor and detects the "active" `/[name]` token,
 *   - opens a popover listing matches in resolution-chain priority,
 *   - splices the selected skill back over the active token,
 *   - paints a transparent overlay highlighting recognised tokens.
 *
 * Parsing delegates to `parseSkillSlashTokens` so client detection
 * matches the server's send-time expansion exactly (ADR-0005).
 */
'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { Popover, PopoverContent, PopoverTrigger } from '@rift/ui/popover'
import { cn } from '@rift/utils'
import Folder from 'lucide-react/dist/esm/icons/folder'
import User from 'lucide-react/dist/esm/icons/user'
import Users from 'lucide-react/dist/esm/icons/users'
import Wand2 from 'lucide-react/dist/esm/icons/wand-2'

import { queries } from '@/integrations/zero/queries'
import { m } from '@/paraglide/messages.js'
import {
  canonicalSkillName,
  parseSkillSlashTokens,
} from '@/lib/shared/skills/skill-grammar'
import type { SkillRow } from '@/lib/shared/skills/skill-row'

type SkillEntry = {
  readonly id: string
  readonly name: string
  readonly description?: string | null
  readonly source: 'project' | 'org' | 'personal'
}

/**
 * Loads + composes the chat-context skill catalog. Subscriptions are
 * gated on `enabled` so welcome screens and idle composers don't pay
 * for slash-menu plumbing they never use.
 */
function useSkillCatalog(input: {
  readonly projectId?: string
  readonly enabled: boolean
}): {
  readonly entries: readonly SkillEntry[]
  /** Keyed by `canonicalSkillName(name)` for O(1) validity checks. */
  readonly byCanonicalName: ReadonlyMap<string, SkillEntry>
} {
  const { projectId, enabled } = input

  const [personal] = useQuery(
    enabled ? queries.skills.listPersonal({}) : null,
  )
  const [orgShared] = useQuery(
    enabled ? queries.skills.listOrgShared({}) : null,
  )
  const [projectSkills] = useQuery(
    enabled && projectId
      ? queries.skills.listForProject({ projectId })
      : null,
  )
  const [overrideRows] = useQuery(
    enabled && projectId
      ? queries.skills.overridesForProject({ projectId })
      : null,
  )

  return useMemo(() => {
    const overriddenIds = new Set((overrideRows ?? []).map((r) => r.skillId))
    const byCanonical = new Map<string, SkillEntry>()

    // Insert in reverse priority — Project beats Org-Shared beats
    // Personal — so higher-priority entries overwrite lower ones.
    const personalEntries = (personal ?? []).map(
      (skill: SkillRow): SkillEntry => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        source: 'personal',
      }),
    )
    const orgEntries = (orgShared ?? []).map(
      (skill: SkillRow): SkillEntry => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        source: 'org',
      }),
    )
    const projectEntries = (projectSkills ?? []).map(
      (skill: SkillRow): SkillEntry => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        source: 'project',
      }),
    )

    for (const entry of personalEntries) {
      if (overriddenIds.has(entry.id)) continue
      byCanonical.set(canonicalSkillName(entry.name), entry)
    }
    for (const entry of orgEntries) {
      if (overriddenIds.has(entry.id)) continue
      byCanonical.set(canonicalSkillName(entry.name), entry)
    }
    // Project Skills are not overridable — overrides target globals only.
    for (const entry of projectEntries) {
      byCanonical.set(canonicalSkillName(entry.name), entry)
    }

    return {
      entries: [...byCanonical.values()],
      byCanonicalName: byCanonical,
    }
  }, [personal, orgShared, projectSkills, overrideRows])
}

/**
 * Returns the slash token containing or immediately after `cursor`.
 * `/refac|tor` and `/refactor|` both match the same token.
 */
function findActiveSlashToken(input: {
  readonly text: string
  readonly cursor: number
}): { readonly start: number; readonly end: number; readonly name: string } | null {
  const tokens = parseSkillSlashTokens(input.text)
  for (const token of tokens) {
    if (input.cursor >= token.start && input.cursor <= token.end) {
      return token
    }
  }
  return null
}

/**
 * Latches once the user types their first `/`. Reset only by unmount,
 * so navigating away from the composer is the only way to undo the
 * subscription opt-in.
 */
function useHasEverHadSlash(value: string): boolean {
  const [seen, setSeen] = useState(() => value.includes('/'))
  useEffect(() => {
    if (!seen && value.includes('/')) setSeen(true)
  }, [seen, value])
  return seen
}

export function SkillSlashHost({
  textareaRef,
  value,
  onValueChange,
  projectId,
  children,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onValueChange: (next: string) => void
  projectId?: string
  children: ReactNode
}) {
  const { entries, byCanonicalName } = useSkillCatalog({
    projectId,
    enabled: useHasEverHadSlash(value),
  })

  const [cursor, setCursor] = useState(0)
  // Track only `start` for the dismissed token — `end` shifts as the
  // user keeps typing into the same token, but `start` is stable.
  const [dismissed, setDismissed] = useState<{ readonly start: number } | null>(
    null,
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const handler = () => setCursor(textarea.selectionStart ?? 0)
    textarea.addEventListener('keyup', handler)
    textarea.addEventListener('click', handler)
    textarea.addEventListener('select', handler)
    textarea.addEventListener('focus', handler)
    return () => {
      textarea.removeEventListener('keyup', handler)
      textarea.removeEventListener('click', handler)
      textarea.removeEventListener('select', handler)
      textarea.removeEventListener('focus', handler)
    }
  }, [textareaRef])

  const activeToken = useMemo(
    () => findActiveSlashToken({ text: value, cursor }),
    [value, cursor],
  )

  // Clear the dismissal once the cursor leaves the dismissed token's
  // start, so moving on to a new token reopens the menu without a
  // manual gesture.
  useEffect(() => {
    if (!dismissed) return
    if (!activeToken || activeToken.start !== dismissed.start) {
      setDismissed(null)
    }
  }, [activeToken, dismissed])

  const isOpen =
    !!activeToken &&
    !(dismissed && activeToken.start === dismissed.start)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  const filterPrefix = activeToken?.name ?? ''
  const filteredEntries = useMemo(() => {
    if (!filterPrefix) return entries
    const needle = canonicalSkillName(filterPrefix)
    return entries.filter((entry) =>
      canonicalSkillName(entry.name).startsWith(needle),
    )
  }, [entries, filterPrefix])

  const applySelection = useCallback(
    (skill: SkillEntry) => {
      if (!activeToken) return
      const before = value.slice(0, activeToken.start)
      const after = value.slice(activeToken.end)
      // Trailing space lets the user keep typing without one. Skip if
      // `after` already begins with whitespace, otherwise mid-sentence
      // selection produces double spaces.
      const trailing = after.startsWith(' ') || after.startsWith('\n') ? '' : ' '
      const replacement = `/${skill.name}${trailing}`
      const next = `${before}${replacement}${after}`
      onValueChange(next)
      const newCursor = before.length + replacement.length
      requestAnimationFrame(() => {
        const textarea = textareaRef.current
        if (!textarea) return
        textarea.focus()
        textarea.setSelectionRange(newCursor, newCursor)
        setCursor(newCursor)
      })
    },
    [activeToken, value, onValueChange, textareaRef],
  )

  // Capture-phase listener so Enter applies the selection instead of
  // submitting the form. Tab is treated identically.
  const [highlightIndex, setHighlightIndex] = useState(0)
  useEffect(() => {
    setHighlightIndex(0)
  }, [filterPrefix, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const textarea = textareaRef.current
    if (!textarea) return

    const handler = (event: KeyboardEvent) => {
      if (!isOpenRef.current) return
      if (filteredEntries.length === 0 && event.key !== 'Escape') return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setHighlightIndex(
            (current) => (current + 1) % filteredEntries.length,
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setHighlightIndex(
            (current) =>
              (current - 1 + filteredEntries.length) % filteredEntries.length,
          )
          break
        case 'Enter':
        case 'Tab': {
          if (filteredEntries.length === 0) return
          event.preventDefault()
          event.stopPropagation()
          const target = filteredEntries[highlightIndex]
          if (target) applySelection(target)
          break
        }
        case 'Escape':
          event.preventDefault()
          if (activeToken) setDismissed({ start: activeToken.start })
          break
        default:
          break
      }
    }

    textarea.addEventListener('keydown', handler, true)
    return () => textarea.removeEventListener('keydown', handler, true)
  }, [
    isOpen,
    textareaRef,
    filteredEntries,
    highlightIndex,
    applySelection,
    activeToken,
  ])

  return (
    <div className="relative w-full">
      <Popover
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && activeToken)
            setDismissed({ start: activeToken.start })
        }}
      >
        <PopoverTrigger
          render={
            <div className="relative w-full">
              <SkillHighlightOverlay
                textareaRef={textareaRef}
                value={value}
                byCanonicalName={byCanonicalName}
              />
              {children}
            </div>
          }
        />
        <PopoverContent
          align="start"
          side="top"
          // Keep focus on the textarea so the user can keep typing
          // while the menu narrows.
          initialFocus={false}
          finalFocus={false}
          className={cn(
            'w-80 p-1',
            'origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 ease-out',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
          )}
        >
          {filteredEntries.length === 0 ? (
            <div
              role="status"
              className="px-3 py-2 text-sm text-foreground-tertiary"
            >
              {m.chat_skill_slash_no_match({ name: filterPrefix || '' })}
            </div>
          ) : (
            <ul
              role="listbox"
              aria-label={m.chat_skill_slash_heading()}
              className="flex max-h-60 flex-col gap-0.5 overflow-auto outline-none"
            >
              {filteredEntries.map((entry, index) => (
                <SkillSlashItem
                  key={entry.id}
                  entry={entry}
                  isHighlighted={index === highlightIndex}
                  onSelect={() => applySelection(entry)}
                  onHover={() => setHighlightIndex(index)}
                />
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function SkillSlashItem({
  entry,
  isHighlighted,
  onSelect,
  onHover,
}: {
  entry: SkillEntry
  isHighlighted: boolean
  onSelect: () => void
  onHover: () => void
}) {
  return (
    <li
      role="option"
      aria-selected={isHighlighted}
      data-highlighted={isHighlighted ? '' : undefined}
      // `mousedown` + preventDefault keeps the textarea focused so the
      // "keep typing while picking" interaction doesn't break.
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={onHover}
      onClick={onSelect}
      className="group/skill-item relative cursor-pointer outline-none"
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-1 rounded-md bg-surface-info/25 opacity-0',
          'transition-[inset,opacity] duration-150 ease-out',
          'group-hover/skill-item:inset-0 group-hover/skill-item:opacity-100',
          'group-data-[highlighted]/skill-item:inset-0 group-data-[highlighted]/skill-item:opacity-100',
          'group-active/skill-item:!inset-0.5',
        )}
      />
      <div className="relative z-10 flex items-start gap-2 px-2 py-1.5">
        <Wand2 className="mt-0.5 size-4 shrink-0 text-foreground-tertiary" />
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate font-mono text-sm text-foreground-strong',
              'group-hover/skill-item:font-medium group-hover/skill-item:text-foreground-info',
              'group-data-[highlighted]/skill-item:font-medium group-data-[highlighted]/skill-item:text-foreground-info',
            )}
          >
            /{entry.name}
          </span>
          {entry.description ? (
            <p className="mt-0.5 truncate text-xs text-foreground-tertiary">
              {entry.description}
            </p>
          ) : null}
        </div>
        <SkillSourceIcon source={entry.source} />
      </div>
    </li>
  )
}

function SkillSourceIcon({ source }: { source: SkillEntry['source'] }) {
  const Icon =
    source === 'project' ? Folder : source === 'org' ? Users : User
  const label =
    source === 'project'
      ? m.chat_skill_badge_source_project()
      : source === 'org'
        ? m.chat_skill_badge_source_org()
        : m.chat_skill_badge_source_personal()
  return (
    <span
      aria-label={label}
      title={label}
      className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center text-foreground-tertiary"
    >
      <Icon className="size-3.5" aria-hidden />
    </span>
  )
}

/**
 * Transparent overlay mirroring the textarea's text and painting blue
 * bands behind recognised slash tokens. The textarea sits on top with
 * `text-transparent` so the user reads the overlay's text against the
 * highlight bands.
 *
 * Why an overlay div instead of `CSS.highlights`: `<textarea>` does
 * not expose its content as DOM Text nodes, so the Range-based
 * Highlight API can't target it. The overlay-mirror pattern is the
 * standard textarea workaround used by code editors.
 *
 * Critical invariant: every typography property that affects line
 * wrapping (font, size, line-height, letter-spacing, padding,
 * white-space) must match the textarea exactly, otherwise the bands
 * drift relative to the real text.
 */
function SkillHighlightOverlay({
  textareaRef,
  value,
  byCanonicalName,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  byCanonicalName: ReadonlyMap<string, unknown>
}) {
  const innerRef = useRef<HTMLDivElement | null>(null)

  const segments = useMemo(
    () => buildHighlightSegments({ value, byCanonicalName }),
    [value, byCanonicalName],
  )

  // Sync vertical offset with the textarea's scrollTop so highlights
  // track the visible viewport when the textarea overflows internally.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    const inner = innerRef.current
    if (!textarea || !inner) return
    const sync = () => {
      inner.style.transform = `translateY(${-textarea.scrollTop}px)`
    }
    sync()
    textarea.addEventListener('scroll', sync)
    return () => textarea.removeEventListener('scroll', sync)
  }, [textareaRef])

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/*
       * Typography stack must match `PromptInputTextarea` exactly —
       * any drift causes the highlight bands to misalign. This layer
       * also paints the visible text color: the textarea above is
       * `text-transparent`, so slash tokens get `text-foreground-info`
       * here while the rest of the message stays `text-foreground-strong`.
       */}
      <div
        ref={innerRef}
        className="text-base leading-6 tracking-[-0.01em] proportional-nums whitespace-pre-wrap break-words text-foreground-strong"
      >
        {segments.map((segment, index) =>
          segment.kind === 'skill' ? (
            <mark
              key={index}
              className="rounded-[3px] bg-surface-info/25 font-medium text-foreground-info"
            >
              {segment.text}
            </mark>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
        {/*
         * Trailing zero-width space stabilises the final line height
         * when the value ends in a newline; without it Chrome
         * collapses the empty trailing line and the overlay drifts
         * below the textarea by one line.
         */}
        {'\u200b'}
      </div>
    </div>
  )
}

type HighlightSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'skill'; readonly text: string }

/**
 * Splits `value` into alternating text/skill segments. Only tokens
 * whose canonical name resolves to a known skill earn a highlight —
 * unknowns stay uncolored.
 */
function buildHighlightSegments(input: {
  readonly value: string
  readonly byCanonicalName: ReadonlyMap<string, unknown>
}): readonly HighlightSegment[] {
  const tokens = parseSkillSlashTokens(input.value).filter((token) =>
    input.byCanonicalName.has(canonicalSkillName(token.name)),
  )
  if (tokens.length === 0) {
    return [{ kind: 'text', text: input.value }]
  }

  const segments: HighlightSegment[] = []
  let cursor = 0
  for (const token of tokens) {
    if (token.start > cursor) {
      segments.push({
        kind: 'text',
        text: input.value.slice(cursor, token.start),
      })
    }
    segments.push({
      kind: 'skill',
      text: input.value.slice(token.start, token.end),
    })
    cursor = token.end
  }
  if (cursor < input.value.length) {
    segments.push({ kind: 'text', text: input.value.slice(cursor) })
  }
  return segments
}

export { findActiveSlashToken, buildHighlightSegments }

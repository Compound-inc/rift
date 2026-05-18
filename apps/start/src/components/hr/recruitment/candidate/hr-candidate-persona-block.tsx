'use client'

import Briefcase from 'lucide-react/dist/esm/icons/briefcase'
import GraduationCap from 'lucide-react/dist/esm/icons/graduation-cap'
import Languages from 'lucide-react/dist/esm/icons/languages'
import Mail from 'lucide-react/dist/esm/icons/mail'
import MapPin from 'lucide-react/dist/esm/icons/map-pin'
import Phone from 'lucide-react/dist/esm/icons/phone'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import { cn } from '@rift/utils'
import type { ComponentType, SVGProps } from 'react'
import type { HrCandidateView } from '@/lib/frontend/hr/recruitment'

export function HrCandidatePersonaBlock({
  candidate,
  compact = false,
}: {
  readonly candidate: HrCandidateView
  readonly compact?: boolean
}) {
  const initials = buildInitials(candidate.displayName)
  const contactItems: ReadonlyArray<{
    readonly key: string
    readonly icon: ComponentType<SVGProps<SVGSVGElement>>
    readonly value: string
  }> = [
    candidate.email
      ? { key: 'email', icon: Mail, value: candidate.email }
      : null,
    candidate.phone
      ? { key: 'phone', icon: Phone, value: candidate.phone }
      : null,
    candidate.location
      ? { key: 'location', icon: MapPin, value: candidate.location }
      : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  return (
    <div className={cn('flex flex-col gap-3', compact ? 'gap-2' : 'gap-4')}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full border border-border-base bg-surface-overlay text-xs font-semibold uppercase text-foreground-secondary',
            compact ? 'size-9 text-[11px]' : 'size-11 text-sm',
          )}
        >
          {initials}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1
            className={cn(
              'truncate font-semibold leading-tight tracking-tight text-foreground-strong',
              compact ? 'text-base' : 'text-2xl',
            )}
          >
            {candidate.displayName || 'Unknown candidate'}
          </h1>
          {candidate.headline && !compact ? (
            <p className="line-clamp-2 text-sm text-foreground-tertiary">
              {candidate.headline}
            </p>
          ) : null}
          {contactItems.length > 0 ? (
            <div
              className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-1 text-foreground-tertiary',
                compact ? 'text-xs' : 'text-sm',
              )}
            >
              {contactItems.map((item) => {
                const Icon = item.icon
                return (
                  <span
                    key={item.key}
                    className="inline-flex items-center gap-1"
                  >
                    <Icon aria-hidden className="size-3.5" />
                    <span className="truncate">{item.value}</span>
                  </span>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>

      {compact ? null : <PersonaSecondary candidate={candidate} />}
    </div>
  )
}

function PersonaSecondary({
  candidate,
}: {
  readonly candidate: HrCandidateView
}) {
  const hasSummary = !!candidate.summary
  const hasSkills = candidate.skills.length > 0
  const hasLanguages = candidate.languages.length > 0
  const hasMeta =
    candidate.yearsOfExperience !== null || !!candidate.highestDegree

  if (!hasSummary && !hasSkills && !hasLanguages && !hasMeta) return null

  return (
    <div className="flex flex-col gap-3 border-t border-border-light pt-3">
      {candidate.summary ? (
        <p className="text-sm leading-6 text-foreground-primary">
          {candidate.summary}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-foreground-tertiary">
        {candidate.yearsOfExperience !== null ? (
          <span className="inline-flex items-center gap-1">
            <Briefcase aria-hidden className="size-3.5" />
            {candidate.yearsOfExperience} yrs experience
          </span>
        ) : null}
        {candidate.highestDegree ? (
          <span className="inline-flex items-center gap-1">
            <GraduationCap aria-hidden className="size-3.5" />
            {candidate.highestDegree}
          </span>
        ) : null}
      </div>

      {candidate.skills.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Sparkles
            aria-hidden
            className="size-3.5 shrink-0 text-foreground-tertiary"
          />
          {candidate.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex rounded-full border border-border-light bg-surface-overlay px-2 py-0.5 text-[11px] text-foreground-secondary"
            >
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      {candidate.languages.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Languages
            aria-hidden
            className="size-3.5 shrink-0 text-foreground-tertiary"
          />
          {candidate.languages.map((language) => (
            <span
              key={language}
              className="inline-flex rounded-full border border-border-light bg-surface-overlay px-2 py-0.5 text-[11px] text-foreground-secondary"
            >
              {language}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function buildInitials(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

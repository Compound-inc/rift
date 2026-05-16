import { isHrApplicationStage, isHrTestKind } from './types'
import type {
  HrApplicationStage,
  HrPositionEmploymentType,
  HrPositionStatus,
  HrPositionWorkArrangement,
  HrTestKind,
} from './types'

const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 8000
const MAX_TEXT_FIELD_LENGTH = 500
const MAX_NOTES_LENGTH = 4000
const MAX_TAGS = 32
const MAX_TAG_LENGTH = 64
const MAX_CV_TEXT_LENGTH = 60_000
const MAX_EMAIL_LENGTH = 320

function clampString(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max)
}

export function normalizePositionTitle(value: string): string {
  return clampString(value.trim(), MAX_TITLE_LENGTH)
}

export function normalizePositionDescription(value: string): string {
  return clampString(value.trim(), MAX_DESCRIPTION_LENGTH)
}

export function normalizeTextField(value: string | null | undefined): string {
  if (!value) return ''
  return clampString(value.trim(), MAX_TEXT_FIELD_LENGTH)
}

export function normalizeNotes(
  value: string | null | undefined,
): string | null {
  if (!value) return null
  const normalized = clampString(value.trim(), MAX_NOTES_LENGTH)
  return normalized.length > 0 ? normalized : null
}

export function normalizeTags(
  values: readonly (string | null | undefined)[] | null | undefined,
): readonly string[] {
  if (!values) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const candidate of values) {
    if (typeof candidate !== 'string') continue
    const trimmed = clampString(candidate.trim().toLowerCase(), MAX_TAG_LENGTH)
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
    if (result.length >= MAX_TAGS) break
  }
  return result
}

export function normalizeCvText(
  value: string | null | undefined,
): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return clampString(trimmed, MAX_CV_TEXT_LENGTH)
}

export function normalizePositionStatus(
  value: string | null | undefined,
): HrPositionStatus {
  if (!value) return 'draft'
  switch (value) {
    case 'draft':
    case 'open':
    case 'paused':
    case 'filled':
    case 'archived':
      return value
    default:
      return 'draft'
  }
}

export function normalizeArrangement(
  value: string | null | undefined,
): HrPositionWorkArrangement {
  if (value === 'remote' || value === 'hybrid' || value === 'onsite') {
    return value
  }
  return 'hybrid'
}

export function normalizeEmploymentType(
  value: string | null | undefined,
): HrPositionEmploymentType {
  if (
    value === 'full_time' ||
    value === 'part_time' ||
    value === 'contract' ||
    value === 'internship'
  ) {
    return value
  }
  return 'full_time'
}

export function normalizeApplicationStage(
  value: string | null | undefined,
): HrApplicationStage {
  if (value && isHrApplicationStage(value)) return value
  return 'uploaded'
}

export function normalizeTestKind(
  value: string | null | undefined,
): HrTestKind {
  if (value && isHrTestKind(value)) return value
  return 'custom'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(
  value: string | null | undefined,
): { readonly normalized: string; readonly display: string } | null {
  if (!value) return null
  const display = clampString(value.trim(), MAX_EMAIL_LENGTH)
  if (!display) return null
  const normalized = display.toLowerCase()
  if (!EMAIL_RE.test(normalized)) return null
  return { normalized, display }
}

export function sanitizeCvForEmbedding(text: string): string {
  const stripped = text.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
  return stripped.replace(/\s+/g, ' ').trim()
}

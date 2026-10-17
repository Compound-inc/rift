import { safeText } from './safe-text'
import type { ReadonlyJSONValue } from '@rocicorp/zero'

/**
 * Keep provider-owned payloads JSON-safe and small before they enter synced rows.
 * Limits apply while walking, so large page bodies, arrays, cycles, and binary
 * values cannot expand database rows or break finalization's JSON serialization.
 */
export function boundedJson(
  value: unknown,
  maxChars = 16_384,
): ReadonlyJSONValue | undefined {
  let remaining = maxChars
  const seen = new WeakSet<object>()
  function visit(item: unknown, depth: number): ReadonlyJSONValue | undefined {
    if (remaining < 16 || depth > 6 || item === undefined) return undefined
    if (item === null || typeof item === 'boolean') {
      remaining -= 8
      return item
    }
    if (typeof item === 'number') {
      remaining -= 24
      return Number.isFinite(item) ? item : undefined
    }
    if (typeof item === 'string') {
      // JSON escaping can use six characters per input character.
      const limit = Math.min(4_096, Math.floor((remaining - 8) / 6))
      const text =
        item.length > limit
          ? `${safeText(item, Math.max(0, limit - 1))}…`
          : safeText(item)
      remaining -= JSON.stringify(text).length + 2
      return text
    }
    if (typeof item !== 'object' || seen.has(item) || ArrayBuffer.isView(item))
      return undefined
    seen.add(item)
    remaining -= 2
    if (Array.isArray(item)) {
      return item.slice(0, 32).flatMap((entry) => {
        const result = visit(entry, depth + 1)
        return result === undefined ? [] : [result]
      })
    }
    const result: Record<string, ReadonlyJSONValue> = Object.create(null)
    for (const [key, entry] of Object.entries(item).slice(0, 32)) {
      if (key.length > 128 || remaining < key.length + 16) continue
      remaining -= JSON.stringify(key).length + 2
      const child = visit(entry, depth + 1)
      if (child !== undefined) result[safeText(key)] = child
    }
    return result
  }
  return visit(value, 0)
}

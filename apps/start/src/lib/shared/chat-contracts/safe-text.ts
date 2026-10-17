/**
 * PostgreSQL text/JSONB cannot store NUL or unpaired UTF-16 surrogates.
 * Slice after removing NUL, then match complete pairs before lone surrogates.
 * This also handles a slice through an emoji without requiring lookbehind.
 */
export function safeText(value: string, maxChars = value.length): string {
  return value
    .replaceAll('\u0000', '')
    .slice(0, maxChars)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, (character) =>
      character.length === 2 ? character : '',
    )
}

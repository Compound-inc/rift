/**
 * Formats a raw skill name for display.
 *
 * Skill names are stored lowercase, kebab/underscore-friendly so they
 * can be invoked as `/name` in chat without surprises. For display
 * surfaces that are not the slash-form (the card title, the preview
 * dialog header), we capitalize only the first character and leave the
 * rest untouched — `code-review` becomes `Code-review`. Locale-naive
 * by design: skill names are restricted to ASCII letters, numbers,
 * dashes and underscores at the validation layer.
 */
export function formatSkillTitle(name: string): string {
  if (!name) return name
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** Quote all fields and neutralize spreadsheet formulas in user-provided values. */
export function buildSingularityCsv(
  rows: Array<Array<string | number>>,
): string {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value)
            const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
            return `"${safe.replaceAll('"', '""')}"`
          })
          .join(','),
      )
      .join('\r\n')
  )
}

export function downloadSingularityCsv(
  filename: string,
  rows: Array<Array<string | number>>,
) {
  const url = URL.createObjectURL(
    new Blob([buildSingularityCsv(rows)], { type: 'text/csv;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Defer revocation until the browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

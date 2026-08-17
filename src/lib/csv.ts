// CSV / Excel-compatible export helpers

/** Escape a CSV cell per RFC 4180 */
function esc(value: unknown): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

/**
 * Build CSV. Excel-compatible: prepends UTF-8 BOM so Urdu text opens correctly.
 */
export function toCSV(rows: Array<Array<unknown>>): string {
  return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n')
}

export function downloadCSV(rows: Array<Array<unknown>>, filename: string): void {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

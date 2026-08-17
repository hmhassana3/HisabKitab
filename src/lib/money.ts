// Money helpers — ALWAYS integer paisa. Rs. 1 = 100 paisa.

export type { Paisa } from '../types'

export const PAISA_PER_RUPEE = 100

/** Parse user input like "1234.50" or "1,234" into integer paisa. Returns null if invalid. */
export function parsePaisa(input: string): number | null {
  if (input == null) return null
  const s = String(input).replace(/,/g, '').trim()
  if (s === '' || s === '-' || s === '.') return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  if (n < 0) return null
  // round to 2 decimals to avoid float noise
  return Math.round(n * PAISA_PER_RUPEE)
}

/** paisa -> "1234.50" (string, no symbol) */
export function paisaToDecimal(paisa: number): string {
  if (!Number.isFinite(paisa)) return '0.00'
  const sign = paisa < 0 ? '-' : ''
  const abs = Math.abs(paisa)
  const whole = Math.floor(abs / PAISA_PER_RUPEE)
  const frac = abs % PAISA_PER_RUPEE
  return `${sign}${whole}.${String(frac).padStart(2, '0')}`
}

/** paisa -> "Rs. 1,234.50" */
export function formatMoney(paisa: number, currency = 'Rs.'): string {
  if (!Number.isFinite(paisa)) return `${currency} 0.00`
  const sign = paisa < 0 ? '-' : ''
  const abs = Math.abs(paisa)
  const whole = Math.floor(abs / PAISA_PER_RUPEE)
  const frac = abs % PAISA_PER_RUPEE
  return `${sign}${currency} ${whole.toLocaleString('en-PK')}.${String(frac).padStart(2, '0')}`
}

/** paisa -> "1,234" (rounded rupees, no decimals) for compact cards */
export function formatCompact(paisa: number, currency = 'Rs.'): string {
  const abs = Math.abs(paisa)
  const whole = Math.round(abs / PAISA_PER_RUPEE)
  return `${paisa < 0 ? '-' : ''}${currency} ${whole.toLocaleString('en-PK')}`
}

export function add(a: number, b: number): number { return Math.round(a) + Math.round(b) }
export function sub(a: number, b: number): number { return Math.round(a) - Math.round(b) }
export function mul(a: number, b: number): number { return Math.round(a) * b }

/** percent of paisa amount (pct is e.g. 10 for 10%) */
export function percentOf(paisa: number, pct: number): number {
  return Math.round((paisa * pct) / 100)
}

export function sum(list: number[]): number {
  return list.reduce((acc, n) => acc + Math.round(n || 0), 0)
}

export function zero(): number { return 0 }

// Date / time helpers — everything displayed in Asia/Karachi (Pakistan time)
import type { Lang } from '../types'

export const DEFAULT_TZ = 'Asia/Karachi'

export function todayISO(tz = DEFAULT_TZ): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function nowISO(): string {
  return new Date().toISOString()
}

/** "12 Aug 2026" style */
export function formatDate(iso: string | undefined, lang: Lang = 'en', tz = DEFAULT_TZ): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', {
      timeZone: tz, day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function formatDateShort(iso: string | undefined, lang: Lang = 'en', tz = DEFAULT_TZ): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { timeZone: tz, day: 'numeric', month: 'short' })
  } catch {
    return iso
  }
}

export function formatDateTime(iso: string | undefined, lang: Lang = 'en', tz = DEFAULT_TZ): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString(lang === 'ur' ? 'ur-PK' : 'en-GB', {
      timeZone: tz, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** Live clock string for dashboard */
export function currentClock(tz = DEFAULT_TZ): { time: string; date: string } {
  const now = new Date()
  const time = now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const date = now.toLocaleDateString('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return { time, date }
}

/** days from today (negative = past). Uses date-only diff in given tz. */
export function daysFromToday(isoDate: string | undefined, tz = DEFAULT_TZ): number | null {
  if (!isoDate) return null
  const today = todayISO(tz)
  return daysBetween(today, isoDate)
}

export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO + 'T00:00:00')
  const b = new Date(bISO + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** weekday name short for a yyyy-mm-dd */
export function weekdayOf(iso: string, lang: Lang = 'en'): string {
  try {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { weekday: 'short' })
  } catch {
    return ''
  }
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7) // yyyy-mm
}

export function monthLabel(key: string, lang: Lang = 'en'): string {
  try {
    const [y, m] = key.split('-').map(Number)
    const d = new Date(y, m - 1, 1)
    return d.toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { month: 'short' }) + ' ' + y
  } catch {
    return key
  }
}

/** last n months keys, oldest first */
export function lastMonths(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

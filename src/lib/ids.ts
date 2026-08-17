// ID generation + idempotency keys

let counterSeq = 0
export function uid(prefix = ''): string {
  counterSeq = (counterSeq + 1) % 1_000_000
  return `${prefix}${Date.now().toString(36)}-${counterSeq.toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** Idempotency key for duplicate-save protection */
export function clientKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return uid('ck-')
}

/** yyyymmdd from a Date */
export function ymdKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** Readable transaction id: HK-20260812-0001 (per-day counter) */
export function nextTransactionId(counters: Record<string, number>, date: string): { id: string; counters: Record<string, number> } {
  const key = date.replace(/-/g, '')
  const next = (counters[key] || 0) + 1
  return { id: `HK-${key}-${String(next).padStart(4, '0')}`, counters: { ...counters, [key]: next } }
}

/** Readable payment id: PAY-20260812-0001 */
export function nextPaymentId(counters: Record<string, number>, date: string): { id: string; counters: Record<string, number> } {
  const key = date.replace(/-/g, '')
  const next = (counters[key] || 0) + 1
  return { id: `PAY-${key}-${String(next).padStart(4, '0')}`, counters: { ...counters, [key]: next } }
}

export function nextSeqId(prefix: string, seq: number): string {
  return `${prefix}${String(seq).padStart(5, '0')}`
}

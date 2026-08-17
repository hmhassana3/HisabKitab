// Client-side form validation helpers

export interface FieldError {
  field: string
  message: string
}

export type Validator = (v: string | undefined) => string | null

export const required = (msg: string): Validator => (v) => (!v || !v.trim() ? msg : null)

export const phoneValid: Validator = (v) => {
  if (!v) return null
  const digits = v.replace(/[^\d+]/g, '')
  if (!/^\+?\d{10,14}$/.test(digits)) return 'phoneInvalid'
  return null
}

export const emailValid: Validator = (v) => {
  if (!v) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'emailInvalid'
}

export const amountValid: Validator = (v) => {
  if (!v) return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) && n >= 0 ? null : 'amountInvalid'
}

export const positiveNumber = (msg: string): Validator => (v) => {
  if (!v) return msg
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? null : msg
}

// Reminder / email template builder + channel link helpers.
// Channels are FREE and need no account:
//  • Email   → mailto: link (customer ka email app khulta hai)
//  • WhatsApp→ wa.me link (free WhatsApp message, no API)
//  • SMS     → sms: link (phone ka SMS app khulta hai)
//  • Call    → tel: link (dial action)
import type { Customer, EmailChannel, Paisa, ShopProfile } from '../types'
import { formatMoney } from './money'
import { formatDate, daysFromToday } from './date'
import { translate, type TKey } from '../i18n'
import type { Lang } from '../types'

export interface ReminderText {
  subject: string
  body: string
}

export function buildReminderText(kind: 'due' | 'overdue' | 'weekly', customer: Customer, amount: Paisa, dueDate: string | undefined, shop: ShopProfile | null, lang: Lang): ReminderText {
  const t = (k: TKey, v?: Record<string, string | number>) => translate(lang, k, v)
  const shopName = shop?.name || 'Meri dukaan'
  const dateStr = formatDate(dueDate || new Date().toISOString().slice(0, 10), lang)
  const amt = formatMoney(amount, shop?.currency === 'PKR' ? 'Rs.' : 'Rs.')
  const vars = { name: customer.name, shop: shopName, amount: amt, date: dateStr }
  if (kind === 'due') return { subject: t('rem_dueTodaySubject'), body: t('rem_dueTodayBody', vars) }
  if (kind === 'overdue') return { subject: t('rem_overdueSubject'), body: t('rem_overdueBody', vars) }
  return { subject: t('rem_weeklySubject'), body: t('rem_weeklyBody', vars) }
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

/** Pakistan format for wa.me: 0XXXXXXXXXX → 92XXXXXXXXXX */
export function whatsappNumber(phone: string): string {
  let p = normalizePhone(phone)
  if (p.startsWith('+')) p = p.slice(1)
  if (p.startsWith('00')) p = p.slice(2)
  if (p.startsWith('0')) p = '92' + p.slice(1)
  return p
}

export function channelLink(channel: EmailChannel, customer: Customer, text: ReminderText): string | null {
  if (channel === 'mailto') {
    if (!customer.email) return null
    return `mailto:${customer.email}?subject=${encodeURIComponent(text.subject)}&body=${encodeURIComponent(text.body)}`
  }
  if (channel === 'whatsapp') {
    if (!customer.phone) return null
    const num = whatsappNumber(customer.phone)
    return `https://wa.me/${num}?text=${encodeURIComponent(`${text.subject}\n\n${text.body}`)}`
  }
  if (channel === 'sms') {
    if (!customer.phone) return null
    const num = normalizePhone(customer.phone).replace('+', '')
    return `sms:${num}?body=${encodeURIComponent(text.body)}`
  }
  return null
}

export function callLink(phone: string): string {
  return `tel:${normalizePhone(phone)}`
}

export function daysLateText(dueDate: string, lang: Lang, tz: string): number | null {
  const d = daysFromToday(dueDate, tz)
  return d === null ? null : -d
}

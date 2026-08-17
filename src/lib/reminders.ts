// Reminder engine — runs on app load (and every time the app is opened).
// It finds due / overdue / weekly reminders and:
//   1. Creates in-app notifications for the shopkeeper
//   2. Prepares reminder entries in the email log (send via Email/WhatsApp/SMS)
// Dedup via reminders collection (customerId + kind + dateKey) — no duplicates.
import type { AppNotification, Customer, EmailLogEntry, Payment, ReminderRun, ShopProfile, Transaction, AppSettings } from '../types'
import { customerBalance, customerDueDate } from './ledger'
import { todayISO, addDaysISO } from './date'
import { buildReminderText } from './emails'
import { formatMoney } from './money'
import { uid } from './ids'
import { translate } from '../i18n'

export interface ReminderEngineResult {
  notifications: AppNotification[]
  emailLog: EmailLogEntry[]
  runs: ReminderRun[]
}

export function runReminderEngine(
  customers: Record<string, Customer>,
  txns: Record<string, Transaction>,
  pays: Record<string, Payment>,
  shop: ShopProfile | null,
  settings: AppSettings,
  existingRuns: Record<string, ReminderRun>,
): ReminderEngineResult {
  const notifications: AppNotification[] = []
  const emailLog: EmailLogEntry[] = []
  const runs: ReminderRun[] = []
  const today = todayISO(settings.timezone)
  const lang = settings.language
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v)

  const alreadyRan = (customerId: string, kind: string) => {
    const key = `${customerId}:${kind}:${today}`
    return Boolean(existingRuns[key])
  }
  const markRan = (customerId: string, kind: string) => {
    const key = `${customerId}:${kind}:${today}`
    runs.push({ id: key, customerId, kind, dateKey: today, createdAt: new Date().toISOString() })
  }

  const prepReminder = (customer: Customer, kind: 'due' | 'overdue' | 'weekly', amount: number, dueDate: string | undefined) => {
    const text = buildReminderText(kind, customer, amount, dueDate, shop, lang)
    const hasChannel = customer.email || customer.phone
    if (!hasChannel) return
    const channel = customer.email ? 'mailto' : customer.phone ? 'whatsapp' : 'mailto'
    emailLog.push({
      id: uid('EL-'),
      customerId: customer.id,
      kind,
      to: channel === 'mailto' ? customer.email || '' : customer.phone || '',
      subject: text.subject,
      body: text.body,
      channel,
      status: 'prepared',
      createdAt: new Date().toISOString(),
    })
    notifications.push({
      id: uid('N-'),
      type: 'reminder_sent',
      title: t('notif_reminderSent'),
      body: t('notif_reminderSentBody', { name: customer.name }),
      customerId: customer.id,
      read: false,
      createdAt: new Date().toISOString(),
    })
  }

  for (const c of Object.values(customers)) {
    if (c.archived) continue
    const bal = customerBalance(txns, pays, c.id)
    if (bal <= 0) continue
    const due = customerDueDate(txns, c.id)
    const amt = formatMoney(bal, shop?.currency === 'PKR' ? 'Rs.' : 'Rs.')

    // Due today → notify shopkeeper
    if (settings.reminders.dueOn && due === today && !alreadyRan(c.id, 'due')) {
      markRan(c.id, 'due')
      notifications.push({
        id: uid('N-'),
        type: 'payment_due',
        title: t('notif_paymentDue'),
        body: t('notif_paymentDueBody', { name: c.name, amount: amt }),
        customerId: c.id,
        read: false,
        createdAt: new Date().toISOString(),
      })
      if (c.reminderConsent) prepReminder(c, 'due', bal, due)
    }

    // Overdue → per configured frequency [2, 4, 7 ...]
    if (settings.reminders.overdueOn && due && due < today) {
      const late = Math.round((Date.parse(today + 'T00:00:00') - Date.parse(due + 'T00:00:00')) / 86400000)
      const schedule = settings.reminders.overdueSchedule?.length ? settings.reminders.overdueSchedule : [2, 4, 7]
      for (const day of schedule) {
        if (late === day && !alreadyRan(c.id, `overdue-${day}`)) {
          markRan(c.id, `overdue-${day}`)
          notifications.push({
            id: uid('N-'),
            type: 'overdue',
            title: t('notif_overdue'),
            body: t('notif_overdueBody', { name: c.name, amount: amt, days: day }),
            customerId: c.id,
            read: false,
            createdAt: new Date().toISOString(),
          })
          if (c.reminderConsent) prepReminder(c, 'overdue', bal, due)
        }
      }
    }

    // Weekly reminder on configured day
    if (settings.reminders.weeklyOn && !alreadyRan(c.id, 'weekly')) {
      const dow = new Date(today + 'T00:00:00').getDay()
      if (dow === settings.reminders.weeklyDay) {
        markRan(c.id, 'weekly')
        if (c.reminderConsent) prepReminder(c, 'weekly', bal, due)
      }
    }
  }

  return { notifications, emailLog, runs }
}

export { addDaysISO }

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  AppNotification, AppSettings, Attachment, AttachmentKind, AuditAction, AuditEntry, CollectionName,
  Customer, DriveDBShape, EmailLogEntry, EmailChannel, Expense, Lang, Paisa, Payment, PaymentMethod,
  ReminderRun, ShopProfile, Transaction, TxnItem, VoiceRecord,
} from '../types'
import { DriveDB, type SyncStatus } from '../drive/db'
import { getClientId, hasClientId, refreshAccessToken, revokeToken, setClientId as persistClientId, setLiveToken, signInWithGoogle, type GoogleUser } from '../drive/auth'
import { nextPaymentId, nextSeqId, nextTransactionId, uid } from '../lib/ids'
import { nowISO, todayISO } from '../lib/date'
import { runReminderEngine } from '../lib/reminders'
import { buildReminderText, channelLink } from '../lib/emails'
import { sum } from '../lib/money'

export interface Toast {
  id: number
  message: string
  kind: 'success' | 'error' | 'info'
}

export interface CustomerInput {
  name: string
  fatherName?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  photoId?: string
  reminderConsent?: boolean
}

export interface TransactionInput {
  clientKey: string
  customerId: string
  date: string
  items: TxnItem[]
  subtotal: Paisa
  totalDiscount: Paisa
  total: Paisa
  paid: Paisa
  dueDate?: string
  promiseDate?: string
  promiseAmount?: Paisa
  promiseNote?: string
  note?: string
  paymentMethod?: PaymentMethod
}

export interface PaymentInput {
  clientKey: string
  customerId: string
  amount: Paisa
  date: string
  method: PaymentMethod
  reference?: string
  note?: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  theme: 'light',
  reminders: { weeklyOn: false, weeklyDay: 0, weeklyTime: '09:00', dueOn: true, overdueOn: true, overdueSchedule: [2, 4, 7], time: '09:00' },
  notificationsOn: true,
  currency: 'PKR',
  timezone: 'Asia/Karachi',
}

interface AppCtxType {
  user: GoogleUser | null
  booted: boolean
  ready: boolean
  status: SyncStatus
  online: boolean
  data: DriveDBShape
  db: DriveDB
  lang: Lang
  setLang: (l: Lang) => void
  toast: Toast | null
  showToast: (message: string, kind?: Toast['kind']) => void
  signIn: () => Promise<void>
  logout: () => Promise<void>
  setupClientId: (id: string) => void
  clientId: string

  getShop: () => ShopProfile | null
  saveShop: (patch: Partial<ShopProfile>) => void
  getSettings: () => AppSettings
  saveSettings: (patch: Partial<AppSettings>) => void

  createCustomer: (input: CustomerInput) => Customer
  updateCustomer: (id: string, patch: Partial<Customer>, reason?: string) => void
  archiveCustomer: (id: string) => void
  restoreCustomer: (id: string) => void

  createTransaction: (input: TransactionInput) => Transaction | null
  voidTransaction: (id: string, reason: string) => void

  createPayment: (input: PaymentInput) => Payment | null
  voidPayment: (id: string, reason: string) => void

  addAttachment: (kind: AttachmentKind, blob: Blob, name: string, refs: { customerId?: string; transactionId?: string }) => Promise<Attachment>
  removeAttachment: (id: string) => Promise<void>

  addVoice: (speaker: 'customer' | 'shopkeeper', blob: Blob, durationSec: number, refs: { customerId?: string; transactionId?: string }) => Promise<VoiceRecord>
  removeVoice: (id: string) => Promise<void>

  addExpense: (input: { category: string; amount: Paisa; date: string; note?: string }) => void
  deleteExpense: (id: string) => void
  linkTransactionEvidence: (txnId: string, customerId: string, photoIds: string[], voiceIds: string[]) => void

  addNotification: (n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void

  logEmail: (entry: Omit<EmailLogEntry, 'id' | 'createdAt' | 'status'> & { status?: EmailLogEntry['status'] }) => void
  sendReminder: (customerId: string, channel: EmailChannel) => void

  runReminderCheck: () => void
  forceSync: () => Promise<void>
  auditCount: number
}

const AppCtx = createContext<AppCtxType | null>(null)

export function useApp(): AppCtxType {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}

export function AppProvider({ children }: { children: ReactNode }) {
  const dbRef = useRef<DriveDB | null>(null)
  if (!dbRef.current) dbRef.current = new DriveDB({
    onStatus: (s) => setStatus(s),
    onData: () => setData({ ...dbRef.current!.stores }),
  })

  const [user, setUser] = useState<GoogleUser | null>(null)
  const [booted, setBooted] = useState(false)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<SyncStatus>('offline')
  const [online, setOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [data, setData] = useState<DriveDBShape>(dbRef.current.stores)
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('hk_lang') as Lang | null
    return saved === 'ur' ? 'ur' : 'en'
  })
  const [toast, setToast] = useState<Toast | null>(null)
  const [clientId, setClientIdState] = useState<string>(getClientId())
  const bootGuard = useRef(false)

  const db = dbRef.current

  // ── helpers ────────────────────────────────────────────────
  const mutate = useCallback((c: CollectionName) => {
    setData({ ...db.stores })
    void c
  }, [db])

  const showToast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random()
    setToast({ id, message, kind })
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 3200)
  }, [])

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem('hk_lang', l)
    setLangState(l)
  }, [])

  const setupClientId = useCallback((id: string) => {
    persistClientId(id)
    setClientIdState(getClientId())
  }, [])

  const audit = useCallback((action: AuditAction, entityType: string, entityId: string, summary: string, oldValue?: unknown, newValue?: unknown, reason?: string) => {
    const entry: AuditEntry = {
      id: uid('AU-'),
      ts: nowISO(),
      actor: user?.email || 'unknown',
      action, entityType, entityId, summary,
      ...(oldValue !== undefined ? { oldValue } : {}),
      ...(newValue !== undefined ? { newValue } : {}),
      ...(reason ? { reason } : {}),
    }
    db.upsert('audits', entry)
    mutate('audits')
  }, [db, mutate, user])

  // ── boot / session restore ─────────────────────────────────
  useEffect(() => {
    if (bootGuard.current) return
    bootGuard.current = true
    void (async () => {
      const cached = localStorage.getItem('hk_user_json')
      if (cached && hasClientId()) {
        try {
          const u = JSON.parse(cached) as GoogleUser
          const tok = await refreshAccessToken()
          setLiveToken(tok)
          setUser({ ...u, accessToken: tok })
          await db.boot()
          ensureDefaults()
          runReminderCheckInternal()
        } catch {
          setUser(null)
          await db.boot()
        }
      } else {
        await db.boot()
      }
      setReady(true)
      setBooted(true)
    })()
    const onOff = () => setOnline(false)
    const onOn = () => setOnline(true)
    window.addEventListener('offline', onOff)
    window.addEventListener('online', onOn)
    return () => {
      window.removeEventListener('offline', onOff)
      window.removeEventListener('online', onOn)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── defaults ───────────────────────────────────────────────
  const ensureDefaults = useCallback(() => {
    if (!db.getStore<ShopProfile>('shop')['main']) {
      const shop: ShopProfile = {
        id: 'main', name: 'Meri Dukaan', ownerName: user?.name || '', phone: '', address: '', email: user?.email || '',
        currency: 'PKR', timezone: 'Asia/Karachi', receiptFooter: 'Shukriya!', createdAt: nowISO(), updatedAt: nowISO(),
      }
      db.upsert('shop', shop)
    }
    if (!db.getStore<AppSettings>('settings')['main']) {
      db.upsert<AppSettings & { id: string; updatedAt: string }>('settings', { id: 'main', ...DEFAULT_SETTINGS, language: lang, updatedAt: nowISO() })
    }
    mutate('shop')
    mutate('settings')
  }, [db, lang, mutate, user])

  const getShop = useCallback((): ShopProfile | null => db.getStore<ShopProfile>('shop')['main'] || null, [db])
  const getSettings = useCallback((): AppSettings => db.getStore<AppSettings>('settings')['main'] || DEFAULT_SETTINGS, [db])

  const saveShop = useCallback((patch: Partial<ShopProfile>) => {
    const cur = getShop() || { id: 'main', name: '', ownerName: '', phone: '', address: '', email: '', currency: 'PKR', timezone: 'Asia/Karachi', receiptFooter: '', createdAt: nowISO(), updatedAt: nowISO() }
    const next: ShopProfile = { ...cur, ...patch, updatedAt: nowISO() }
    db.upsert('shop', next)
    audit('shop_updated', 'shop', 'main', 'Shop profile updated', cur, next)
    mutate('shop')
  }, [audit, db, getShop, mutate])

  const saveSettings = useCallback((patch: Partial<AppSettings>) => {
    const cur = getSettings()
    const next: AppSettings = { ...cur, ...patch }
    if (patch.language && patch.language !== cur.language) setLang(patch.language)
    db.upsert<AppSettings & { id: string; updatedAt: string }>('settings', { ...next, id: 'main', updatedAt: nowISO() })
    audit('settings_updated', 'settings', 'main', 'Settings updated')
    mutate('settings')
  }, [audit, db, getSettings, mutate, setLang])

  // ── customers ──────────────────────────────────────────────
  const createCustomer = useCallback((input: CustomerInput): Customer => {
    const seq = (db.getCounters().seq || 0) + 1
    db.setCounter({ ...db.getCounters(), seq })
    const c: Customer = {
      id: nextSeqId('C-', seq),
      name: input.name.trim(),
      fatherName: input.fatherName?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      address: input.address?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      photoId: input.photoId || undefined,
      reminderConsent: input.reminderConsent,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }
    db.upsert('customers', c)
    audit('customer_created', 'customer', c.id, `Customer "${c.name}" created`, undefined, c)
    mutate('customers')
    mutate('counters')
    return c
  }, [audit, db, mutate])

  const updateCustomer = useCallback((id: string, patch: Partial<Customer>, reason?: string) => {
    const cur = db.getStore<Customer>('customers')[id]
    if (!cur) return
    const next: Customer = { ...cur, ...patch, id, updatedAt: nowISO() }
    db.upsert('customers', next)
    audit('customer_edited', 'customer', id, `Customer "${next.name}" edited`, cur, next, reason)
    mutate('customers')
  }, [audit, db, mutate])

  const archiveCustomer = useCallback((id: string) => {
    const cur = db.getStore<Customer>('customers')[id]
    if (!cur) return
    const next = { ...cur, archived: true, updatedAt: nowISO() }
    db.upsert('customers', next)
    audit('customer_archived', 'customer', id, `Customer "${cur.name}" archived`)
    mutate('customers')
  }, [audit, db, mutate])

  const restoreCustomer = useCallback((id: string) => {
    const cur = db.getStore<Customer>('customers')[id]
    if (!cur) return
    const next = { ...cur, archived: false, updatedAt: nowISO() }
    db.upsert('customers', next)
    audit('customer_restored', 'customer', id, `Customer "${cur.name}" restored`)
    mutate('customers')
  }, [audit, db, mutate])

  // ── transactions ───────────────────────────────────────────
  const createTransaction = useCallback((input: TransactionInput): Transaction | null => {
    // idempotency: duplicate-save protection via client key
    const existing = Object.values(db.getStore<Transaction>('transactions')).find((t) => t.clientKey === input.clientKey)
    if (existing) return existing
    const counters = db.getCounters()
    const { id, counters: nextCounters } = nextTransactionId(counters.txn || {}, input.date)
    db.setCounter({ ...counters, txn: nextCounters })
    const now = nowISO()
    const txn: Transaction = {
      id,
      clientKey: input.clientKey,
      customerId: input.customerId,
      date: input.date,
      items: input.items,
      subtotal: input.subtotal,
      totalDiscount: input.totalDiscount,
      total: input.total,
      paid: input.paid,
      dueDate: input.dueDate || undefined,
      promiseDate: input.promiseDate || undefined,
      promiseAmount: input.promiseAmount,
      promiseNote: input.promiseNote?.trim() || undefined,
      note: input.note?.trim() || undefined,
      paymentMethod: input.paymentMethod,
      attachmentIds: [],
      voiceIds: [],
      createdAt: now,
      updatedAt: now,
    }
    db.upsert('transactions', txn)
    audit('transaction_created', 'transaction', id, `Transaction ${id} — ${input.items.map((i) => i.name).join(', ')}`, undefined, txn)
    mutate('transactions')
    mutate('counters')
    return txn
  }, [audit, db, mutate])

  const voidTransaction = useCallback((id: string, reason: string) => {
    const cur = db.getStore<Transaction>('transactions')[id]
    if (!cur) return
    const next: Transaction = { ...cur, voided: true, voidReason: reason, voidedAt: nowISO(), updatedAt: nowISO() }
    db.upsert('transactions', next)
    audit('transaction_voided', 'transaction', id, `Transaction ${id} voided`, cur, next, reason)
    mutate('transactions')
  }, [audit, db, mutate])

  // ── payments ───────────────────────────────────────────────
  const createPayment = useCallback((input: PaymentInput): Payment | null => {
    const existing = Object.values(db.getStore<Payment>('payments')).find((p) => p.clientKey === input.clientKey)
    if (existing) return existing
    const counters = db.getCounters()
    const { id, counters: nextCounters } = nextPaymentId(counters.pay || {}, input.date)
    db.setCounter({ ...counters, pay: nextCounters })
    const now = nowISO()
    const pay: Payment = {
      id,
      clientKey: input.clientKey,
      customerId: input.customerId,
      amount: input.amount,
      date: input.date,
      method: input.method,
      reference: input.reference?.trim() || undefined,
      note: input.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    }
    db.upsert('payments', pay)
    audit('payment_created', 'payment', id, `Payment ${id} — ${input.amount}`, undefined, pay)
    const c = db.getStore<Customer>('customers')[input.customerId]
    if (c) {
      addNotificationInternal({
        type: 'payment_received',
        title: 'Payment received',
        body: `${c.name} — ${input.amount}`,
        customerId: c.id,
      })
    }
    mutate('payments')
    mutate('counters')
    return pay
  }, [audit, db, mutate])

  const voidPayment = useCallback((id: string, reason: string) => {
    const cur = db.getStore<Payment>('payments')[id]
    if (!cur) return
    const next: Payment = { ...cur, voided: true, voidReason: reason, voidedAt: nowISO(), updatedAt: nowISO() }
    db.upsert('payments', next)
    audit('payment_voided', 'payment', id, `Payment ${id} voided`, cur, next, reason)
    mutate('payments')
  }, [audit, db, mutate])

  // ── attachments / voice ────────────────────────────────────
  const addAttachment = useCallback(async (kind: AttachmentKind, blob: Blob, name: string, refs: { customerId?: string; transactionId?: string }): Promise<Attachment> => {
    const seq = (db.getCounters().seq || 0) + 1
    db.setCounter({ ...db.getCounters(), seq })
    const res = await db.uploadMedia('photos', `${uid('p')}.jpg`, blob, blob.type || 'image/jpeg')
    const att: Attachment = {
      id: nextSeqId('ATT-', seq),
      kind, fileId: res.fileId, name, mimeType: blob.type || 'image/jpeg', size: res.size,
      customerId: refs.customerId, transactionId: refs.transactionId,
      createdAt: nowISO(), updatedAt: nowISO(),
    }
    db.upsert('attachments', att)
    audit('photo_added', 'attachment', att.id, `Photo added (${kind})`, undefined, att)
    mutate('attachments')
    mutate('counters')
    return att
  }, [audit, db, mutate])

  const removeAttachment = useCallback(async (id: string) => {
    const att = db.getStore<Attachment>('attachments')[id]
    if (!att) return
    await db.deleteMedia(att.fileId)
    db.remove('attachments', id)
    audit('photo_deleted', 'attachment', id, `Photo deleted`)
    mutate('attachments')
  }, [audit, db, mutate])

  const addVoice = useCallback(async (speaker: 'customer' | 'shopkeeper', blob: Blob, durationSec: number, refs: { customerId?: string; transactionId?: string }): Promise<VoiceRecord> => {
    const seq = (db.getCounters().seq || 0) + 1
    db.setCounter({ ...db.getCounters(), seq })
    const res = await db.uploadMedia('voice', `${uid('v')}.webm`, blob, blob.type || 'audio/webm')
    const v: VoiceRecord = {
      id: nextSeqId('VOI-', seq),
      speaker, fileId: res.fileId, durationSec, mimeType: blob.type || 'audio/webm', size: res.size,
      customerId: refs.customerId, transactionId: refs.transactionId,
      consentText: 'Zabani ijazat li gayi',
      createdAt: nowISO(), updatedAt: nowISO(),
    }
    db.upsert('voices', v)
    audit('voice_added', 'voice', v.id, `Voice added (${speaker})`, undefined, v)
    mutate('voices')
    mutate('counters')
    return v
  }, [audit, db, mutate])

  const removeVoice = useCallback(async (id: string) => {
    const v = db.getStore<VoiceRecord>('voices')[id]
    if (!v) return
    await db.deleteMedia(v.fileId)
    db.remove('voices', id)
    audit('voice_deleted', 'voice', id, `Voice deleted`)
    mutate('voices')
  }, [audit, db, mutate])

  // ── expenses ───────────────────────────────────────────────
  const addExpense = useCallback((input: { category: string; amount: Paisa; date: string; note?: string }) => {
    const seq = (db.getCounters().seq || 0) + 1
    db.setCounter({ ...db.getCounters(), seq })
    const e: Expense = {
      id: nextSeqId('EXP-', seq), category: input.category, amount: input.amount, date: input.date,
      note: input.note?.trim() || undefined, createdAt: nowISO(), updatedAt: nowISO(),
    }
    db.upsert('expenses', e)
    audit('expense_created', 'expense', e.id, `Expense ${e.category} ${e.amount}`)
    mutate('expenses')
    mutate('counters')
  }, [audit, db, mutate])

  const linkTransactionEvidence = useCallback((txnId: string, customerId: string, photoIds: string[], voiceIds: string[]) => {
    let changed = false
    for (const pid of photoIds) {
      const a = db.getStore<Attachment>('attachments')[pid]
      if (a) { db.upsert('attachments', { ...a, ...(txnId ? { transactionId: txnId } : {}), customerId: customerId || a.customerId, updatedAt: nowISO() }); changed = true }
    }
    for (const vid of voiceIds) {
      const v = db.getStore<VoiceRecord>('voices')[vid]
      if (v) { db.upsert('voices', { ...v, ...(txnId ? { transactionId: txnId } : {}), customerId: customerId || v.customerId, updatedAt: nowISO() }); changed = true }
    }
    if (changed) { mutate('attachments'); mutate('voices') }
  }, [db, mutate])

  const deleteExpense = useCallback((id: string) => {
    const e = db.getStore<Expense>('expenses')[id]
    if (!e) return
    db.remove('expenses', id)
    audit('expense_deleted', 'expense', id, `Expense deleted`)
    mutate('expenses')
  }, [audit, db, mutate])

  // ── notifications ──────────────────────────────────────────
  const addNotificationInternal = useCallback((n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => {
    const entry: AppNotification = { ...n, id: uid('N-'), read: false, createdAt: nowISO() }
    db.upsert('notifications', entry)
    mutate('notifications')
  }, [db, mutate])

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => {
    addNotificationInternal(n)
  }, [addNotificationInternal])

  const markNotificationRead = useCallback((id: string) => {
    const n = db.getStore<AppNotification>('notifications')[id]
    if (!n || n.read) return
    db.upsert('notifications', { ...n, read: true })
    mutate('notifications')
  }, [db, mutate])

  const markAllNotificationsRead = useCallback(() => {
    const items = db.getStore<AppNotification>('notifications')
    let changed = false
    for (const n of Object.values(items)) {
      if (!n.read) { db.upsert('notifications', { ...n, read: true }); changed = true }
    }
    if (changed) mutate('notifications')
  }, [db, mutate])

  const clearNotifications = useCallback(() => {
    db.remove('notifications', '__all__') // no-op safety
    const items = Object.keys(db.getStore<AppNotification>('notifications'))
    items.forEach((id) => db.remove('notifications', id))
    mutate('notifications')
  }, [db, mutate])

  // ── email log / reminders ──────────────────────────────────
  const logEmail = useCallback((entry: Omit<EmailLogEntry, 'id' | 'createdAt' | 'status'> & { status?: EmailLogEntry['status'] }) => {
    const e: EmailLogEntry = { ...entry, id: uid('EL-'), status: entry.status || 'prepared', createdAt: nowISO() }
    db.upsert('emailLog', e)
    audit('email_prepared', 'email', e.id, `Reminder prepared for ${entry.to}`)
    mutate('emailLog')
  }, [audit, db, mutate])

  const sendReminder = useCallback((customerId: string, channel: EmailChannel) => {
    const c = db.getStore<Customer>('customers')[customerId]
    if (!c) return
    const shop = getShop()
    const txns = db.getStore<Transaction>('transactions')
    const pays = db.getStore<Payment>('payments')
    const bal = sum(Object.values(txns).filter((t) => t.customerId === customerId && !t.voided).map((t) => t.total))
      - sum(Object.values(pays).filter((p) => p.customerId === customerId && !p.voided).map((p) => p.amount))
    const dueDates = Object.values(txns).filter((t) => t.customerId === customerId && t.dueDate).map((t) => t.dueDate as string).sort()
    const due = dueDates[dueDates.length - 1]
    const kind = due && due < todayISO() ? 'overdue' : due === todayISO() ? 'due' : 'weekly'
    const text = buildReminderText(kind, c, Math.max(bal, 0), due, shop, getSettings().language)
    const link = channelLink(channel, c, text)
    if (link) {
      window.open(link, '_blank')
      logEmail({ customerId, kind, to: channel === 'mailto' ? c.email || '' : c.phone || '', subject: text.subject, body: text.body, channel, status: 'sent' })
      addNotificationInternal({ type: 'reminder_sent', title: 'Reminder sent', body: c.name, customerId: c.id })
    } else {
      showToast('No contact (email/phone) for this customer', 'error')
    }
  }, [addNotificationInternal, db, getSettings, getShop, logEmail, showToast])

  // ── reminder engine ────────────────────────────────────────
  const runReminderCheckInternal = useCallback(() => {
    const shop = getShop()
    const settings = getSettings()
    if (!settings.notificationsOn && !settings.reminders.dueOn && !settings.reminders.overdueOn && !settings.reminders.weeklyOn) return
    const res = runReminderEngine(
      db.getStore<Customer>('customers'), db.getStore<Transaction>('transactions'), db.getStore<Payment>('payments'),
      shop, settings, db.getStore<ReminderRun>('reminders'),
    )
    let changed = false
    for (const n of res.notifications) { db.upsert('notifications', n); changed = true }
    for (const e of res.emailLog) { db.upsert('emailLog', e); changed = true }
    for (const r of res.runs) { db.upsert('reminders', r); changed = true }
    if (changed) {
      mutate('notifications')
      mutate('emailLog')
      mutate('reminders')
    }
  }, [db, getSettings, getShop, mutate])

  const runReminderCheck = useCallback(() => runReminderCheckInternal(), [runReminderCheckInternal])

  const forceSync = useCallback(async () => {
    try {
      await db.flushQueue()
      setStatus('synced')
      showToast('Sync complete', 'success')
    } catch {
      showToast('Sync failed — check internet', 'error')
    }
  }, [db, showToast])

  // ── auth ───────────────────────────────────────────────────
  const signIn = useCallback(async () => {
    try {
      const u = await signInWithGoogle()
      setLiveToken(u.accessToken)
      localStorage.setItem('hk_user_json', JSON.stringify({ sub: u.sub, email: u.email, name: u.name, picture: u.picture }))
      setUser(u)
      await db.boot()
      ensureDefaults()
      runReminderCheckInternal()
      setReady(true)
      setBooted(true)
      return
    } catch (e) {
      throw e
    }
  }, [db, ensureDefaults, runReminderCheckInternal])

  const logout = useCallback(async () => {
    await revokeToken()
    setLiveToken(null)
    localStorage.removeItem('hk_user_json')
    setUser(null)
  }, [])

  const value = useMemo<AppCtxType>(() => ({
    user, booted, ready, status, online, data, db, lang, setLang, toast, showToast,
    signIn, logout, setupClientId, clientId,
    getShop, saveShop, getSettings, saveSettings,
    createCustomer, updateCustomer, archiveCustomer, restoreCustomer,
    createTransaction, voidTransaction,
    createPayment, voidPayment,
    addAttachment, removeAttachment,
    addVoice, removeVoice,
    addExpense, deleteExpense, linkTransactionEvidence,
    addNotification, markNotificationRead, markAllNotificationsRead, clearNotifications,
    logEmail, sendReminder,
    runReminderCheck, forceSync,
    auditCount: Object.keys(db.getStore<AuditEntry>('audits')).length,
  }), [
    user, booted, ready, status, online, data, db, lang, setLang, toast, showToast,
    signIn, logout, setupClientId, clientId, getShop, saveShop, getSettings, saveSettings,
    createCustomer, updateCustomer, archiveCustomer, restoreCustomer,
    createTransaction, voidTransaction, createPayment, voidPayment,
    addAttachment, removeAttachment, addVoice, removeVoice,
    addExpense, deleteExpense, linkTransactionEvidence, addNotification, markNotificationRead, markAllNotificationsRead, clearNotifications,
    logEmail, sendReminder, runReminderCheck, forceSync,
  ])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

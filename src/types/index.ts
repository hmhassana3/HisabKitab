// ─────────────────────────────────────────────────────────────
// HisabKitab — core domain types
// All money values are INTEGER PAISA (Rs. 1 = 100 paisa).
// Never use floating point for money.
// ─────────────────────────────────────────────────────────────

export type Paisa = number // integer minor units

export type PaymentMethod = 'cash' | 'bank' | 'easypaisa' | 'jazzcash' | 'other'
export type Lang = 'en' | 'ur'
export type Theme = 'light' | 'dark'
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'sync_failed' | 'error'
export type AttachmentKind = 'customer' | 'item' | 'receipt' | 'other'

export interface ShopProfile {
  id: string
  name: string
  ownerName: string
  phone: string
  address: string
  email: string
  currency: string // 'PKR'
  timezone: string // 'Asia/Karachi'
  receiptFooter: string
  logoId?: string
  createdAt: string
  updatedAt: string
}

export interface Customer {
  id: string
  name: string
  fatherName?: string
  phone?: string
  email?: string
  address?: string
  photoId?: string
  notes?: string
  archived?: boolean
  reminderConsent?: boolean // customer ne email/reminder ki ijazat di
  reminderOverride?: {
    weekly?: boolean
    due?: boolean
    overdue?: boolean
    frequencyDays?: number
  }
  createdAt: string
  updatedAt: string
}

export interface TxnItem {
  id: string
  name: string
  sku?: string
  category?: string
  unit?: string
  quantity: number
  originalPrice: Paisa // per unit
  discountType: 'fixed' | 'percent'
  discountValue: number // paisa fixed ya percent (0-100)
  finalPrice: Paisa // per unit, after discount
  lineTotal: Paisa // finalPrice * quantity
  paid: Paisa // "paid against item" (informational)
}

export interface Transaction {
  id: string // HK-YYYYMMDD-NNNN
  clientKey: string // idempotency key (uuid) — duplicate save protection
  customerId: string
  date: string // ISO date (yyyy-mm-dd)
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
  attachmentIds: string[]
  voiceIds: string[]
  voided?: boolean
  voidReason?: string
  voidedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string // PAY-YYYYMMDD-NNNN
  clientKey: string
  customerId: string
  amount: Paisa
  date: string // ISO date
  method: PaymentMethod
  reference?: string
  note?: string
  receiptId?: string
  voided?: boolean
  voidReason?: string
  voidedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Attachment {
  id: string // ATT-...
  kind: AttachmentKind
  customerId?: string
  transactionId?: string
  fileId: string // Google Drive file id
  name: string
  mimeType: string
  size: number
  width?: number
  height?: number
  note?: string
  createdAt: string
  updatedAt: string
}

export interface VoiceRecord {
  id: string // VOI-...
  speaker: 'customer' | 'shopkeeper'
  customerId?: string
  transactionId?: string
  fileId: string
  durationSec: number
  mimeType: string
  size: number
  consentText: string
  createdAt: string
  updatedAt: string
}

export type AuditAction =
  | 'customer_created' | 'customer_edited' | 'customer_archived' | 'customer_restored'
  | 'transaction_created' | 'transaction_edited' | 'transaction_voided'
  | 'payment_created' | 'payment_edited' | 'payment_voided'
  | 'photo_added' | 'photo_deleted'
  | 'voice_added' | 'voice_deleted'
  | 'reminder_sent' | 'email_prepared'
  | 'settings_updated' | 'shop_updated'
  | 'expense_created' | 'expense_deleted'
  | 'export_made' | 'restore_made' | 'backup_made'

export interface AuditEntry {
  id: string
  ts: string // ISO
  actor: string // user email
  action: AuditAction
  entityType: string
  entityId: string
  summary: string
  oldValue?: unknown
  newValue?: unknown
  reason?: string
}

export type NotificationType =
  | 'payment_due' | 'overdue' | 'payment_received' | 'reminder_sent'
  | 'sync_failed' | 'upload_failed' | 'info' | 'expense'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  customerId?: string
  transactionId?: string
  read: boolean
  createdAt: string
}

export type EmailChannel = 'mailto' | 'whatsapp' | 'sms'
export type EmailStatus = 'prepared' | 'sent' | 'failed' | 'retrying'

export interface EmailLogEntry {
  id: string
  customerId: string
  kind: 'weekly' | 'due' | 'overdue' | 'payment_receipt' | 'manual'
  to: string
  subject: string
  body: string
  channel: EmailChannel
  status: EmailStatus
  error?: string
  createdAt: string
}

export interface Expense {
  id: string // EXP-...
  category: string // rent | electricity | salary | transport | other
  amount: Paisa
  date: string
  note?: string
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  language: Lang
  theme: Theme
  reminders: {
    weeklyOn: boolean
    weeklyDay: number // 0-6 (0 = Sunday)
    weeklyTime: string // 'HH:mm'
    dueOn: boolean
    overdueOn: boolean
    overdueSchedule: number[] // days after due: e.g. [2, 4, 7]
    time: string // reminder generation time 'HH:mm'
  }
  notificationsOn: boolean
  currency: string
  timezone: string
}

export interface ReminderRun {
  id: string
  customerId: string
  kind: string
  dateKey: string // yyyy-mm-dd
  createdAt: string
}

export interface CustomerLedgerRow {
  date: string
  description: string
  debit: Paisa // Udhaar
  credit: Paisa // Payment
  balance: Paisa
  refType: 'transaction' | 'payment'
  refId: string
  voided?: boolean
}

export interface Counters {
  txn: Record<string, number> // dateKey -> next seq
  pay: Record<string, number>
  seq: number // generic seq for C-/ATT-/VOI-/EXP-
}

// Map stores: id -> entity. JSON files on Drive are {rev, items: {...}}
export interface FileStore<T> {
  rev: number
  items: Record<string, T>
}

export interface DriveDBShape {
  shop: FileStore<ShopProfile>
  settings: FileStore<AppSettings>
  customers: FileStore<Customer>
  transactions: FileStore<Transaction>
  payments: FileStore<Payment>
  attachments: FileStore<Attachment>
  voices: FileStore<VoiceRecord>
  audits: FileStore<AuditEntry>
  notifications: FileStore<AppNotification>
  emailLog: FileStore<EmailLogEntry>
  expenses: FileStore<Expense>
  reminders: FileStore<ReminderRun>
  counters: FileStore<Counters>
}

export type CollectionName = keyof DriveDBShape

export const COLLECTIONS: CollectionName[] = [
  'shop', 'settings', 'customers', 'transactions', 'payments',
  'attachments', 'voices', 'audits', 'notifications', 'emailLog',
  'expenses', 'reminders', 'counters',
]

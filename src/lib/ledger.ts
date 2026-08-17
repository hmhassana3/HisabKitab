// Ledger / balance derivation — accounting-safe.
// Balance is NEVER stored manually; it is always derived:
//   Balance = Σ(transaction totals, non-void) − Σ(payments, non-void)
import type { Customer, CustomerLedgerRow, Paisa, Payment, Transaction } from '../types'
import { sub, sum } from './money'
import { daysFromToday, todayISO } from './date'

export type CustomerStatus = 'paid' | 'partial' | 'due' | 'overdue' | 'no_balance'

export function activeTransactions(txns: Record<string, Transaction>, customerId: string): Transaction[] {
  return Object.values(txns)
    .filter((t) => t.customerId === customerId && !t.voided)
}

export function activePayments(pays: Record<string, Payment>, customerId: string): Payment[] {
  return Object.values(pays).filter((p) => p.customerId === customerId && !p.voided)
}

export function customerBalance(txns: Record<string, Transaction>, pays: Record<string, Payment>, customerId: string): Paisa {
  const debit = sum(activeTransactions(txns, customerId).map((t) => t.total))
  const credit = sum(activePayments(pays, customerId).map((p) => p.amount))
  return sub(debit, credit)
}

/** Next relevant due date: earliest future due; if none, latest past due. */
export function customerDueDate(txns: Record<string, Transaction>, customerId: string): string | undefined {
  const due = activeTransactions(txns, customerId)
    .map((t) => t.dueDate)
    .filter((x): x is string => Boolean(x))
    .sort()
  if (due.length === 0) return undefined
  const today = todayISO()
  const future = due.filter((d) => d >= today)
  return future[0] || due[due.length - 1]
}

export function customerStatus(txns: Record<string, Transaction>, pays: Record<string, Payment>, customerId: string): CustomerStatus {
  const bal = customerBalance(txns, pays, customerId)
  if (bal <= 0) return 'no_balance'
  const today = todayISO()
  const dues = activeTransactions(txns, customerId)
    .map((t) => t.dueDate)
    .filter((x): x is string => Boolean(x))
    .sort()
  if (dues.some((d) => d < today)) return 'overdue'
  if (dues.some((d) => d === today)) return 'due'
  return 'partial'
}

export function lastTransactionDate(txns: Record<string, Transaction>, customerId: string): string | undefined {
  const dates = activeTransactions(txns, customerId).map((t) => t.date).sort()
  return dates[dates.length - 1]
}

/** Build a running-balance ledger for a customer (sorted by date, then createdAt). */
export function buildLedger(
  txns: Record<string, Transaction>,
  pays: Record<string, Payment>,
  customerId: string,
): CustomerLedgerRow[] {
  type Row = {
    date: string
    createdAt: string
    description: string
    debit: Paisa
    credit: Paisa
    refType: 'transaction' | 'payment'
    refId: string
    voided?: boolean
  }
  const rows: Row[] = []
  for (const t of activeTransactions(txns, customerId)) {
    const itemNames = t.items.map((i) => `${i.name}×${i.quantity}`).join(', ')
    rows.push({
      date: t.date,
      createdAt: t.createdAt,
      description: t.voided ? `[VOID] ${itemNames || 'Transaction'} — ${t.voidReason || ''}` : itemNames || 'Transaction',
      debit: t.total,
      credit: 0,
      refType: 'transaction',
      refId: t.id,
      voided: t.voided,
    })
  }
  for (const p of activePayments(pays, customerId)) {
    rows.push({
      date: p.date,
      createdAt: p.createdAt,
      description: p.voided ? `[VOID] Payment — ${p.voidReason || ''}` : `Payment (${p.method})${p.reference ? ' · ' + p.reference : ''}`,
      debit: 0,
      credit: p.amount,
      refType: 'payment',
      refId: p.id,
      voided: p.voided,
    })
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))

  const out: CustomerLedgerRow[] = []
  let bal = 0
  for (const r of rows) {
    bal = sub(add(bal, r.debit), r.credit)
    out.push({ ...r, balance: bal })
  }
  return out
}

function add(a: number, b: number): number {
  return Math.round(a) + Math.round(b)
}

export interface CustomerWithMeta {
  customer: Customer
  balance: Paisa
  status: CustomerStatus
  dueDate?: string
  lastTxn?: string
}

export function customersWithMeta(
  customers: Record<string, Customer>,
  txns: Record<string, Transaction>,
  pays: Record<string, Payment>,
  includeArchived = false,
): CustomerWithMeta[] {
  const out: CustomerWithMeta[] = []
  for (const c of Object.values(customers)) {
    if (c.archived && !includeArchived) continue
    out.push({
      customer: c,
      balance: customerBalance(txns, pays, c.id),
      status: customerStatus(txns, pays, c.id),
      dueDate: customerDueDate(txns, c.id),
      lastTxn: lastTransactionDate(txns, c.id),
    })
  }
  return out
}

export function formatStatus(status: CustomerStatus): string {
  return status
}

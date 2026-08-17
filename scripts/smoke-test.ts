// Logic smoke test — run with: node scripts/run-smoke.mjs
import { parsePaisa, formatMoney, percentOf, sum } from '../src/lib/money'
import { nextTransactionId, nextPaymentId, ymdKey } from '../src/lib/ids'
import { todayISO, daysBetween, daysFromToday } from '../src/lib/date'
import { customerBalance, buildLedger, customerStatus, customersWithMeta } from '../src/lib/ledger'
import { toCSV } from '../src/lib/csv'
import { buildReminderText, whatsappNumber, normalizePhone } from '../src/lib/emails'
import { runReminderEngine } from '../src/lib/reminders'
import type { Customer, Payment, Transaction, ShopProfile, AppSettings } from '../src/types'

let pass = 0
let fail = 0
function assert(cond: boolean, msg: string) {
  if (cond) { pass++; console.log('  ✓', msg) } else { fail++; console.error('  ✗ FAIL:', msg) }
}

console.log('— money —')
assert(parsePaisa('1234.50') === 123450, 'parsePaisa 1234.50 -> 123450')
assert(parsePaisa('1,234') === 123400, 'parsePaisa 1,234 -> 123400')
assert(parsePaisa('-5') === null, 'negative rejected')
assert(formatMoney(123450) === 'Rs. 1,234.50', 'formatMoney 123450 -> Rs. 1,234.50')
assert(percentOf(100000, 10) === 10000, '10% of 100000 -> 10000')
assert(sum([1.2, 2.8]) === 4, 'sum rounds integers')
// float-safety: 0.1+0.2 style issues
assert(parsePaisa('0.29') + parsePaisa('0.29') === parsePaisa('0.58'), '0.29+0.29 == 0.58 paisa')

console.log('— ids —')
const d = '2026-08-12'
const t1 = nextTransactionId({}, d)
assert(t1.id === 'HK-20260812-0001', 'HK-20260812-0001')
const t2 = nextTransactionId(t1.counters, d)
assert(t2.id === 'HK-20260812-0002', 'HK-20260812-0002')
const p1 = nextPaymentId({}, d)
assert(p1.id === 'PAY-20260812-0001', 'PAY-20260812-0001')
assert(ymdKey(new Date('2026-08-12T10:00:00Z')) === '20260812', 'ymdKey')

console.log('— dates —')
assert(todayISO('Asia/Karachi').length === 10, 'todayISO format')
assert(daysBetween('2026-08-12', '2026-08-17') === 5, 'daysBetween +5')
assert(daysBetween('2026-08-20', '2026-08-12') === -8, 'daysBetween -8')

console.log('— ledger —')
const mkTxn = (id: string, customerId: string, date: string, total: number, dueDate?: string): Transaction => ({
  id, clientKey: id + '-ck', customerId, date, items: [{ id: 'i1', name: 'Kapra', quantity: 1, originalPrice: total, discountType: 'fixed', discountValue: 0, finalPrice: total, lineTotal: total, paid: 0 }],
  subtotal: total, totalDiscount: 0, total, paid: 0, dueDate, attachmentIds: [], voiceIds: [], createdAt: date + 'T10:00:00', updatedAt: date + 'T10:00:00',
})
const mkPay = (id: string, customerId: string, date: string, amount: number): Payment => ({
  id, clientKey: id + '-ck', customerId, amount, date, method: 'cash', createdAt: date + 'T10:00:00', updatedAt: date + 'T10:00:00',
})
const custs: Record<string, Customer> = { c1: { id: 'C-1', name: 'Ali', createdAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00' } }
const txns: Record<string, Transaction> = {
  t1: mkTxn('HK-20260812-0001', 'C-1', '2026-08-12', 500000, '2026-08-17'),
  t2: mkTxn('HK-20260830-0002', 'C-1', '2026-08-30', 150000, '2026-08-12'),
}
const pays: Record<string, Payment> = { p1: mkPay('PAY-20260820-0001', 'C-1', '2026-08-20', 200000) }
// Test 4 from spec: 10,000 udhaar, 2,000 payment → 8,000 remaining
assert(customerBalance(txns, pays, 'C-1') === 500000 + 150000 - 200000, 'balance = 5000+1500-2000 = 4500.00')
assert(customerStatus(txns, pays, 'C-1') === 'overdue', 'status overdue (due 08-12 past)')
const rows = buildLedger(txns, pays, 'C-1')
assert(rows.length === 3, '3 ledger rows')
assert(rows[rows.length - 1].balance === 450000, 'running balance ends at 4500.00')
assert(rows[0].debit === 500000 && rows[0].credit === 0, 'row1 debit 5000')
// void payment → balance back up
const paysVoid = { ...pays, p1: { ...pays.p1, voided: true } }
assert(customerBalance(txns, paysVoid, 'C-1') === 650000, 'void payment restores balance')
const meta = customersWithMeta(custs, txns, pays, true)
assert(meta[0].balance === 450000, 'customersWithMeta balance')

console.log('— csv —')
const csv = toCSV([['name', 'کپڑا'], ['Ali', '5,000']])
assert(csv.startsWith('\uFEFF'), 'CSV has BOM (Excel Urdu support)')
assert(csv.includes('"5,000"'), 'CSV escapes comma')

console.log('— phone / whatsapp —')
assert(whatsappNumber('03001234567') === '923001234567', '0300 → 92300')
assert(whatsappNumber('+92 300 1234567') === '923001234567', '+92 strip')
assert(normalizePhone('03XX-123') === '03123', 'normalize strips letters')

console.log('— reminders —')
const shop: ShopProfile = { id: 'main', name: 'Meri Dukaan', ownerName: '', phone: '', address: '', email: '', currency: 'PKR', timezone: 'Asia/Karachi', receiptFooter: '', createdAt: '', updatedAt: '' }
const settings: AppSettings = {
  language: 'en', theme: 'light',
  reminders: { weeklyOn: true, weeklyDay: new Date().getDay(), weeklyTime: '09:00', dueOn: true, overdueOn: true, overdueSchedule: [2, 4, 7], time: '09:00' },
  notificationsOn: true, currency: 'PKR', timezone: 'Asia/Karachi',
}
const res = runReminderEngine(custs, txns, pays, shop, settings, {})
assert(res.notifications.length >= 1, 'reminders generated notifications')
assert(res.emailLog.every((e) => e.status === 'prepared'), 'email log statuses prepared')
// dedup: second run with existing runs → nothing new
const res2 = runReminderEngine(custs, txns, pays, shop, settings, Object.fromEntries(res.runs.map((r) => [r.id, r])))
assert(res2.notifications.length === 0, 'no duplicate reminders')
const txt = buildReminderText('due', custs.c1, 450000, '2026-08-17', shop, 'en')
assert(txt.body.includes('Rs. 4,500.00'), 'reminder body has amount')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Segmented, StatusBadge, TextArea } from '../components/ui'
import { CustomerForm } from '../components/CustomerForm'
import { PhotoGallery, VoicePlayer } from '../components/Media'
import { Receipt } from '../components/Receipt'
import { IconAlert, IconArchive, IconBack, IconCalculator, IconChart, IconMail, IconPhone, IconPlus, IconReceipt, IconTrash, IconUsers, IconWallet } from '../components/icons'
import { buildLedger, customerBalance, customerDueDate, customerStatus } from '../lib/ledger'
import { formatMoney, formatCompact } from '../lib/money'
import { formatDate, formatDateShort, formatDateTime, daysFromToday, todayISO } from '../lib/date'
import { callLink, channelLink, buildReminderText } from '../lib/emails'
import { elementToPdf, printElement } from '../lib/pdf'
import { useMediaUrl } from '../hooks/useMediaUrl'
import type { Attachment, EmailChannel, Payment, Transaction } from '../types'

type Tab = 'overview' | 'ledger' | 'purchases' | 'payments' | 'photos' | 'voice' | 'receipts' | 'reminders' | 'notes'

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { data, getShop, getSettings, archiveCustomer, restoreCustomer, updateCustomer, addAttachment, removeAttachment, removeVoice, sendReminder, showToast, voidPayment } = useApp()
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('overview')
  const [editOpen, setEditOpen] = useState(false)

  const customer = id ? data.customers.items[id] : undefined
  const shop = getShop()
  const cur = shop?.currency === 'PKR' ? 'Rs.' : 'Rs.'

  const balance = useMemo(() => (id ? customerBalance(data.transactions.items, data.payments.items, id) : 0), [data, id])
  const status = useMemo(() => (id ? customerStatus(data.transactions.items, data.payments.items, id) : 'no_balance'), [data, id])
  const due = useMemo(() => (id ? customerDueDate(data.transactions.items, id) : undefined), [data, id])

  const myTxns = useMemo(() => Object.values(data.transactions.items).filter((x) => x.customerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data, id])
  const myPays = useMemo(() => Object.values(data.payments.items).filter((x) => x.customerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data, id])
  const myAtts = useMemo(() => Object.values(data.attachments.items).filter((x) => x.customerId === id || myTxns.some((tx) => tx.id === x.transactionId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data, id, myTxns])
  const myVoices = useMemo(() => Object.values(data.voices.items).filter((x) => x.customerId === id || myTxns.some((tx) => tx.id === x.transactionId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data, id, myTxns])
  const myEmailLog = useMemo(() => Object.values(data.emailLog.items).filter((x) => x.customerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20), [data, id])

  if (!customer) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-ink-400">{t('customers_noResults')}</p>
        <Button className="mt-4" onClick={() => nav('/customers')}><IconBack width={16} height={16} />{t('nav_customers')}</Button>
      </div>
    )
  }

  const photo = customer.photoId ? data.attachments.items[customer.photoId] : undefined

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'overview', label: t('cprofile_tab_overview') },
    { value: 'ledger', label: t('cprofile_tab_ledger') },
    { value: 'purchases', label: t('cprofile_tab_purchases') },
    { value: 'payments', label: t('cprofile_tab_payments') },
    { value: 'photos', label: t('cprofile_tab_photos') },
    { value: 'voice', label: t('cprofile_tab_voice') },
    { value: 'receipts', label: t('cprofile_tab_receipts') },
    { value: 'reminders', label: t('cprofile_tab_reminders') },
    { value: 'notes', label: t('cprofile_tab_notes') },
  ]

  const onPhotoAdd = async (kind: Attachment['kind'], blob: Blob) => {
    const att = await addAttachment(kind, blob, `photo-${Date.now()}.jpg`, { customerId: customer.id })
    if (kind === 'customer') updateCustomer(customer.id, { photoId: att.id })
    showToast(t('misc_photoSaved'))
  }

  return (
    <div>
      <button onClick={() => nav('/customers')} className="mb-3 flex items-center gap-1 text-xs font-bold text-ink-400 hover:text-brand-600"><IconBack width={14} height={14} />{t('nav_customers')}</button>

      {/* header card */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <CustomerAvatar photoId={customer.photoId} name={customer.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-extrabold text-ink-900 dark:text-ink-50">{customer.name}</h1>
              <StatusBadge status={status} />
              {customer.archived && <Badge color="gray">{t('misc_archived')}</Badge>}
            </div>
            <p className="text-xs text-ink-400">
              {customer.phone && <span dir="ltr">{customer.phone}</span>}
              {customer.phone && customer.email ? ' · ' : ''}
              {customer.email && <span dir="ltr">{customer.email}</span>}
              {customer.address ? ' · ' + customer.address : ''}
            </p>
            <p className="mt-0.5 text-[10px] text-ink-300" dir="ltr">{customer.id}</p>
          </div>
          <div className="text-end">
            <p className="text-[10px] font-bold uppercase text-ink-400">{t('cprofile_balance')}</p>
            <p className={`text-xl font-black ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatMoney(balance, cur)}</p>
            {due && <p className="text-[10px] text-amber-600">{t('txn_dueDate')}: {formatDateShort(due)}</p>}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => nav(`/transactions/new?customer=${customer.id}`)}><IconWallet width={15} height={15} />{t('cprofile_udhaar')}</Button>
          <Button size="sm" variant="success" onClick={() => nav(`/payments/new?customer=${customer.id}`)}><IconReceipt width={15} height={15} />{t('cprofile_payment')}</Button>
          {customer.phone && <Button size="sm" variant="outline" onClick={() => window.location.href = callLink(customer.phone || '')}><IconPhone width={15} height={15} />{t('cprofile_call')}</Button>}
          {customer.email && <Button size="sm" variant="outline" onClick={() => window.location.href = `mailto:${customer.email}`}><IconMail width={15} height={15} />{t('cprofile_email')}</Button>}
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>{t('cprofile_edit')}</Button>
          <Button
            size="sm" variant="ghost"
            onClick={() => {
              if (customer.archived) {
                if (window.confirm(t('cprofile_restoreConfirm'))) restoreCustomer(customer.id)
              } else if (window.confirm(t('cprofile_archiveConfirm'))) archiveCustomer(customer.id)
            }}
          >
            <IconArchive width={15} height={15} />{customer.archived ? t('cprofile_restore') : t('cprofile_archive')}
          </Button>
        </div>
      </Card>

      {/* tabs */}
      <div className="mt-4 overflow-x-auto pb-1">
        <Segmented options={tabs} value={tab} onChange={(v) => setTab(v)} />
      </div>

      <div className="mt-4">
        {tab === 'overview' && <OverviewTab customerId={customer.id} balance={balance} status={status} due={due} myTxns={myTxns} myPays={myPays} shopName={shop?.name || ''} />}
        {tab === 'ledger' && <LedgerTab customerId={customer.id} />}
        {tab === 'purchases' && <PurchasesTab txns={myTxns} cur={cur} onOpen={(tid) => nav(`/transactions/${tid}`)} />}
        {tab === 'payments' && <PaymentsTab pays={myPays} cur={cur} onVoid={(pid) => { const r = window.prompt(t('pay_voidReason')); if (r) voidPayment(pid, r) }} />}
        {tab === 'photos' && (
          <Card className="p-4">
            <PhotoGallery attachments={myAtts} canAdd onAdd={(k, b) => onPhotoAdd(k, b)} onDelete={(aid) => { if (window.confirm(t('misc_confirmDelete'))) void removeAttachment(aid) }} />
          </Card>
        )}
        {tab === 'voice' && (
          <Card className="space-y-2 p-4">
            {myVoices.length === 0 && <EmptyState text={t('misc_noVoice')} />}
            {myVoices.map((v) => <VoicePlayer key={v.id} voice={v} onDelete={() => { if (window.confirm(t('misc_confirmDelete'))) void removeVoice(v.id) }} />)}
          </Card>
        )}
        {tab === 'receipts' && <ReceiptsTab txns={myTxns} />}
        {tab === 'reminders' && (
          <RemindersTab customerId={customer.id} consent={customer.reminderConsent} onConsent={(c) => updateCustomer(customer.id, { reminderConsent: c })} emailLog={myEmailLog} />
        )}
        {tab === 'notes' && (
          <Card className="p-4">
            <TextArea
              defaultValue={customer.notes || ''}
              placeholder={t('cform_notes')}
              onBlur={(e) => { if (e.target.value !== (customer.notes || '')) updateCustomer(customer.id, { notes: e.target.value }) }}
            />
            <p className="mt-2 text-[10px] text-ink-400">{t('cform_dateAdded')}: {formatDate(customer.createdAt)}</p>
          </Card>
        )}
      </div>

      <CustomerForm open={editOpen} onClose={() => setEditOpen(false)} initial={customer} title={t('txn_edit') + ' — ' + customer.name} />
    </div>
  )
}

// ── Overview ─────────────────────────────────────────────────
function OverviewTab({ customerId, balance, status, due, myTxns, myPays, shopName }: { customerId: string; balance: number; status: 'paid' | 'partial' | 'due' | 'overdue' | 'no_balance'; due?: string; myTxns: Transaction[]; myPays: Payment[]; shopName: string }) {
  const { data } = useApp()
  const { t } = useI18n()
  const late = due && due < todayISO() ? (daysFromToday(due) ?? 0) * -1 : 0
  const totalPaid = myPays.reduce((a, p) => a + (p.voided ? 0 : p.amount), 0)
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="p-4">
        <h3 className="text-sm font-bold text-ink-700 dark:text-ink-200">{t('cprofile_tab_overview')}</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-ink-400">{t('cprofile_balance')}</dt><dd className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatMoney(balance)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-400">{t('common_paid')}</dt><dd className="font-bold text-emerald-600">{formatMoney(totalPaid)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-400">{t('customers_lastTxn')}</dt><dd>{myTxns[0] ? formatDateShort(myTxns[0].date) : '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-400">{t('txn_dueDate')}</dt><dd>{due ? formatDateShort(due) : '—'}</dd></div>
          {late > 0 && <div className="flex justify-between text-red-600"><dt>{t('txn_daysLate')}</dt><dd className="font-bold">{late}</dd></div>}
        </dl>
        {status === 'overdue' && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600 dark:bg-red-900/30">
            <IconAlert width={16} height={16} /> {t('status_overdue')} — {t('notif_overdueBody', { name: '', amount: formatMoney(balance), days: late })}
          </div>
        )}
      </Card>
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-bold text-ink-700 dark:text-ink-200">{t('txn_evidence')}</h3>
        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-700"><p className="text-lg font-black text-ink-800 dark:text-ink-100">{myTxns.length}</p><p className="text-ink-400">{t('reports_transactions')}</p></div>
          <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-700"><p className="text-lg font-black text-ink-800 dark:text-ink-100">{myPays.length}</p><p className="text-ink-400">{t('reports_totalPayments')}</p></div>
          <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-700"><p className="text-lg font-black text-ink-800 dark:text-ink-100">{shopName ? '✓' : '—'}</p><p className="text-ink-400">{t('settings_shop')}</p></div>
        </div>
      </Card>
    </div>
  )
}

// ── Ledger ───────────────────────────────────────────────────
function LedgerTab({ customerId }: { customerId: string }) {
  const { data } = useApp()
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState<'all' | 'txn' | 'pay'>('all')

  const rows = useMemo(() => buildLedger(data.transactions.items, data.payments.items, customerId), [data, customerId])

  const filtered = rows.filter((r) => {
    if (q && !r.description.toLowerCase().includes(q.toLowerCase())) return false
    if (from && r.date < from) return false
    if (to && r.date > to) return false
    if (type === 'txn' && r.refType !== 'transaction') return false
    if (type === 'pay' && r.refType !== 'payment') return false
    return true
  })

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 gap-2 border-b border-ink-100 p-3 dark:border-ink-700 sm:grid-cols-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ledger_search')} className="col-span-2 sm:col-span-1" />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-xs" aria-label={t('ledger_from')} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-xs" aria-label={t('ledger_to')} />
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="rounded-xl border border-ink-200 bg-white px-2 py-2 text-xs dark:border-ink-600 dark:bg-ink-900 dark:text-ink-200">
          <option value="all">{t('ledger_all')}</option>
          <option value="txn">{t('ledger_onlyTxn')}</option>
          <option value="pay">{t('ledger_onlyPay')}</option>
        </select>
      </div>
      {filtered.length === 0 && <EmptyState text={t('ledger_empty')} />}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50 text-start text-[10px] font-bold uppercase text-ink-400 dark:border-ink-700 dark:bg-ink-700/50">
              <th className="px-3 py-2 text-start">{t('ledger_date')}</th>
              <th className="px-3 py-2 text-start">{t('ledger_desc')}</th>
              <th className="px-3 py-2 text-end">{t('ledger_debit')}</th>
              <th className="px-3 py-2 text-end">{t('ledger_credit')}</th>
              <th className="px-3 py-2 text-end">{t('ledger_balance')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className={`border-b border-ink-50 dark:border-ink-700/50 ${r.voided ? 'opacity-50 line-through' : ''}`}>
                <td className="px-3 py-2 whitespace-nowrap">{formatDateShort(r.date)}</td>
                <td className="px-3 py-2">{r.description}</td>
                <td className="px-3 py-2 text-end tabular-nums text-red-600">{r.debit > 0 ? formatCompact(r.debit) : ''}</td>
                <td className="px-3 py-2 text-end tabular-nums text-emerald-600">{r.credit > 0 ? formatCompact(r.credit) : ''}</td>
                <td className={`px-3 py-2 text-end font-bold tabular-nums ${r.balance > 0 ? 'text-ink-800 dark:text-ink-100' : 'text-emerald-600'}`}>{formatCompact(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Purchases ────────────────────────────────────────────────
function PurchasesTab({ txns, cur, onOpen }: { txns: Transaction[]; cur: string; onOpen: (id: string) => void }) {
  const { t } = useI18n()
  if (txns.length === 0) return <Card><EmptyState text={t('cprofile_noData')} /></Card>
  return (
    <div className="space-y-2">
      {txns.map((tx) => (
        <Card key={tx.id} className="p-3.5" onClick={() => onOpen(tx.id)}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink-900 dark:text-ink-100" dir="ltr">{tx.id}{tx.voided ? ` — ${t('txn_voided')}` : ''}</p>
              <p className="truncate text-[11px] text-ink-400">{tx.items.map((i) => `${i.name}×${i.quantity}`).join(', ')} · {formatDateShort(tx.date)}</p>
            </div>
            <div className="text-end">
              <p className={`text-sm font-extrabold ${tx.voided ? 'text-ink-300' : 'text-red-600'}`}>{formatCompact(tx.total, cur)}</p>
              {tx.dueDate && <p className="text-[10px] text-amber-600">{t('txn_dueDate')}: {formatDateShort(tx.dueDate)}</p>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── Payments ─────────────────────────────────────────────────
function PaymentsTab({ pays, cur, onVoid }: { pays: Array<{ id: string; amount: number; date: string; method: string; reference?: string; voided?: boolean; createdAt: string }>; cur: string; onVoid: (id: string) => void }) {
  const { t } = useI18n()
  if (pays.length === 0) return <Card><EmptyState text={t('cprofile_noData')} /></Card>
  return (
    <div className="space-y-2">
      {pays.map((p) => (
        <Card key={p.id} className="p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-600">+ {formatCompact(p.amount, cur)}</p>
              <p className="text-[11px] text-ink-400" dir="ltr">{p.id} · {formatDateShort(p.date)} · {p.method}{p.reference ? ' · ' + p.reference : ''}</p>
            </div>
            {!p.voided && (
              <button onClick={() => onVoid(p.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30" title={t('pay_void')}>
                <IconTrash width={15} height={15} />
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── Receipts ─────────────────────────────────────────────────
function ReceiptsTab({ txns }: { txns: Transaction[] }) {
  const { data, getShop, getSettings } = useApp()
  const { t } = useI18n()
  const shop = getShop()
  const lang = getSettings().language
  const [busyId, setBusyId] = useState<string | null>(null)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  const custs = data.customers.items

  if (txns.length === 0) return <Card><EmptyState text={t('cprofile_noData')} /></Card>

  const makePdf = async (tx: Transaction) => {
    const el = refs.current[tx.id]
    if (!el) return
    setBusyId(tx.id)
    try {
      await elementToPdf(el, `${tx.id}-receipt.pdf`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {txns.map((tx) => (
        <Card key={tx.id} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 p-3 dark:border-ink-700">
            <p className="text-sm font-bold" dir="ltr">{tx.id}</p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" disabled={busyId === tx.id} onClick={() => void makePdf(tx)}><IconChart width={14} height={14} />{busyId === tx.id ? t('common_saving') : t('txn_generatePdf')}</Button>
              <Button size="sm" variant="outline" onClick={() => refs.current[tx.id] && printElement(refs.current[tx.id]!)}>{t('txn_print')}</Button>
              <Button size="sm" variant="outline" onClick={() => navigator.share ? navigator.share({ title: tx.id }).catch(() => undefined) : window.open(`mailto:?subject=${encodeURIComponent(tx.id)}`, '_blank')}>{t('txn_share')}</Button>
            </div>
          </div>
          <div className="bg-white">
            <Receipt ref={(el) => { refs.current[tx.id] = el }} shop={shop} customer={custs[tx.customerId] || null} txn={tx} lang={lang} />
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── Reminders ────────────────────────────────────────────────
function RemindersTab({ customerId, consent, onConsent, emailLog }: { customerId: string; consent?: boolean; onConsent: (c: boolean) => void; emailLog: Array<{ id: string; kind: string; to: string; subject: string; body: string; channel: EmailChannel; status: string; createdAt: string }> }) {
  const { data, sendReminder, logEmail, getShop, getSettings } = useApp()
  const { t } = useI18n()
  const cust = data.customers.items[customerId]
  const shop = getShop()
  const lang = getSettings().language
  const txns = Object.values(data.transactions.items).filter((x) => x.customerId === customerId && !x.voided)
  const pays = Object.values(data.payments.items).filter((x) => x.customerId === customerId && !x.voided)
  const bal = txns.reduce((a, x) => a + x.total, 0) - pays.reduce((a, x) => a + x.amount, 0)
  const dueDates = txns.map((x) => x.dueDate).filter(Boolean).sort()
  const due = dueDates[dueDates.length - 1] as string | undefined
  const kind = due && due < todayISO() ? 'overdue' : due === todayISO() ? 'due' : 'weekly'
  const text = buildReminderText(kind, cust, Math.max(bal, 0), due, shop, lang)

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <label className="flex items-center justify-between gap-2 text-sm font-semibold text-ink-700 dark:text-ink-200">
          {t('cform_consent')}
          <input type="checkbox" checked={!!consent} onChange={(e) => onConsent(e.target.checked)} className="h-5 w-5 accent-brand-600" />
        </label>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-bold text-ink-700 dark:text-ink-200">{t('rem_sendReminder')}</h3>
        <p className="mb-3 rounded-xl bg-ink-50 p-3 text-xs text-ink-500 dark:bg-ink-700/50 dark:text-ink-300">
          {text.subject} — {text.body}
        </p>
        <div className="flex flex-wrap gap-2">
          {cust.email && <Button size="sm" onClick={() => sendReminder(customerId, 'mailto')}><IconMail width={14} height={14} />{t('rem_email')}</Button>}
          {cust.phone && <Button size="sm" variant="success" onClick={() => sendReminder(customerId, 'whatsapp')}>{t('rem_whatsapp')}</Button>}
          {cust.phone && <Button size="sm" variant="outline" onClick={() => sendReminder(customerId, 'sms')}>{t('rem_sms')}</Button>}
          {!cust.email && !cust.phone && <p className="text-xs text-ink-400">{t('rem_noPhone')}</p>}
        </div>
        <p className="mt-2 text-[10px] text-ink-400">{t('rem_prepared')}</p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-bold text-ink-700 dark:text-ink-200">{t('rem_logTitle')}</h3>
        {emailLog.length === 0 && <p className="text-xs text-ink-400">{t('cprofile_noData')}</p>}
        <div className="space-y-2">
          {emailLog.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 p-2.5 text-xs dark:bg-ink-700/50">
              <div className="min-w-0">
                <p className="font-bold text-ink-700 dark:text-ink-200">{e.subject} · <span dir="ltr">{e.to}</span></p>
                <p className="truncate text-ink-400">{formatDateTime(e.createdAt)} · {e.channel}</p>
              </div>
              <Badge color={e.status === 'sent' ? 'green' : e.status === 'failed' ? 'red' : 'amber'}>
                {e.status === 'sent' ? t('rem_statusSent') : e.status === 'failed' ? t('rem_statusFailed') : t('rem_statusPrepared')}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── avatar ───────────────────────────────────────────────────
function CustomerAvatar({ photoId, name }: { photoId?: string; name: string }) {
  const { data } = useApp()
  const att = photoId ? data.attachments.items[photoId] : undefined
  const media = useMediaUrl(att?.fileId)
  if (media.url) return <img src={media.url} alt="" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-brand-200 dark:ring-brand-800" />
  return <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-xl font-black text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{name.slice(0, 1).toUpperCase()}</div>
}

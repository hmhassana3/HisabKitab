import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Card, StatCard, SectionTitle, EmptyState, StatusBadge } from '../components/ui'
import { IconChart, IconPhone, IconPlus, IconReceipt, IconSearch, IconUsers, IconWallet, IconAlert, IconCalendar, IconSwap, IconCalculator } from '../components/icons'
import { currentClock, daysFromToday, formatDate, formatDateShort } from '../lib/date'
import { formatMoney, sum } from '../lib/money'
import { customerBalance, customerDueDate, customersWithMeta } from '../lib/ledger'
import { callLink } from '../lib/emails'

export function Dashboard() {
  const { data, user, getShop, getSettings } = useApp()
  const { t } = useI18n()
  const nav = useNavigate()
  const shop = getShop()
  const settings = getSettings()
  const [clock, setClock] = useState(() => currentClock(settings.timezone))

  useEffect(() => {
    const iv = setInterval(() => setClock(currentClock(settings.timezone)), 1000)
    return () => clearInterval(iv)
  }, [settings.timezone])

  const txns = data.transactions.items
  const pays = data.payments.items
  const custs = data.customers.items

  const stats = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: settings.timezone })
    const todayTxns = Object.values(txns).filter((x) => !x.voided && x.date === today)
    const todayPays = Object.values(pays).filter((x) => !x.voided && x.date === today)
    const totalDebit = sum(Object.values(txns).filter((x) => !x.voided).map((x) => x.total))
    const totalCredit = sum(Object.values(pays).filter((x) => !x.voided).map((x) => x.amount))
    const all = customersWithMeta(custs, txns, pays)
    const overdue = all.filter((c) => c.status === 'overdue')
    return {
      totalUdhaar: totalDebit,
      totalJama: totalCredit,
      baqi: totalDebit - totalCredit,
      todayPayment: sum(todayPays.map((p) => p.amount)),
      todayUdhaar: sum(todayTxns.map((p) => p.total)),
      overdueAmount: sum(overdue.map((c) => c.balance)),
      customerCount: all.length,
      todayTxnCount: todayTxns.length,
    }
  }, [txns, pays, custs, settings.timezone])

  const dueToday = useMemo(
    () =>
      customersWithMeta(custs, txns, pays).filter((c) => c.status === 'due').slice(0, 6),
    [custs, txns, pays],
  )
  const overdueList = useMemo(
    () => customersWithMeta(custs, txns, pays).filter((c) => c.status === 'overdue').sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 6),
    [custs, txns, pays],
  )

  const cur = new Date().getHours()
  const greeting = cur < 12 ? t('misc_goodMorning') : cur < 17 ? t('misc_goodAfternoon') : t('misc_goodEvening')
  const curSymbol = shop?.currency === 'PKR' ? 'Rs.' : 'Rs.'

  const quick = [
    { label: t('dash_newCustomer'), icon: <IconPlus width={20} height={20} />, to: '/customers/new' },
    { label: t('dash_newUdhaar'), icon: <IconWallet width={20} height={20} />, to: '/transactions/new' },
    { label: t('dash_newPayment'), icon: <IconReceipt width={20} height={20} />, to: '/payments/new' },
    { label: t('dash_customerSearch'), icon: <IconSearch width={20} height={20} />, to: '/customers' },
    { label: t('dash_calculator'), icon: <IconCalculator width={20} height={20} />, to: '/calculator' },
    { label: t('dash_reports'), icon: <IconChart width={20} height={20} />, to: '/reports' },
  ]

  return (
    <div>
      {/* greeting strip */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-ink-50">
            {greeting}, {user?.name?.split(' ')[0] || 'Dukandar'} 👋
          </h1>
          <p className="text-xs text-ink-400">{clock.date} · <span className="tabular-nums">{clock.time}</span> · {shop?.name}</p>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label={t('dash_totalUdhaar')} value={formatCompact(stats.totalUdhaar, curSymbol)} color="red" icon={<IconWallet width={18} height={18} />} />
        <StatCard label={t('dash_totalJama')} value={formatCompact(stats.totalJama, curSymbol)} color="green" icon={<IconReceipt width={18} height={18} />} />
        <StatCard label={t('dash_totalBaqi')} value={formatCompact(stats.baqi, curSymbol)} color={stats.baqi > 0 ? 'amber' : 'ink'} icon={<IconSwap width={18} height={18} />} />
        <StatCard label={t('dash_totalCustomers')} value={String(stats.customerCount)} color="blue" icon={<IconUsers width={18} height={18} />} />
        <StatCard label={t('dash_todayPayment')} value={formatCompact(stats.todayPayment, curSymbol)} color="green" icon={<IconReceipt width={18} height={18} />} />
        <StatCard label={t('dash_todayUdhaar')} value={formatCompact(stats.todayUdhaar, curSymbol)} color="red" icon={<IconWallet width={18} height={18} />} />
        <StatCard label={t('dash_overdueAmount')} value={formatCompact(stats.overdueAmount, curSymbol)} color="red" icon={<IconAlert width={18} height={18} />} />
        <StatCard label={t('dash_todayTransactions')} value={String(stats.todayTxnCount)} color="ink" icon={<IconSwap width={18} height={18} />} />
      </div>

      {/* quick actions */}
      <SectionTitle>{t('dash_quickActions')}</SectionTitle>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {quick.map((q) => (
          <button
            key={q.to}
            onClick={() => (q.to === '/calculator' ? window.dispatchEvent(new Event('hk:calc')) : nav(q.to))}
            className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-white p-3.5 text-center transition-all hover:border-brand-300 hover:shadow-card active:scale-95 dark:border-ink-700 dark:bg-ink-800"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">{q.icon}</span>
            <span className="text-[10px] font-bold leading-tight text-ink-600 dark:text-ink-300">{q.label}</span>
          </button>
        ))}
      </div>

      {/* due today + overdue */}
      <div className="mt-2 grid gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle><span className="flex items-center gap-1.5"><IconCalendar width={14} height={14} /> {t('dash_dueToday')}</span></SectionTitle>
          <Card className="divide-y divide-ink-100 dark:divide-ink-700">
            {dueToday.length === 0 && <EmptyState text={t('dash_noDueToday')} />}
            {dueToday.map((c) => (
              <div key={c.customer.id} className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <Link to={`/customers/${c.customer.id}`} className="truncate text-sm font-bold text-ink-900 hover:text-brand-600 dark:text-ink-100">{c.customer.name}</Link>
                  <p className="text-[11px] text-ink-400">{c.customer.phone || '—'} · {c.dueDate ? formatDateShort(c.dueDate) : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-600">{formatMoney(c.balance, curSymbol)}</span>
                  {c.customer.phone && (
                    <a href={callLink(c.customer.phone)} className="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"><IconPhone width={16} height={16} /></a>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>
        <div>
          <SectionTitle><span className="flex items-center gap-1.5"><IconAlert width={14} height={14} /> {t('dash_overdue')}</span></SectionTitle>
          <Card className="divide-y divide-ink-100 dark:divide-ink-700">
            {overdueList.length === 0 && <EmptyState text={t('dash_noOverdue')} />}
            {overdueList.map((c) => {
              const late = c.dueDate ? -1 * (daysFromToday(c.dueDate) ?? 0) : 0
              return (
                <div key={c.customer.id} className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link to={`/customers/${c.customer.id}`} className="truncate text-sm font-bold text-ink-900 hover:text-brand-600 dark:text-ink-100">{c.customer.name}</Link>
                      <StatusBadge status="overdue" />
                    </div>
                    <p className="text-[11px] text-ink-400">{t('txn_daysLate')}: {late} · {c.customer.phone || '—'}</p>
                  </div>
                  <span className="text-sm font-bold text-red-600">{formatMoney(c.balance, curSymbol)}</span>
                </div>
              )
            })}
          </Card>
        </div>
      </div>
    </div>
  )
}

function formatCompact(paisa: number, sym: string): string {
  const abs = Math.round(Math.abs(paisa) / 100)
  return `${paisa < 0 ? '-' : ''}${sym} ${abs.toLocaleString('en-PK')}`
}

import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Card, EmptyState, Input, PageHeader, Segmented, SectionTitle, StatCard } from '../components/ui'
import { BarChart, Donut, LineChart } from '../components/charts'
import { IconChart, IconUsers, IconWallet } from '../components/icons'
import { todayISO, monthKey, lastMonths, monthLabel } from '../lib/date'
import { formatMoney, formatCompact, sum } from '../lib/money'
import { customersWithMeta, customerBalance } from '../lib/ledger'
import type { Customer, Payment, Transaction } from '../types'

type Period = 'month' | '6m' | '12m'

export function Reports() {
  const { data, getShop } = useApp()
  const { t } = useI18n()
  const [daily, setDaily] = useState(todayISO())
  const [period, setPeriod] = useState<Period>('month')
  const shop = getShop()
  const cur = shop?.currency === 'PKR' ? 'Rs.' : 'Rs.'
  const txns = data.transactions.items
  const pays = data.payments.items
  const custs = data.customers.items

  const dailyStats = useMemo(() => {
    const dayTxns = Object.values(txns).filter((x) => !x.voided && x.date === daily)
    const dayPays = Object.values(pays).filter((x) => !x.voided && x.date === daily)
    return {
      sales: sum(dayTxns.map((x) => x.total)),
      payments: sum(dayPays.map((x) => x.amount)),
      outstandingAdded: sum(dayTxns.map((x) => x.total - x.paid)),
      customers: new Set([...dayTxns.map((x) => x.customerId), ...dayPays.map((x) => x.customerId)]).size,
      txns: dayTxns.length,
      pays: dayPays.length,
    }
  }, [txns, pays, daily])

  const monthly = useMemo(() => {
    const months = lastMonths(period === 'month' ? 12 : period === '6m' ? 6 : 12)
    const udhaar: number[] = []
    const jama: number[] = []
    const growth: number[] = []
    let custAccum = 0
    for (const m of months) {
      udhaar.push(sum(Object.values(txns).filter((x) => !x.voided && monthKey(x.date) === m).map((x) => x.total)))
      jama.push(sum(Object.values(pays).filter((x) => !x.voided && monthKey(x.date) === m).map((x) => x.amount)))
      custAccum += Object.values(custs).filter((c) => monthKey(c.createdAt) === m).length
      growth.push(custAccum)
    }
    const labels = months.map((m) => monthLabel(m))
    const curM = lastMonths(1)[0]
    const prevM = lastMonths(2)[0]
    const curUdhaar = sum(Object.values(txns).filter((x) => !x.voided && monthKey(x.date) === curM).map((x) => x.total))
    const curJama = sum(Object.values(pays).filter((x) => !x.voided && monthKey(x.date) === curM).map((x) => x.amount))
    const prevUdhaar = sum(Object.values(txns).filter((x) => !x.voided && monthKey(x.date) === prevM).map((x) => x.total))
    const prevJama = sum(Object.values(pays).filter((x) => !x.voided && monthKey(x.date) === prevM).map((x) => x.amount))
    return { labels, udhaar, jama, growth, curUdhaar, curJama, prevUdhaar, prevJama, months }
  }, [txns, pays, custs, period])

  const top = useMemo(() => {
    const list = customersWithMeta(custs, txns, pays)
      .filter((c) => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 8)
    return list
  }, [custs, txns, pays])

  const overall = useMemo(() => {
    const totalUdhaar = sum(Object.values(txns).filter((x) => !x.voided).map((x) => x.total))
    const totalJama = sum(Object.values(pays).filter((x) => !x.voided).map((x) => x.amount))
    const outstanding = totalUdhaar - totalJama
    const overdue = customersWithMeta(custs, txns, pays).filter((c) => c.status === 'overdue').reduce((a, c) => a + c.balance, 0)
    return { totalUdhaar, totalJama, outstanding, overdue, txnCount: Object.values(txns).filter((x) => !x.voided).length, custCount: Object.values(custs).filter((c) => !c.archived).length }
  }, [txns, pays, custs])

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      <PageHeader title={t('reports_title')} subtitle={t('misc_timezone')} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label={t('reports_totalUdhaar')} value={formatCompact(overall.totalUdhaar, cur)} color="red" icon={<IconWallet width={18} height={18} />} />
        <StatCard label={t('reports_totalJama')} value={formatCompact(overall.totalJama, cur)} color="green" />
        <StatCard label={t('reports_totalOutstanding')} value={formatCompact(overall.outstanding, cur)} color="amber" />
        <StatCard label={t('reports_overdue')} value={formatCompact(overall.overdue, cur)} color="red" />
      </div>

      {/* daily */}
      <SectionTitle>{t('reports_daily')}</SectionTitle>
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Input type="date" value={daily} onChange={(e) => setDaily(e.target.value)} className="max-w-[170px]" />
          <span className="text-xs text-ink-400">{today}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <MiniStat label={t('reports_totalSales')} value={formatCompact(dailyStats.sales, cur)} />
          <MiniStat label={t('reports_totalPayments')} value={formatCompact(dailyStats.payments, cur)} />
          <MiniStat label={t('reports_outstandingAdded')} value={formatCompact(dailyStats.outstandingAdded, cur)} />
          <MiniStat label={t('reports_customers')} value={String(dailyStats.customers)} />
          <MiniStat label={t('reports_transactions')} value={`${dailyStats.txns} / ${dailyStats.pays}`} />
        </div>
      </Card>

      {/* monthly + charts */}
      <SectionTitle>{t('reports_monthly')}</SectionTitle>
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <MiniStat label={t('reports_thisMonth')} value={formatCompact(monthly.curUdhaar, cur)} />
            <MiniStat label={t('reports_prevMonth')} value={formatCompact(monthly.prevUdhaar, cur)} />
          </div>
          <Segmented options={[{ value: 'month', label: '12M' }, { value: '6m', label: '6M' }, { value: '12m', label: '12M+' }]} value={period} onChange={setPeriod} />
        </div>
        <div className="mb-1 text-[10px] font-bold uppercase text-ink-400">{t('reports_udhaar')} / {t('reports_jama')}</div>
        <BarChart
          labels={period === 'month' ? monthly.labels.slice(-12) : monthly.labels}
          series={[
            { label: t('reports_udhaar'), values: period === 'month' ? monthly.udhaar.slice(-12) : monthly.udhaar, color: '#dc2626' },
            { label: t('reports_jama'), values: period === 'month' ? monthly.jama.slice(-12) : monthly.jama, color: '#059669' },
          ]}
          format={(v) => formatCompact(v, cur)}
        />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 text-[10px] font-bold uppercase text-ink-400">{t('reports_customerGrowth')}</div>
          <LineChart labels={monthly.labels} values={monthly.growth} format={(v) => `${v}`} />
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-[10px] font-bold uppercase text-ink-400">{t('reports_topCustomers')}</div>
          {top.length === 0 && <EmptyState text={t('customers_noResults')} />}
          <div className="space-y-2">
            {top.map((c, i) => (
              <div key={c.customer.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-center text-xs font-black text-ink-300">{i + 1}</span>
                <span className="flex-1 truncate font-bold text-ink-800 dark:text-ink-100">{c.customer.name}</span>
                <span className="tabular-nums font-black text-red-600">{formatMoney(c.balance, cur)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 p-2.5 dark:bg-ink-700/50">
      <p className="text-[9px] font-bold uppercase text-ink-400">{label}</p>
      <p className="text-sm font-black text-ink-800 dark:text-ink-100">{value}</p>
    </div>
  )
}

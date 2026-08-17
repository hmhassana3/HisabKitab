import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Button, Card, EmptyState, Input, PageHeader } from '../components/ui'
import { IconPlus, IconSearch, IconSwap } from '../components/icons'
import { useDebounce } from '../hooks/useCommon'
import { formatDateShort, monthKey } from '../lib/date'
import { formatCompact } from '../lib/money'

export function Transactions() {
  const { data, getShop } = useApp()
  const { t } = useI18n()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [month, setMonth] = useState('')
  const debounced = useDebounce(q, 250)
  const cur = getShop()?.currency === 'PKR' ? 'Rs.' : 'Rs.'
  const customers = data.customers.items

  const txns = useMemo(() => {
    let list = Object.values(data.transactions.items).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (debounced) {
      const needle = debounced.toLowerCase()
      list = list.filter((x) =>
        x.id.toLowerCase().includes(needle) ||
        (customers[x.customerId]?.name || '').toLowerCase().includes(needle) ||
        x.items.some((i) => i.name.toLowerCase().includes(needle)),
      )
    }
    if (month) list = list.filter((x) => monthKey(x.date) === month)
    return list
  }, [data, debounced, month, customers])

  const months = useMemo(() => {
    const set = new Set(Object.values(data.transactions.items).map((x) => monthKey(x.date)))
    return [...set].sort().reverse()
  }, [data])

  return (
    <div>
      <PageHeader
        title={t('nav_transactions')}
        subtitle={`${txns.length} ${t('reports_transactions').toLowerCase()}`}
        actions={<Button onClick={() => nav('/transactions/new')}><IconPlus width={16} height={16} />{t('txn_new')}</Button>}
      />

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-400 rtl:left-auto rtl:right-3"><IconSearch width={16} height={16} /></span>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('txn_id') + ' / ' + t('common_name') + ' / ' + t('txn_itemName')} className="pl-9 rtl:pl-3 rtl:pr-9" />
        </div>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-xl border border-ink-200 bg-white px-3 text-xs text-ink-600 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300">
          <option value="">{t('reports_monthly')}</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {txns.length === 0 && <Card><EmptyState icon={<IconSwap width={40} height={40} />} text={t('txn_new') + ' — ' + t('customers_empty')} /></Card>}

      <div className="space-y-2">
        {txns.slice(0, 200).map((x) => {
          const c = customers[x.customerId]
          return (
            <Card key={x.id} className="p-3.5" onClick={() => nav(`/transactions/${x.id}`)}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-ink-900 dark:text-ink-100" dir="ltr">{x.id}</p>
                    {x.voided && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[9px] font-black text-ink-400 dark:bg-ink-700">{t('txn_voided')}</span>}
                  </div>
                  <p className="truncate text-[11px] text-ink-400">{c?.name || '—'} · {x.items.map((i) => `${i.name}×${i.quantity}`).join(', ')} · {formatDateShort(x.date)}</p>
                </div>
                <div className="text-end shrink-0">
                  <p className={`text-sm font-extrabold ${x.voided ? 'text-ink-300' : 'text-red-600'}`}>{formatCompact(x.total, cur)}</p>
                  {x.dueDate && <p className="text-[10px] text-amber-600">{t('txn_dueDate')}: {formatDateShort(x.dueDate)}</p>}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

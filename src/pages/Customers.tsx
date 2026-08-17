import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Card, EmptyState, Input, PageHeader, Segmented, StatusBadge, Button } from '../components/ui'
import { CustomerForm } from '../components/CustomerForm'
import { IconPlus, IconSearch, IconUsers } from '../components/icons'
import { useDebounce } from '../hooks/useCommon'
import { customersWithMeta } from '../lib/ledger'
import { formatMoney, formatCompact } from '../lib/money'
import { formatDateShort, daysFromToday } from '../lib/date'
import { useMediaUrl } from '../hooks/useMediaUrl'

type Filter = 'all' | 'paid' | 'partial' | 'due' | 'overdue' | 'high' | 'recent'
type Sort = 'name' | 'newest' | 'oldest' | 'high_balance' | 'low_balance' | 'due_date'

export function Customers() {
  const { data, getShop } = useApp()
  const { t } = useI18n()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('newest')
  const [showArchived, setShowArchived] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const debounced = useDebounce(q, 250)
  const cur = getShop()?.currency === 'PKR' ? 'Rs.' : 'Rs.'

  const all = useMemo(
    () => customersWithMeta(data.customers.items, data.transactions.items, data.payments.items, showArchived),
    [data, showArchived],
  )

  const filtered = useMemo(() => {
    const needle = debounced.trim().toLowerCase()
    let list = all.filter((c) => {
      if (needle) {
        const hay = `${c.customer.name} ${c.customer.phone || ''} ${c.customer.email || ''} ${c.customer.id}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      switch (filter) {
        case 'paid': return c.balance <= 0
        case 'partial': return c.status === 'partial'
        case 'due': return c.status === 'due'
        case 'overdue': return c.status === 'overdue'
        case 'high': return c.balance >= 100000
        case 'recent': return true
        default: return true
      }
    })
    switch (sort) {
      case 'name': list = [...list].sort((a, b) => a.customer.name.localeCompare(b.customer.name))
        break
      case 'newest': list = [...list].sort((a, b) => b.customer.createdAt.localeCompare(a.customer.createdAt))
        break
      case 'oldest': list = [...list].sort((a, b) => a.customer.createdAt.localeCompare(b.customer.createdAt))
        break
      case 'high_balance': list = [...list].sort((a, b) => b.balance - a.balance)
        break
      case 'low_balance': list = [...list].sort((a, b) => a.balance - b.balance)
        break
      case 'due_date': list = [...list].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
        break
    }
    return list
  }, [all, debounced, filter, sort])

  const filterOptions: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: t('customers_all') },
    { value: 'paid', label: t('customers_paid') },
    { value: 'partial', label: t('customers_partial') },
    { value: 'due', label: t('customers_due') },
    { value: 'overdue', label: t('customers_overdue') },
    { value: 'high', label: t('customers_highBalance') },
    { value: 'recent', label: t('customers_recent') },
  ]

  return (
    <div>
      <PageHeader
        title={t('customers_title')}
        subtitle={`${all.length} ${t('dash_totalCustomers').toLowerCase()}`}
        actions={<Button onClick={() => setFormOpen(true)}><IconPlus width={16} height={16} />{t('customers_add')}</Button>}
      />

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-400 rtl:left-auto rtl:right-3"><IconSearch width={16} height={16} /></span>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('customers_search')} className="pl-9 rtl:pl-3 rtl:pr-9" />
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-500 dark:text-ink-400">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          {t('misc_showArchived')}
        </label>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented options={filterOptions} value={filter} onChange={setFilter} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300">
          <option value="newest">{t('customers_sort')}: {t('customers_recent')}</option>
          <option value="name">{t('common_name')}</option>
          <option value="oldest">Oldest</option>
          <option value="high_balance">{t('customers_highBalance')}</option>
          <option value="low_balance">Low Balance</option>
          <option value="due_date">{t('customers_dueDate')}</option>
        </select>
      </div>

      {filtered.length === 0 && <Card><EmptyState icon={<IconUsers width={40} height={40} />} text={q ? t('customers_noResults') : t('customers_empty')} /></Card>}

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <CustomerCard key={c.customer.id} id={c.customer.id} photoId={c.customer.photoId} name={c.customer.name} phone={c.customer.phone}
            balance={c.balance} status={c.status} dueDate={c.dueDate} lastTxn={c.lastTxn} cur={cur} onOpen={() => nav(`/customers/${c.customer.id}`)} />
        ))}
      </div>

      <CustomerForm open={formOpen} onClose={() => setFormOpen(false)} title={t('customers_addNew')} />
    </div>
  )
}

function CustomerCard({ id, photoId, name, phone, balance, status, dueDate, lastTxn, cur, onOpen }: {
  id: string; photoId?: string; name: string; phone?: string; balance: number; status: 'paid' | 'partial' | 'due' | 'overdue' | 'no_balance'; dueDate?: string; lastTxn?: string; cur: string; onOpen: () => void
}) {
  const { t } = useI18n()
  const photo = useMediaUrl(photoId)
  const late = status === 'overdue' && dueDate ? (daysFromToday(dueDate) ?? 0) * -1 : 0
  return (
    <Card className="p-3.5" onClick={onOpen}>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-ink-100 dark:bg-ink-700">
          {photo.url ? <img src={photo.url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center text-sm font-bold text-ink-400">{name.slice(0, 1).toUpperCase()}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="truncate text-sm font-bold text-ink-900 dark:text-ink-100">{name}</p>
            <StatusBadge status={status} />
          </div>
          <p className="truncate text-[11px] text-ink-400" dir="ltr">{phone || '—'}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {t('customers_lastTxn')}: {lastTxn ? formatDateShort(lastTxn) : '—'}
            {dueDate && <span className={late > 0 ? 'text-red-500 font-bold' : 'text-amber-600'}> · {t('txn_dueDate')}: {formatDateShort(dueDate)} {late > 0 ? `(${late}d)` : ''}</span>}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2 dark:border-ink-700">
        <p className={`text-sm font-extrabold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCompact(balance, cur)}</p>
        <span className="text-[11px] font-bold text-brand-600">{t('customers_open')} →</span>
      </div>
      <p className="mt-1 text-[9px] text-ink-300" dir="ltr">{id}</p>
    </Card>
  )
}

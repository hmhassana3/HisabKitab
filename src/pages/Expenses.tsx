import { useState } from 'react'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Button, Card, EmptyState, Field, Input, PageHeader, Select } from '../components/ui'
import { IconTrash } from '../components/icons'
import { parsePaisa, formatMoney, formatCompact, sum } from '../lib/money'
import { todayISO, formatDateShort } from '../lib/date'

const CATS = ['rent', 'electricity', 'salary', 'transport', 'other'] as const

export function Expenses() {
  const { data, addExpense, deleteExpense, getShop } = useApp()
  const { t } = useI18n()
  const [cat, setCat] = useState<string>('rent')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const cur = getShop()?.currency === 'PKR' ? 'Rs.' : 'Rs.'

  const list = Object.values(data.expenses.items).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const total = sum(list.map((e) => e.amount))

  const save = () => {
    const paisa = parsePaisa(amount)
    if (!(paisa && paisa > 0)) { setErr(t('pay_amountRequired')); return }
    setErr('')
    addExpense({ category: cat, amount: paisa, date, note })
    setAmount('')
    setNote('')
  }

  return (
    <div>
      <PageHeader title={t('exp_title')} subtitle={`${t('exp_total')}: ${formatCompact(total, cur)}`} />

      <Card className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={t('exp_category')}>
            <Select value={cat} onChange={(e) => setCat(e.target.value)}>
              {CATS.map((c) => <option key={c} value={c}>{t(`exp_${c}` as never)}</option>)}
            </Select>
          </Field>
          <Field label={t('exp_amount')} error={err}>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
          </Field>
          <Field label={t('pay_date')}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t('exp_note')}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end"><Button onClick={save}>{t('exp_save')}</Button></div>
      </Card>

      {list.length === 0 && <Card className="mt-3"><EmptyState text={t('exp_empty')} /></Card>}

      <div className="mt-3 space-y-2">
        {list.map((e) => (
          <Card key={e.id} className="flex items-center justify-between gap-2 p-3.5">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink-900 dark:text-ink-100">{t(`exp_${e.category}` as never)} <span className="text-ink-400 font-normal">· {formatDateShort(e.date)}</span></p>
              {e.note && <p className="truncate text-xs text-ink-400">{e.note}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-red-600">{formatMoney(e.amount, cur)}</span>
              <button onClick={() => { if (window.confirm(t('misc_confirmDelete'))) deleteExpense(e.id) }} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"><IconTrash width={15} height={15} /></button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

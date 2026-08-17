import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Button, Card, Field, Input, PageHeader, Select, TextArea } from '../components/ui'
import { IconBack, IconCamera, IconUpload } from '../components/icons'
import { parsePaisa, formatMoney, formatCompact } from '../lib/money'
import { clientKey } from '../lib/ids'
import { compressImage } from '../lib/compressImage'
import { todayISO } from '../lib/date'
import { customerBalance } from '../lib/ledger'
import type { PaymentMethod } from '../types'

export function PaymentForm() {
  const { data, getShop, createPayment, addAttachment, showToast, linkTransactionEvidence } = useApp()
  const { t } = useI18n()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const forced = params.get('customer') || ''
  const [customerId, setCustomerId] = useState(forced)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [receiptId, setReceiptId] = useState<string | undefined>()
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const shop = getShop()
  const cur = shop?.currency === 'PKR' ? 'Rs.' : 'Rs.'
  const customers = Object.values(data.customers.items).filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name))

  const balance = useMemo(() => (customerId ? customerBalance(data.transactions.items, data.payments.items, customerId) : 0), [data, customerId])
  const amountPaisa = parsePaisa(amount) || 0

  const handleReceipt = async (file: File | Blob | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const blob = await compressImage(file)
      const att = await addAttachment('receipt', blob, `receipt-${Date.now()}.jpg`, { customerId: customerId || undefined })
      setReceiptId(att.id)
      showToast(t('misc_photoSaved'))
    } catch (e) {
      showToast(e instanceof Error && e.message === 'OFFLINE_UPLOAD' ? t('misc_offlineNote') : t('common_error'), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      if (camRef.current) camRef.current.value = ''
    }
  }

  const submit = async () => {
    const errs: Record<string, string> = {}
    if (!customerId) errs.customer = t('txn_customerRequired')
    if (!(amountPaisa > 0)) errs.amount = t('pay_amountRequired')
    setErrs(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const pay = createPayment({ clientKey: clientKey(), customerId, amount: amountPaisa, date, method, reference, note })
      if (!pay) return
      if (receiptId) linkTransactionEvidence('', customerId, [receiptId], [])
      showToast(`${t('pay_saved')} — ${pay.id}`)
      nav(`/customers/${customerId}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <button onClick={() => nav(-1)} className="mb-3 flex items-center gap-1 text-xs font-bold text-ink-400 hover:text-brand-600"><IconBack width={14} height={14} />{t('common_back')}</button>
      <PageHeader title={t('pay_new')} />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="space-y-3 p-4 lg:col-span-2">
          <Field label={t('txn_customer')} error={errs.customer}>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">{t('txn_customer')}...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('pay_amount')} error={errs.amount}>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus />
            </Field>
            <Field label={t('pay_date')}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label={t('pay_method')}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(['cash', 'bank', 'easypaisa', 'jazzcash', 'other'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors ${method === m ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'border-ink-200 text-ink-500 dark:border-ink-600 dark:text-ink-400'}`}
                >
                  {t(`pay_${m}` as never)}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('pay_reference')}>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn ID / Ref no." dir="ltr" />
            </Field>
            <Field label={t('pay_receipt')}>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => camRef.current?.click()}><IconCamera width={15} height={15} />{t('cform_takePhoto')}</Button>
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}><IconUpload width={15} height={15} />{t('cform_upload')}</Button>
                <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void handleReceipt(e.target.files?.[0])} />
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleReceipt(e.target.files?.[0])} />
              </div>
            </Field>
          </div>
          <Field label={t('pay_note')}>
            <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button size="lg" className="w-full" disabled={saving} onClick={() => void submit()}>
            {saving ? t('pay_saving') : t('pay_save')}
          </Button>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-bold text-ink-700 dark:text-ink-200">{t('cprofile_balance')}</h3>
            <p className={`text-2xl font-black ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatMoney(balance, cur)}</p>
            {receiptId && <p className="mt-2 text-xs font-bold text-emerald-600">✓ {t('pay_receipt')}</p>}
          </Card>
          <Card className="p-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-ink-500"><span>{t('cprofile_balance')}</span><span className="tabular-nums">{formatCompact(balance, cur)}</span></div>
              <div className="flex justify-between text-emerald-600 font-bold"><span>{t('pay_amount')}</span><span className="tabular-nums">− {formatCompact(amountPaisa, cur)}</span></div>
              <div className="border-t border-ink-100 pt-1 flex justify-between font-black text-ink-900 dark:border-ink-700 dark:text-ink-50"><span>{t('txn_newBalance')}</span><span className="tabular-nums">{formatMoney(Math.max(0, balance - amountPaisa), cur)}</span></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

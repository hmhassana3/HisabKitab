import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Button, Card, Field, Input, PageHeader, Select, TextArea } from './ui'
import { VoiceRecorder, type VoiceCaptureResult } from './VoiceRecorder'
import { IconBack, IconCamera, IconPlus, IconTrash, IconUpload } from './icons'
import { parsePaisa, formatMoney, percentOf } from '../lib/money'
import { clientKey } from '../lib/ids'
import { compressImage } from '../lib/compressImage'
import { todayISO } from '../lib/date'
import type { PaymentMethod, TxnItem } from '../types'

interface ItemDraft {
  id: string
  name: string
  qty: string
  price: string
  discountType: 'fixed' | 'percent'
  discount: string
  paid: string
}

let itemSeq = 0
const newItem = (): ItemDraft => ({ id: `it-${Date.now()}-${itemSeq++}`, name: '', qty: '1', price: '', discountType: 'fixed', discount: '', paid: '' })

export function TransactionForm({ customerId: forcedCustomer }: { customerId?: string }) {
  const { data, getShop, createTransaction, addAttachment, addVoice, showToast, linkTransactionEvidence } = useApp()
  const { t } = useI18n()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const forced = forcedCustomer || params.get('customer') || ''
  const [customerId, setCustomerId] = useState(forced)
  const [date, setDate] = useState(todayISO())
  const [items, setItems] = useState<ItemDraft[]>([newItem()])
  const [paid, setPaid] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [promiseDate, setPromiseDate] = useState('')
  const [promiseAmount, setPromiseAmount] = useState('')
  const [promiseNote, setPromiseNote] = useState('')
  const [note, setNote] = useState('')
  const [method, setMethod] = useState('cash')
  const [saving, setSaving] = useState(false)
  const [photoIds, setPhotoIds] = useState<string[]>([])
  const [voiceIds, setVoiceIds] = useState<string[]>([])
  const [errs, setErrs] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const shop = getShop()
  const cur = shop?.currency === 'PKR' ? 'Rs.' : 'Rs.'
  const customers = Object.values(data.customers.items).filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name))

  const computed = useMemo(() => {
    const rows = items.map((it) => {
      const qty = Math.max(1, Number(it.qty) || 0)
      const orig = parsePaisa(it.price) || 0
      const discVal = it.discountType === 'percent' ? Number(it.discount) || 0 : parsePaisa(it.discount) || 0
      const finalPer = it.discountType === 'percent'
        ? Math.max(0, orig - percentOf(orig, Math.min(100, discVal)))
        : Math.max(0, orig - discVal)
      const lineTotal = finalPer * qty
      const lineOrig = orig * qty
      return { ...it, qty, orig, finalPer, lineTotal, lineOrig, discAmt: lineOrig - lineTotal }
    })
    const subtotal = rows.reduce((a, r) => a + r.lineOrig, 0)
    const totalDiscount = rows.reduce((a, r) => a + r.discAmt, 0)
    const total = rows.reduce((a, r) => a + r.lineTotal, 0)
    return { rows, subtotal, totalDiscount, total }
  }, [items])

  const paidPaisa = parsePaisa(paid) || 0

  const setItem = (id: string, patch: Partial<ItemDraft>) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  const addItemRow = () => setItems((l) => [...l, newItem()])
  const removeItemRow = (id: string) => setItems((l) => (l.length > 1 ? l.filter((it) => it.id !== id) : l))

  const handlePhoto = async (file: File | Blob | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const blob = await compressImage(file)
      const att = await addAttachment('item', blob, `item-${Date.now()}.jpg`, { customerId: customerId || undefined })
      setPhotoIds((l) => [...l, att.id])
      showToast(t('misc_photoSaved'))
    } catch (e) {
      showToast(e instanceof Error && e.message === 'OFFLINE_UPLOAD' ? t('misc_offlineNote') : t('common_error'), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      if (camRef.current) camRef.current.value = ''
    }
  }

  const onVoice = async (r: VoiceCaptureResult, speaker: 'customer' | 'shopkeeper') => {
    try {
      const v = await addVoice(speaker, r.blob, r.durationSec, { customerId: customerId || undefined })
      setVoiceIds((l) => [...l, v.id])
      showToast(t('misc_voiceSaved'))
    } catch (e) {
      showToast(e instanceof Error && e.message === 'OFFLINE_UPLOAD' ? t('misc_offlineNote') : t('common_error'), 'error')
    }
  }

  const submit = async () => {
    const errs: Record<string, string> = {}
    if (!customerId) errs.customer = t('txn_customerRequired')
    if (computed.rows.filter((r) => r.name.trim()).length === 0) errs.items = t('txn_itemRequired')
    for (const r of computed.rows) {
      if (r.name.trim() && (r.qty <= 0 || r.orig <= 0)) { errs.items = t('txn_itemRequired'); break }
    }
    setErrs(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const finalItems: TxnItem[] = computed.rows
        .filter((r) => r.name.trim())
        .map((r) => ({
          id: r.id,
          name: r.name.trim(),
          quantity: r.qty,
          originalPrice: r.orig,
          discountType: r.discountType,
          discountValue: r.discountType === 'percent' ? Math.min(100, Number(r.discount) || 0) : parsePaisa(r.discount) || 0,
          finalPrice: r.finalPer,
          lineTotal: r.lineTotal,
          paid: parsePaisa(r.paid) || 0,
        }))
      const txn = createTransaction({
        clientKey: clientKey(),
        customerId,
        date,
        items: finalItems,
        subtotal: computed.subtotal,
        totalDiscount: computed.totalDiscount,
        total: computed.total,
        paid: Math.min(paidPaisa, computed.total),
        dueDate: dueDate || undefined,
        promiseDate: promiseDate || undefined,
        promiseAmount: promiseAmount ? parsePaisa(promiseAmount) || undefined : undefined,
        promiseNote: promiseNote || undefined,
        note: note || undefined,
        paymentMethod: paidPaisa > 0 ? (method as PaymentMethod) : undefined,
      })
      if (!txn) return
      linkTransactionEvidence(txn.id, customerId, photoIds, voiceIds)
      showToast(`${t('txn_saved')} — ${txn.id}`)
      nav(`/transactions/${txn.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <button onClick={() => nav(-1)} className="mb-3 flex items-center gap-1 text-xs font-bold text-ink-400 hover:text-brand-600"><IconBack width={14} height={14} />{t('common_back')}</button>
      <PageHeader title={t('txn_new')} subtitle={t('txn_prevBalance') + ' + ' + t('txn_items') + ' − ' + t('common_paid') + ' = ' + t('ledger_balance')} />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {/* customer + date */}
          <Card className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label={t('txn_customer')} error={errs.customer}>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">{t('txn_customer')}...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
              </Select>
            </Field>
            <Field label={t('txn_date')}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </Card>

          {/* items */}
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-700 dark:text-ink-200">{t('txn_items')}</h3>
              <Button size="sm" variant="outline" onClick={addItemRow}><IconPlus width={14} height={14} />{t('txn_addItem')}</Button>
            </div>
            {errs.items && <p className="mb-2 text-xs font-bold text-red-500">{errs.items}</p>}
            <div className="space-y-3">
              {computed.rows.map((r) => (
                <div key={r.id} className="rounded-2xl border border-ink-100 p-3 dark:border-ink-700">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="col-span-2">
                      <Input value={r.name} onChange={(e) => setItem(r.id, { name: e.target.value })} placeholder={t('txn_itemNamePh')} />
                    </div>
                    <Field label={t('txn_qty')}>
                      <Input type="number" min={1} value={r.qty} onChange={(e) => setItem(r.id, { qty: e.target.value })} inputMode="numeric" />
                    </Field>
                    <Field label={t('txn_origPrice')}>
                      <Input type="number" min={0} value={r.price} onChange={(e) => setItem(r.id, { price: e.target.value })} inputMode="decimal" placeholder="0.00" />
                    </Field>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    <Field label={t('txn_discount')}>
                      <Select value={r.discountType} onChange={(e) => setItem(r.id, { discountType: e.target.value as 'fixed' | 'percent', discount: '' })}>
                        <option value="fixed">{t('txn_discountFixed')}</option>
                        <option value="percent">{t('txn_discountPct')}</option>
                      </Select>
                    </Field>
                    <Field label={r.discountType === 'percent' ? '%' : 'Rs.'}>
                      <Input type="number" min={0} max={r.discountType === 'percent' ? 100 : undefined} value={r.discount} onChange={(e) => setItem(r.id, { discount: e.target.value })} inputMode="decimal" placeholder="0" />
                    </Field>
                    <Field label={t('txn_paidAgainst')}>
                      <Input type="number" min={0} value={r.paid} onChange={(e) => setItem(r.id, { paid: e.target.value })} inputMode="decimal" placeholder="0.00" />
                    </Field>
                    <div className="col-span-1 rounded-xl bg-brand-50 p-2 text-center dark:bg-brand-900/30">
                      <p className="text-[9px] font-bold uppercase text-brand-600">{t('txn_finalPrice')}</p>
                      <p className="text-sm font-black text-brand-700 dark:text-brand-300">{formatMoney(r.finalPer, cur)}</p>
                    </div>
                    <div className="col-span-1 flex items-end justify-between rounded-xl bg-ink-50 p-2 dark:bg-ink-700/50">
                      <div>
                        <p className="text-[9px] font-bold uppercase text-ink-400">{t('txn_lineTotal')}</p>
                        <p className="text-sm font-black text-ink-800 dark:text-ink-100">{formatMoney(r.lineTotal, cur)}</p>
                      </div>
                      <button onClick={() => removeItemRow(r.id)} className="rounded-lg p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"><IconTrash width={14} height={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-1 border-t border-ink-100 pt-3 text-sm dark:border-ink-700">
              <div className="flex justify-between text-ink-500"><span>{t('txn_subtotal')}</span><span className="tabular-nums">{formatMoney(computed.subtotal, cur)}</span></div>
              <div className="flex justify-between text-ink-500"><span>{t('txn_totalDiscount')}</span><span className="tabular-nums text-emerald-600">− {formatMoney(computed.totalDiscount, cur)}</span></div>
              <div className="flex justify-between text-base font-black text-ink-900 dark:text-ink-50"><span>{t('txn_total')}</span><span className="tabular-nums">{formatMoney(computed.total, cur)}</span></div>
            </div>
          </Card>

          {/* due + promise */}
          <Card className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label={t('txn_dueDate')}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label={t('common_paid')} hint={t('txn_prevBalance')}>
              <Input type="number" min={0} value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" placeholder="0.00" />
            </Field>
            <Field label={t('txn_promiseDate')}>
              <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
            </Field>
            <Field label={t('txn_promiseAmount')}>
              <Input type="number" min={0} value={promiseAmount} onChange={(e) => setPromiseAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('txn_promiseNote')}>
                <Input value={promiseNote} onChange={(e) => setPromiseNote(e.target.value)} placeholder={t('txn_promisePh')} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t('txn_note')}>
                <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
            <Field label={t('pay_method')}>
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">{t('pay_cash')}</option>
                <option value="bank">{t('pay_bank')}</option>
                <option value="easypaisa">{t('pay_easypaisa')}</option>
                <option value="jazzcash">{t('pay_jazzcash')}</option>
                <option value="other">{t('pay_other')}</option>
              </Select>
            </Field>
            <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-900/30">
              <p className="text-[10px] font-bold uppercase text-amber-600">{t('txn_newBalance')}</p>
              <p className="text-lg font-black text-amber-700 dark:text-amber-300">{formatMoney(computed.total - paidPaisa, cur)}</p>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-700 dark:text-ink-200">{t('txn_evidence')} 📸🎙️</h3>
              <div className="flex gap-1.5">
                <button onClick={() => camRef.current?.click()} disabled={uploading} className="rounded-xl bg-ink-100 p-2 text-ink-600 hover:bg-ink-200 dark:bg-ink-700 dark:text-ink-300" title={t('txn_photo')}><IconCamera width={16} height={16} /></button>
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-xl bg-ink-100 p-2 text-ink-600 hover:bg-ink-200 dark:bg-ink-700 dark:text-ink-300" title={t('cform_upload')}><IconUpload width={16} height={16} /></button>
              </div>
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void handlePhoto(e.target.files?.[0])} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handlePhoto(e.target.files?.[0])} />
            {photoIds.length > 0 && <p className="mb-2 text-xs font-bold text-emerald-600">✓ {photoIds.length} {t('misc_photoGallery').toLowerCase()}</p>}
            <p className="mb-2 text-[10px] text-ink-400">{t('txn_consent')}</p>
            <div className="space-y-2">
              <VoiceRecorder label={t('txn_voiceCustomer')} onSave={(r) => void onVoice(r, 'customer')} saving={saving} />
              <VoiceRecorder label={t('txn_voiceShopkeeper')} onSave={(r) => void onVoice(r, 'shopkeeper')} saving={saving} />
            </div>
          </Card>
        </div>

        {/* summary sidebar */}
        <div className="space-y-3">
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-bold text-ink-700 dark:text-ink-200">{t('txn_prevBalance')}</h3>
            <p className="text-2xl font-black text-ink-900 dark:text-ink-50">{formatMoney(0, cur)}</p>
            <p className="text-[10px] text-ink-400">{t('txn_prevBalance')} + {t('txn_items')} − {t('common_paid')} = {t('ledger_balance')}</p>
          </Card>
          <Card className="p-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-ink-500"><span>{t('txn_subtotal')}</span><span className="tabular-nums">{formatMoney(computed.subtotal, cur)}</span></div>
              <div className="flex justify-between text-ink-500"><span>{t('txn_totalDiscount')}</span><span className="tabular-nums">− {formatMoney(computed.totalDiscount, cur)}</span></div>
              <div className="flex justify-between font-black text-ink-900 dark:text-ink-50"><span>{t('txn_total')}</span><span className="tabular-nums">{formatMoney(computed.total, cur)}</span></div>
              <div className="flex justify-between text-emerald-600"><span>{t('common_paid')}</span><span className="tabular-nums">{formatMoney(Math.min(paidPaisa, computed.total), cur)}</span></div>
              <div className="flex justify-between text-red-600 font-black text-base"><span>{t('common_remaining')}</span><span className="tabular-nums">{formatMoney(computed.total - Math.min(paidPaisa, computed.total), cur)}</span></div>
            </div>
            <Button className="mt-4 w-full" size="lg" disabled={saving} onClick={() => void submit()}>
              {saving ? t('txn_saving') : t('txn_save')}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}

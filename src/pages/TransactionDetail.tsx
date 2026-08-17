import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui'
import { PhotoGallery, VoicePlayer } from '../components/Media'
import { Receipt } from '../components/Receipt'
import { IconAlert, IconBack, IconPlus, IconReceipt, IconTrash } from '../components/icons'
import { formatMoney, formatCompact } from '../lib/money'
import { formatDate, formatDateShort, formatDateTime, daysFromToday } from '../lib/date'
import { elementToPdf, printElement } from '../lib/pdf'
import { useMediaUrl } from '../hooks/useMediaUrl'
import type { AuditEntry, Attachment } from '../types'

export function TransactionDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { data, getShop, getSettings, voidTransaction, removeAttachment, removeVoice, addAttachment, showToast } = useApp()
  const { t } = useI18n()
  const [busyPdf, setBusyPdf] = useState(false)
  const receiptRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const txn = id ? data.transactions.items[id] : undefined
  if (!txn) {
    return <Card className="p-8"><EmptyState text={t('customers_noResults')} /></Card>
  }

  const shop = getShop()
  const lang = getSettings().language
  const cur = shop?.currency === 'PKR' ? 'Rs.' : 'Rs.'
  const cust = data.customers.items[txn.customerId]
  const atts = Object.values(data.attachments.items).filter((a) => a.transactionId === txn.id || (a.customerId === txn.customerId && a.kind !== 'customer'))
  const voices = Object.values(data.voices.items).filter((v) => v.transactionId === txn.id || v.customerId === txn.customerId)
  const audits: AuditEntry[] = Object.values(data.audits.items)
    .filter((a) => a.entityId === txn.id || (a.entityType === 'transaction' && a.entityId === txn.id))
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 30)
  const late = txn.dueDate && !txn.voided ? (daysFromToday(txn.dueDate) ?? 0) * -1 : 0
  const remaining = txn.total - txn.paid

  const onPhotoAdd = async (kind: Attachment['kind'], blob: Blob) => {
    const att = await addAttachment(kind, blob, `txn-${Date.now()}.jpg`, { customerId: txn.customerId, transactionId: txn.id })
    void att
    showToast(t('misc_photoSaved'))
  }

  const makePdf = async () => {
    if (!receiptRef.current) return
    setBusyPdf(true)
    try {
      await elementToPdf(receiptRef.current, `${txn.id}-receipt.pdf`)
    } finally {
      setBusyPdf(false)
    }
  }

  return (
    <div>
      <button onClick={() => nav(-1)} className="mb-3 flex items-center gap-1 text-xs font-bold text-ink-400 hover:text-brand-600"><IconBack width={14} height={14} />{t('common_back')}</button>
      <PageHeader
        title={<span dir="ltr">{txn.id}</span>}
        subtitle={formatDateTime(txn.createdAt)}
        actions={!txn.voided ? (
          <Button variant="danger" size="sm" onClick={() => {
            const reason = window.prompt(t('txn_voidReason'))
            if (reason) { voidTransaction(txn.id, reason); showToast(t('txn_voided')) }
          }}>
            <IconTrash width={14} height={14} />{t('txn_void')}
          </Button>
        ) : <Badge color="red">{t('txn_voided')} — {txn.voidReason}</Badge>}
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {/* header */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-ink-400">{t('txn_customer')}</p>
                <button onClick={() => nav(`/customers/${txn.customerId}`)} className="text-lg font-extrabold text-ink-900 hover:text-brand-600 dark:text-ink-50">{cust?.name || '—'}</button>
                <p className="text-xs text-ink-400" dir="ltr">{cust?.phone || ''}</p>
              </div>
              <div className="text-end">
                <p className={`text-2xl font-black ${txn.voided ? 'text-ink-300 line-through' : 'text-red-600'}`}>{formatMoney(txn.total, cur)}</p>
                <p className="text-[10px] text-ink-400">{t('txn_date')}: {formatDate(txn.date, lang)}</p>
              </div>
            </div>
            {!txn.voided && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-900/30"><p className="text-[9px] font-bold text-emerald-600">{t('common_paid')}</p><p className="text-sm font-black text-emerald-700 dark:text-emerald-300">{formatCompact(txn.paid, cur)}</p></div>
                <div className="rounded-xl bg-red-50 p-2 dark:bg-red-900/30"><p className="text-[9px] font-bold text-red-500">{t('common_remaining')}</p><p className="text-sm font-black text-red-600">{formatCompact(remaining, cur)}</p></div>
                <div className="rounded-xl bg-amber-50 p-2 dark:bg-amber-900/30">
                  <p className="text-[9px] font-bold text-amber-600">{t('txn_dueDate')}</p>
                  <p className="text-sm font-black text-amber-700 dark:text-amber-300">{txn.dueDate ? formatDateShort(txn.dueDate) : '—'}</p>
                  {late > 0 && <p className="text-[9px] font-bold text-red-500">{t('txn_daysLate')}: {late}</p>}
                </div>
                <div className="rounded-xl bg-sky-50 p-2 dark:bg-sky-900/30"><p className="text-[9px] font-bold text-sky-600">{t('pay_method')}</p><p className="text-sm font-black text-sky-700 dark:text-sky-300">{txn.paymentMethod ? t(`pay_${txn.paymentMethod}` as never) : '—'}</p></div>
              </div>
            )}
          </Card>

          {/* items */}
          <Card className="overflow-hidden">
            <h3 className="border-b border-ink-100 p-3 text-sm font-bold text-ink-700 dark:border-ink-700 dark:text-ink-200">{t('txn_items')}</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-start text-[10px] font-bold uppercase text-ink-400">
                  <th className="px-3 py-2 text-start">{t('txn_itemName')}</th>
                  <th className="px-3 py-2 text-center">{t('txn_qty')}</th>
                  <th className="px-3 py-2 text-end">{t('txn_origPrice')}</th>
                  <th className="px-3 py-2 text-end">{t('txn_discount')}</th>
                  <th className="px-3 py-2 text-end">{t('txn_finalPrice')}</th>
                  <th className="px-3 py-2 text-end">{t('txn_lineTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {txn.items.map((it) => (
                  <tr key={it.id} className="border-t border-ink-50 dark:border-ink-700/50">
                    <td className="px-3 py-2 font-bold">{it.name}</td>
                    <td className="px-3 py-2 text-center">{it.quantity}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{formatCompact(it.originalPrice, cur)}</td>
                    <td className="px-3 py-2 text-end">{it.discountValue > 0 ? (it.discountType === 'percent' ? `${it.discountValue}%` : formatCompact(it.discountValue, cur)) : '—'}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{formatCompact(it.finalPrice, cur)}</td>
                    <td className="px-3 py-2 text-end font-bold tabular-nums">{formatCompact(it.lineTotal, cur)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink-100 dark:border-ink-700">
                  <td colSpan={4} className="px-3 py-2 text-end text-[10px] font-bold uppercase text-ink-400">{t('txn_subtotal')}: <span className="tabular-nums">{formatCompact(txn.subtotal, cur)}</span></td>
                  <td colSpan={2} className="px-3 py-2 text-end font-black text-ink-900 dark:text-ink-50">{t('txn_total')}: {formatCompact(txn.total, cur)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          {/* promise */}
          {txn.promiseDate && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-bold text-ink-700 dark:text-ink-200">{t('txn_promise')} 🤝</h3>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <div><p className="text-[10px] font-bold text-ink-400">{t('txn_promiseDate')}</p><p className="font-bold">{formatDate(txn.promiseDate, lang)}</p></div>
                {txn.promiseAmount ? <div><p className="text-[10px] font-bold text-ink-400">{t('txn_promiseAmount')}</p><p className="font-bold">{formatMoney(txn.promiseAmount, cur)}</p></div> : null}
                {txn.promiseNote ? <div className="col-span-2 sm:col-span-1"><p className="text-[10px] font-bold text-ink-400">{t('txn_promiseNote')}</p><p className="font-bold">"{txn.promiseNote}"</p></div> : null}
              </div>
            </Card>
          )}

          {txn.note && (
            <Card className="p-4">
              <h3 className="mb-1 text-sm font-bold text-ink-700 dark:text-ink-200">{t('txn_note')}</h3>
              <p className="text-sm text-ink-600 dark:text-ink-300">{txn.note}</p>
            </Card>
          )}

          {/* evidence */}
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-bold text-ink-700 dark:text-ink-200">{t('txn_evidence')}</h3>
            <PhotoGallery attachments={atts} canAdd onAdd={(k, b) => onPhotoAdd(k, b)} onDelete={(aid) => { if (window.confirm(t('misc_confirmDelete'))) void removeAttachment(aid) }} />
            <div className="mt-3 space-y-2">
              {voices.length === 0 && <p className="text-xs text-ink-400">{t('misc_noVoice')}</p>}
              {voices.map((v) => <VoicePlayer key={v.id} voice={v} onDelete={() => { if (window.confirm(t('misc_confirmDelete'))) void removeVoice(v.id) }} />)}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) void onPhotoAdd('receipt', e.target.files[0]); e.target.value = '' }} />
            <Button size="sm" variant="outline" className="mt-3" onClick={() => fileRef.current?.click()}><IconPlus width={14} height={14} />{t('txn_receiptPhoto')}</Button>
          </Card>

          {/* audit */}
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-bold text-ink-700 dark:text-ink-200">{t('txn_audit')}</h3>
            {audits.length === 0 && <p className="text-xs text-ink-400">—</p>}
            <div className="space-y-1.5">
              {audits.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg bg-ink-50 p-2 text-[11px] dark:bg-ink-700/50">
                  <div className="min-w-0">
                    <p className="font-bold text-ink-700 dark:text-ink-200">{a.summary}</p>
                    <p className="text-ink-400">{formatDateTime(a.ts)} · {a.actor}{a.reason ? ` · ${t('txn_voidReason')}: ${a.reason}` : ''}</p>
                  </div>
                  <Badge color="gray">{a.action}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* sidebar */}
        <div className="space-y-3">
          {!txn.voided && remaining > 0 && (
            <Button className="w-full" size="lg" onClick={() => nav(`/payments/new?customer=${txn.customerId}`)}><IconReceipt width={18} height={18} />{t('pay_new')} — {formatCompact(remaining, cur)}</Button>
          )}
          <Card className="overflow-hidden">
            <div className="border-b border-ink-100 p-3 dark:border-ink-700">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-ink-700 dark:text-ink-200">{t('txn_receipt')}</h3>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" disabled={busyPdf} onClick={() => void makePdf()}>{busyPdf ? t('common_loading') : t('txn_generatePdf')}</Button>
                  <Button size="sm" variant="outline" onClick={() => receiptRef.current && printElement(receiptRef.current)}>{t('txn_print')}</Button>
                </div>
              </div>
            </div>
            <div className="bg-white">
              <Receipt ref={receiptRef} shop={shop} customer={cust || null} txn={txn} lang={lang} />
            </div>
          </Card>
          {late > 0 && !txn.voided && (
            <div className="flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-600 dark:bg-red-900/30">
              <IconAlert width={16} height={16} className="mt-0.5 shrink-0" />
              {t('notif_overdueBody', { name: cust?.name || '', amount: formatMoney(remaining, cur), days: late })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

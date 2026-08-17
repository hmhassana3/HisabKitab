import { forwardRef } from 'react'
import type { Customer, ShopProfile, Transaction } from '../types'
import { formatMoney } from '../lib/money'
import { formatDate } from '../lib/date'
import type { Lang } from '../types'

export interface ReceiptData {
  shop: ShopProfile | null
  customer: Customer | null
  txn: Transaction
  lang: Lang
}

/** Professional shop receipt — bilingual-safe (renders Urdu correctly). */
export const Receipt = forwardRef<HTMLDivElement, ReceiptData>(function Receipt({ shop, customer, txn, lang }, ref) {
  const cur = shop?.currency === 'PKR' ? 'Rs.' : 'Rs.'
  return (
    <div ref={ref} dir={lang === 'ur' ? 'rtl' : 'ltr'} className="receipt bg-white p-5 text-ink-900" style={{ fontFamily: '"JetBrains Mono","Noto Nastaliq Urdu",monospace' }}>
      {/* header */}
      <div className="border-b-2 border-dashed border-ink-300 pb-3 text-center">
        <h2 className="text-lg font-black">{shop?.name || 'My Shop'}</h2>
        {shop?.ownerName && <p className="text-xs">{shop.ownerName}</p>}
        {shop?.phone && <p className="text-xs" dir="ltr">{shop.phone}</p>}
        {shop?.address && <p className="text-xs">{shop.address}</p>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <p><span className="font-bold">Customer:</span> {customer?.name || '—'}</p>
        {customer?.phone && <p dir="ltr"><span className="font-bold">Phone:</span> {customer.phone}</p>}
        <p><span className="font-bold">Date:</span> {formatDate(txn.date, lang, shop?.timezone)}</p>
        <p dir="ltr"><span className="font-bold">Txn ID:</span> {txn.id}</p>
      </div>

      {/* items */}
      <table className="mt-3 w-full text-[11px]">
        <thead>
          <tr className="border-b border-ink-300 text-start">
            <th className="py-1 text-start">Item</th>
            <th className="py-1 text-center">Qty</th>
            <th className="py-1 text-end">Price</th>
            <th className="py-1 text-end">Disc</th>
            <th className="py-1 text-end">Total</th>
          </tr>
        </thead>
        <tbody>
          {txn.items.map((it) => (
            <tr key={it.id} className="border-b border-dotted border-ink-200">
              <td className="py-1">{it.name}</td>
              <td className="py-1 text-center">{it.quantity}</td>
              <td className="py-1 text-end tabular-nums">{formatMoney(it.finalPrice, cur)}</td>
              <td className="py-1 text-end tabular-nums">{it.discountValue > 0 ? (it.discountType === 'percent' ? `${it.discountValue}%` : formatMoney(it.discountValue, cur)) : '—'}</td>
              <td className="py-1 text-end tabular-nums">{formatMoney(it.lineTotal, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals */}
      <div className="mt-2 space-y-1 text-[11px]">
        <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatMoney(txn.subtotal, cur)}</span></div>
        <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">− {formatMoney(txn.totalDiscount, cur)}</span></div>
        <div className="flex justify-between text-sm font-black"><span>Total</span><span className="tabular-nums">{formatMoney(txn.total, cur)}</span></div>
        <div className="flex justify-between text-emerald-700 font-bold"><span>Paid</span><span className="tabular-nums">{formatMoney(txn.paid, cur)}</span></div>
        <div className="flex justify-between text-red-700 font-black text-sm"><span>Remaining</span><span className="tabular-nums">{formatMoney(txn.total - txn.paid, cur)}</span></div>
        {txn.dueDate && <div className="flex justify-between"><span>Due Date</span><span>{formatDate(txn.dueDate, lang, shop?.timezone)}</span></div>}
        {txn.note && <div className="flex justify-between gap-2"><span>Note:</span><span className="text-end">{txn.note}</span></div>}
      </div>

      <div className="mt-4 border-t-2 border-dashed border-ink-300 pt-3 text-center text-[11px]">
        <p className="font-black">{shop?.receiptFooter || 'Shukriya!'}</p>
      </div>
    </div>
  )
})

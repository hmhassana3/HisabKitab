import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Button, Card, Field, Input, PageHeader, SectionTitle, Select, TextArea } from '../components/ui'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { IconDownload, IconLogout, IconUpload } from '../components/icons'
import { downloadCSV } from '../lib/csv'
import { downloadJSON } from '../lib/download'
import { formatMoney, paisaToDecimal } from '../lib/money'
import { todayISO } from '../lib/date'
import type { AppSettings } from '../types'

export function Settings() {
  const app = useApp()
  const { user, getShop, saveShop, getSettings, saveSettings, logout, data, db, showToast, forceSync } = app
  const { t, lang } = useI18n()
  const nav = useNavigate()
  const shop = getShop() || { name: '', ownerName: '', phone: '', address: '', email: '', currency: 'PKR', timezone: 'Asia/Karachi', receiptFooter: '', id: 'main', createdAt: '', updatedAt: '' }
  const settings = getSettings()
  const [shopForm, setShopForm] = useState({ name: shop.name, ownerName: shop.ownerName, phone: shop.phone, address: shop.address, email: shop.email, receiptFooter: shop.receiptFooter })
  const [remForm, setRemForm] = useState({ ...settings.reminders })
  const [importRef, setImportRef] = useState<HTMLInputElement | null>(null)

  const saveShopForm = () => {
    saveShop({ ...shopForm })
    showToast(t('settings_saved'))
  }

  const saveReminders = () => {
    saveSettings({ reminders: { ...remForm } })
    showToast(t('settings_saved'))
  }

  const exportCustomers = () => {
    const rows: Array<Array<unknown>> = [[t('common_name'), t('cform_father'), t('cform_phone'), t('cform_email'), t('cform_address'), t('cprofile_balance'), t('status_overdue'), t('cform_dateAdded')]]
    for (const c of Object.values(data.customers.items)) {
      if (c.archived) continue
      rows.push([c.name, c.fatherName || '', c.phone || '', c.email || '', c.address || '', paisaToDecimal(customerBal(c.id)), '', c.createdAt])
    }
    downloadCSV(rows, `hisabkitab-customers-${todayISO()}.csv`)
    showToast(t('settings_exportDone'))
  }

  const exportTxns = () => {
    const rows: Array<Array<unknown>> = [[t('txn_id'), t('txn_date'), t('txn_customer'), t('txn_itemName'), t('txn_qty'), t('txn_origPrice'), t('txn_discount'), t('txn_finalPrice'), t('txn_total'), t('common_paid'), t('common_remaining'), t('txn_dueDate')]]
    for (const x of Object.values(data.transactions.items)) {
      const cname = data.customers.items[x.customerId]?.name || ''
      for (const it of x.items) {
        rows.push([x.id, x.date, cname, it.name, it.quantity, paisaToDecimal(it.originalPrice), it.discountType === 'percent' ? `${it.discountValue}%` : paisaToDecimal(it.discountValue), paisaToDecimal(it.finalPrice), paisaToDecimal(it.lineTotal), paisaToDecimal(x.paid), paisaToDecimal(x.total - x.paid), x.dueDate || ''])
      }
    }
    downloadCSV(rows, `hisabkitab-transactions-${todayISO()}.csv`)
    showToast(t('settings_exportDone'))
  }

  const exportJSON = () => {
    const backup: Record<string, unknown> = { app: 'hisabkitab', version: 1, exportedAt: new Date().toISOString() }
    for (const key of Object.keys(db.stores)) {
      backup[key] = (db.stores as unknown as Record<string, unknown>)[key]
    }
    downloadJSON(backup, `hisabkitab-backup-${todayISO()}.json`)
    showToast(t('settings_exportDone'))
  }

  const importJSON = async (file: File | undefined) => {
    if (!file) return
    try {
      const backup = JSON.parse(await file.text())
      if (!backup || backup.app !== 'hisabkitab') throw new Error('bad')
      for (const key of Object.keys(db.stores)) {
        const store = backup[key]
        if (store && typeof store === 'object' && store.items) {
          for (const [id, val] of Object.entries(store.items)) {
            const cur = db.getStore<any>(key as never)[id]
            if (!cur) db.upsert(key as never, val as never)
          }
        }
      }
      showToast(t('settings_restoreDone'))
      nav('/')
    } catch {
      showToast(t('settings_restoreFail'), 'error')
    }
  }

  const customerBal = (cid: string) => {
    const d = Object.values(data.transactions.items).filter((x) => x.customerId === cid && !x.voided).reduce((a, x) => a + x.total, 0)
    const c = Object.values(data.payments.items).filter((x) => x.customerId === cid && !x.voided).reduce((a, x) => a + x.amount, 0)
    return d - c
  }

  const days = [t('rem_day') + ' 0 (Sun)', t('rem_day') + ' 1 (Mon)', t('rem_day') + ' 2 (Tue)', t('rem_day') + ' 3 (Wed)', t('rem_day') + ' 4 (Thu)', t('rem_day') + ' 5 (Fri)', t('rem_day') + ' 6 (Sat)']

  return (
    <div>
      <PageHeader title={t('settings_title')} subtitle={`${t('settings_loggedInAs')}: ${user?.email || ''}`} />

      {/* language */}
      <SectionTitle>{t('settings_language')}</SectionTitle>
      <Card className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-bold text-ink-800 dark:text-ink-100">{lang === 'ur' ? 'اردو (Urdu)' : 'English'}</p>
          <p className="text-xs text-ink-400">{t('settings_language')} — {t('misc_beta')}</p>
        </div>
        <LanguageSwitcher />
      </Card>

      {/* theme */}
      <SectionTitle>{t('settings_theme')}</SectionTitle>
      <Card className="flex items-center justify-between p-4">
        <p className="text-sm font-bold text-ink-800 dark:text-ink-100">{t('settings_themeLabel')}</p>
        <div className="flex gap-2">
          <Button size="sm" variant={settings.theme === 'light' ? 'primary' : 'outline'} onClick={() => saveSettings({ theme: 'light' })}>{t('settings_light')} ☀️</Button>
          <Button size="sm" variant={settings.theme === 'dark' ? 'primary' : 'outline'} onClick={() => saveSettings({ theme: 'dark' })}>{t('settings_dark')} 🌙</Button>
        </div>
      </Card>

      {/* shop profile */}
      <SectionTitle>{t('settings_shop')}</SectionTitle>
      <Card className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('settings_shopName')}><Input value={shopForm.name} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} /></Field>
          <Field label={t('settings_ownerName')}><Input value={shopForm.ownerName} onChange={(e) => setShopForm({ ...shopForm, ownerName: e.target.value })} /></Field>
          <Field label={t('settings_phone')}><Input value={shopForm.phone} onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })} dir="ltr" /></Field>
          <Field label={t('settings_email')}><Input value={shopForm.email} onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })} dir="ltr" /></Field>
          <div className="sm:col-span-2">
            <Field label={t('settings_address')}><Input value={shopForm.address} onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t('settings_receiptFooter')}><Input value={shopForm.receiptFooter} onChange={(e) => setShopForm({ ...shopForm, receiptFooter: e.target.value })} placeholder={t('misc_thanks')} /></Field>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-400">{t('misc_currency')} · {t('misc_timezone')}</p>
          <Button onClick={saveShopForm}>{t('settings_save')}</Button>
        </div>
      </Card>

      {/* reminders */}
      <SectionTitle>{t('settings_reminders')}</SectionTitle>
      <Card className="space-y-3 p-4">
        <ToggleRow label={t('settings_weeklyOn')} checked={remForm.weeklyOn} onChange={(v) => setRemForm({ ...remForm, weeklyOn: v })} />
        <ToggleRow label={t('settings_dueOn')} checked={remForm.dueOn} onChange={(v) => setRemForm({ ...remForm, dueOn: v })} />
        <ToggleRow label={t('settings_overdueOn')} checked={remForm.overdueOn} onChange={(v) => setRemForm({ ...remForm, overdueOn: v })} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={t('settings_remDay')}>
            <Select value={remForm.weeklyDay} onChange={(e) => setRemForm({ ...remForm, weeklyDay: Number(e.target.value) })}>
              {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </Select>
          </Field>
          <Field label={t('settings_remTime')}>
            <Input type="time" value={remForm.time} onChange={(e) => setRemForm({ ...remForm, time: e.target.value })} />
          </Field>
          <Field label={t('settings_freq')}>
            <Input value={remForm.overdueSchedule.join(',')} onChange={(e) => setRemForm({ ...remForm, overdueSchedule: e.target.value.split(',').map((s) => Number(s.trim())).filter((n) => n > 0) })} placeholder="2,4,7" dir="ltr" />
          </Field>
        </div>
        <div className="flex justify-end"><Button onClick={saveReminders}>{t('settings_save')}</Button></div>
      </Card>

      {/* security */}
      <SectionTitle>{t('settings_security')}</SectionTitle>
      <Card className="p-4">
        <p className="text-xs leading-relaxed text-ink-500 dark:text-ink-400">{t('settings_dataInDrive')}</p>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 p-3 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          <span>{t('settings_google')} 🔒</span>
          <Button size="sm" variant="outline" onClick={() => void forceSync()}>{t('common_retry')} Sync</Button>
        </div>
      </Card>

      {/* backup/export */}
      <SectionTitle>{t('settings_backup')}</SectionTitle>
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCustomers}><IconDownload width={14} height={14} />{t('settings_exportCSV')}</Button>
          <Button variant="outline" size="sm" onClick={exportTxns}><IconDownload width={14} height={14} />{t('settings_exportTxnCSV')}</Button>
          <Button variant="outline" size="sm" onClick={exportJSON}><IconDownload width={14} height={14} />{t('settings_exportJSON')}</Button>
          <Button variant="outline" size="sm" onClick={() => importRef?.click()}><IconUpload width={14} height={14} />{t('settings_importJSON')}</Button>
          <input ref={(el) => setImportRef(el)} type="file" accept="application/json" className="hidden" onChange={(e) => { void importJSON(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        <p className="mt-2 text-[10px] text-ink-400">{t('settings_restoreDone')}</p>
      </Card>

      {/* account */}
      <SectionTitle>{t('settings_account')}</SectionTitle>
      <Card className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {user?.picture ? <img src={user.picture} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{user?.name?.slice(0, 1) || '?'}</div>}
          <div>
            <p className="text-sm font-bold text-ink-800 dark:text-ink-100">{user?.name}</p>
            <p className="text-xs text-ink-400" dir="ltr">{user?.email}</p>
          </div>
        </div>
        <Button variant="danger" onClick={() => { if (window.confirm(t('common_areYouSure'))) void logout() }}><IconLogout width={16} height={16} />{t('settings_logout')}</Button>
      </Card>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm font-semibold text-ink-700 dark:text-ink-200">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-brand-600" />
    </label>
  )
}

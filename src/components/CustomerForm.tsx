import { useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Button, Field, Input, TextArea, Modal } from './ui'
import { IconCamera, IconUpload } from './icons'
import { compressImage } from '../lib/compressImage'
import { useMediaUrl } from '../hooks/useMediaUrl'
import type { Customer } from '../types'

export interface CustomerFormValues {
  name: string
  fatherName: string
  phone: string
  email: string
  address: string
  notes: string
  reminderConsent: boolean
  photoId?: string
}

export function CustomerForm({ open, onClose, initial, title }: { open: boolean; onClose: () => void; initial?: Customer; title: string }) {
  const { createCustomer, updateCustomer, addAttachment, showToast } = useApp()
  const { t } = useI18n()
  const [v, setV] = useState<CustomerFormValues>({
    name: initial?.name || '',
    fatherName: initial?.fatherName || '',
    phone: initial?.phone || '',
    email: initial?.email || '',
    address: initial?.address || '',
    notes: initial?.notes || '',
    reminderConsent: initial?.reminderConsent || false,
    photoId: initial?.photoId,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const photo = useMediaUrl(v.photoId)

  const set = (k: keyof CustomerFormValues, val: unknown) => setV((s) => ({ ...s, [k]: val }))

  const handlePhotoFile = async (file: File | Blob | undefined) => {
    if (!file) return
    setUploadingPhoto(true)
    try {
      const blob = await compressImage(file)
      const att = await addAttachment('customer', blob, `customer-${Date.now()}.jpg`, {})
      set('photoId', att.id)
      showToast(t('misc_photoSaved'))
    } catch (e) {
      showToast(e instanceof Error && e.message === 'OFFLINE_UPLOAD' ? t('misc_offlineNote') : t('common_error'), 'error')
    } finally {
      setUploadingPhoto(false)
      if (fileRef.current) fileRef.current.value = ''
      if (camRef.current) camRef.current.value = ''
    }
  }

  const submit = async () => {
    const errs: Record<string, string> = {}
    if (!v.name.trim()) errs.name = t('cform_name') + ' ' + t('common_required')
    if (v.phone && !/^\+?\d{10,14}$/.test(v.phone.replace(/[^\d+]/g, ''))) errs.phone = t('cform_phoneInvalid')
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) errs.email = t('cform_emailInvalid')
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      if (initial) {
        updateCustomer(initial.id, {
          name: v.name.trim(), fatherName: v.fatherName.trim() || undefined, phone: v.phone.trim() || undefined,
          email: v.email.trim() || undefined, address: v.address.trim() || undefined, notes: v.notes.trim() || undefined,
          reminderConsent: v.reminderConsent, photoId: v.photoId,
        })
      } else {
        createCustomer({
          name: v.name, fatherName: v.fatherName, phone: v.phone, email: v.email, address: v.address,
          notes: v.notes, reminderConsent: v.reminderConsent, photoId: v.photoId,
        })
      }
      showToast(initial ? t('settings_saved') : t('cform_save') + ' ✓')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-center gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-ink-100 dark:bg-ink-700">
            {photo.url ? <img src={photo.url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-ink-300"><IconCamera /></div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploadingPhoto} onClick={() => camRef.current?.click()}>
              <IconCamera width={16} height={16} />{uploadingPhoto ? t('common_uploading') : t('cform_takePhoto')}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={uploadingPhoto} onClick={() => fileRef.current?.click()}>
              <IconUpload width={16} height={16} />{t('cform_upload')}
            </Button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
          </div>
        </div>
        <Field label={t('cform_name')} error={errors.name}>
          <Input value={v.name} onChange={(e) => set('name', e.target.value)} placeholder={t('cform_name')} />
        </Field>
        <Field label={t('cform_father')}>
          <Input value={v.fatherName} onChange={(e) => set('fatherName', e.target.value)} />
        </Field>
        <Field label={t('cform_phone')} error={errors.phone}>
          <Input value={v.phone} onChange={(e) => set('phone', e.target.value)} placeholder="03XX-XXXXXXX" dir="ltr" inputMode="tel" />
        </Field>
        <Field label={t('cform_email')} error={errors.email}>
          <Input value={v.email} onChange={(e) => set('email', e.target.value)} placeholder="customer@gmail.com" dir="ltr" inputMode="email" />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('cform_address')}>
            <Input value={v.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={t('cform_notes')}>
            <TextArea value={v.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
        <label className="sm:col-span-2 flex items-start gap-2.5 rounded-xl bg-ink-50 p-3 text-sm text-ink-700 dark:bg-ink-700/50 dark:text-ink-200">
          <input type="checkbox" checked={v.reminderConsent} onChange={(e) => set('reminderConsent', e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
          {t('cform_consent')}
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t('common_cancel')}</Button>
        <Button onClick={submit} disabled={saving}>{saving ? t('cform_saving') : t('cform_save')}</Button>
      </div>
    </Modal>
  )
}

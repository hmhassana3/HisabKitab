import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { useMediaUrl } from '../hooks/useMediaUrl'
import { Button, Modal } from './ui'
import { IconCamera, IconPause, IconPlay, IconTrash, IconUpload, IconZoom } from './icons'
import type { Attachment, AttachmentKind, VoiceRecord } from '../types'
import { formatDateTime } from '../lib/date'

// ── Photo gallery ────────────────────────────────────────────
export function PhotoGallery({ attachments, canAdd, onAdd, onDelete }: {
  attachments: Attachment[]
  canAdd?: boolean
  onAdd?: (kind: AttachmentKind, blob: Blob) => void
  onDelete?: (id: string) => void
}) {
  const { t } = useI18n()
  const { showToast } = useApp()
  const [zoomId, setZoomId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | Blob | undefined, kind: AttachmentKind) => {
    if (!file || !onAdd) return
    setUploading(true)
    try {
      await onAdd(kind, file)
    } catch (e) {
      showToast(e instanceof Error && e.message === 'OFFLINE_UPLOAD' ? t('misc_offlineNote') : t('common_error'), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      if (camRef.current) camRef.current.value = ''
    }
  }

  const zoomed = attachments.find((a) => a.id === zoomId)

  return (
    <div>
      {attachments.length === 0 && <p className="py-6 text-center text-xs text-ink-400">{t('misc_noPhotos')}</p>}
      <div className="grid grid-cols-3 gap-2">
        {attachments.map((a) => (
          <PhotoThumb key={a.id} att={a} onZoom={() => setZoomId(a.id)} onDelete={onDelete ? () => onDelete(a.id) : undefined} />
        ))}
        {canAdd && onAdd && (
          <div className="flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink-200 text-ink-400 dark:border-ink-600">
            <div className="flex gap-1">
              <button onClick={() => camRef.current?.click()} className="rounded-lg bg-ink-100 p-2 hover:bg-ink-200 dark:bg-ink-700" title={t('cform_takePhoto')}><IconCamera width={16} height={16} /></button>
              <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-ink-100 p-2 hover:bg-ink-200 dark:bg-ink-700" title={t('cform_upload')}><IconUpload width={16} height={16} /></button>
            </div>
            <span className="text-[10px]">{uploading ? t('common_uploading') : t('misc_photoGallery')}</span>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], 'other')} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], 'other')} />
          </div>
        )}
      </div>

      <Modal open={!!zoomed} onClose={() => setZoomId(null)} title={zoomed?.name || ''}>
        {zoomed && <ZoomView att={zoomed} onDelete={onDelete ? () => { onDelete(zoomed.id); setZoomId(null) } : undefined} />}
      </Modal>
    </div>
  )
}

function PhotoThumb({ att, onZoom, onDelete }: { att: Attachment; onZoom: () => void; onDelete?: () => void }) {
  const { t } = useI18n()
  const media = useMediaUrl(att.fileId)
  return (
    <div className="group relative overflow-hidden rounded-xl bg-ink-100 dark:bg-ink-700">
      {media.url
        ? <img src={media.url} alt={att.name} loading="lazy" onClick={onZoom} className="h-24 w-full cursor-zoom-in object-cover transition-transform hover:scale-105" />
        : <div className="flex h-24 items-center justify-center text-[10px] text-ink-400">{media.loading ? t('common_loading') : t('common_error')}</div>}
      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
        <button onClick={onZoom} className="rounded-lg bg-white/90 p-1.5 text-ink-800"><IconZoom width={14} height={14} /></button>
        {onDelete && <button onClick={onDelete} className="rounded-lg bg-red-500/90 p-1.5 text-white"><IconTrash width={14} height={14} /></button>}
      </div>
    </div>
  )
}

function ZoomView({ att, onDelete }: { att: Attachment; onDelete?: () => void }) {
  const { t } = useI18n()
  const media = useMediaUrl(att.fileId)
  return (
    <div>
      {media.url
        ? <img src={media.url} alt="" className="mx-auto max-h-[60vh] rounded-2xl object-contain" />
        : <p className="py-10 text-center text-sm text-ink-400">{media.loading ? t('common_loading') : t('common_error')}</p>}
      <p className="mt-2 text-center text-[11px] text-ink-400">{formatDateTime(att.createdAt)} · {Math.round(att.size / 1024)} KB</p>
      {onDelete && (
        <div className="mt-3 flex justify-center">
          <Button variant="danger" size="sm" onClick={() => { if (window.confirm(t('misc_confirmDelete'))) onDelete() }}><IconTrash width={14} height={14} />{t('misc_delete')}</Button>
        </div>
      )}
    </div>
  )
}

// ── Voice player ─────────────────────────────────────────────
export function VoicePlayer({ voice, onDelete }: { voice: VoiceRecord; onDelete?: () => void }) {
  const { t } = useI18n()
  const media = useMediaUrl(voice.fileId)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)

  useEffect(() => {
    const a = new Audio()
    audioRef.current = a
    return () => { a.pause(); a.src = '' }
  }, [])

  useEffect(() => {
    const a = audioRef.current
    if (!a || !media.url) return
    a.src = media.url
    const onEnd = () => setPlaying(false)
    a.addEventListener('ended', onEnd)
    return () => a.removeEventListener('ended', onEnd)
  }, [media.url])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setPos(a.currentTime)
    a.addEventListener('timeupdate', onTime)
    return () => a.removeEventListener('timeupdate', onTime)
  }, [])

  const toggle = () => {
    const a = audioRef.current
    if (!a || !media.url) return
    if (playing) { a.pause(); setPlaying(false) } else { a.play().catch(() => undefined); setPlaying(true) }
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-ink-50 p-2.5 dark:bg-ink-700/50">
      <button onClick={toggle} disabled={!media.url} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white disabled:opacity-40">
        {playing ? <IconPause width={16} height={16} /> : <IconPlay width={16} height={16} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-ink-800 dark:text-ink-100">
          {voice.speaker === 'customer' ? t('misc_speakerCustomer') : t('misc_speakerShopkeeper')} · {mmss(voice.durationSec)}
        </p>
        <p className="text-[10px] text-ink-400">{formatDateTime(voice.createdAt)} · {Math.round(voice.size / 1024)} KB</p>
        <div className="mt-1 h-1 w-full rounded-full bg-ink-200 dark:bg-ink-600">
          <div className="h-1 rounded-full bg-brand-500" style={{ width: `${voice.durationSec ? Math.min(100, (pos / voice.durationSec) * 100) : 0}%` }} />
        </div>
      </div>
      {onDelete && (
        <button onClick={() => { if (window.confirm(t('misc_confirmDelete'))) onDelete() }} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30">
          <IconTrash width={16} height={16} />
        </button>
      )}
    </div>
  )
}

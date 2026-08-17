import { useState } from 'react'
import { useMediaRecorder } from '../hooks/useMediaRecorder'
import { useI18n } from '../i18n'
import { Button } from './ui'
import { IconMic, IconPause, IconPlay, IconRecord, IconStop, IconTrash } from './icons'

export interface VoiceCaptureResult {
  blob: Blob
  durationSec: number
}

export function VoiceRecorder({ label, onSave, saving }: { label: string; onSave: (r: VoiceCaptureResult) => void; saving?: boolean }) {
  const { t } = useI18n()
  const rec = useMediaRecorder()
  const [playing, setPlaying] = useState(false)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  const togglePlay = () => {
    if (!rec.blob) return
    if (!audio) {
      const a = new Audio(URL.createObjectURL(rec.blob))
      a.onended = () => setPlaying(false)
      setAudio(a)
      a.play().catch(() => undefined)
      setPlaying(true)
    } else if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().catch(() => undefined)
      setPlaying(true)
    }
  }

  const doSave = () => {
    if (!rec.blob) return
    onSave({ blob: rec.blob, durationSec: rec.durationSec })
    rec.clear()
    setAudio(null)
    setPlaying(false)
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-ink-50 p-3 dark:border-ink-700 dark:bg-ink-700/40">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-ink-700 dark:text-ink-200">
          <IconMic width={14} height={14} />{label}
          {rec.recording && (
            <span className="ml-1 inline-flex items-center gap-1 text-red-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> {t('misc_recording')} {mmss(rec.durationSec)}
            </span>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          {!rec.recording && !rec.blob && (
            <Button size="sm" variant="danger" onClick={() => void rec.start()}><IconRecord width={14} height={14} />{t('misc_record')}</Button>
          )}
          {rec.recording && (
            <Button size="sm" variant="danger" onClick={rec.stop}><IconStop width={14} height={14} />{t('misc_stop')}</Button>
          )}
          {!rec.recording && rec.blob && (
            <>
              <Button size="sm" variant="outline" onClick={togglePlay}>{playing ? <IconPause width={14} height={14} /> : <IconPlay width={14} height={14} />}{playing ? t('misc_pause') : t('misc_play')} · {mmss(rec.durationSec)}</Button>
              <Button size="sm" variant="outline" onClick={rec.clear}><IconTrash width={14} height={14} />{t('misc_reRecord')}</Button>
              <Button size="sm" disabled={saving} onClick={doSave}>{t('common_save')}</Button>
            </>
          )}
        </div>
      </div>
      {rec.error && <p className="mt-2 text-[10px] font-bold text-red-500">{t('common_error')}: {rec.error}</p>}
    </div>
  )
}

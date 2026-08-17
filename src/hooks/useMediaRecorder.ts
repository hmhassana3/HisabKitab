import { useCallback, useEffect, useRef, useState } from 'react'

export interface RecorderState {
  supported: boolean
  recording: boolean
  durationSec: number
  blob: Blob | null
  error: string | null
  start: () => Promise<void>
  stop: () => void
  clear: () => void
}

/**
 * Browser voice recorder (MediaRecorder → webm/ogg blob).
 * Real microphone — clear consent is the caller's job (UI shows it).
 */
export function useMediaRecorder(): RecorderState {
  const [supported] = useState(() => typeof window !== 'undefined' && !!(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined')
  const [recording, setRecording] = useState(false)
  const [durationSec, setDurationSec] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  useEffect(() => () => {
    clearTimer()
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const start = useCallback(async () => {
    if (!supported) { setError('no_media_recorder'); return }
    setError(null)
    setDurationSec(0)
    chunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      recRef.current = rec
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const type = rec.mimeType || 'audio/webm'
        const b = new Blob(chunksRef.current, { type })
        setBlob(b)
        stream.getTracks().forEach((t) => t.stop())
        clearTimer()
        setRecording(false)
      }
      rec.start()
      setRecording(true)
      timerRef.current = setInterval(() => setDurationSec((d) => d + 1), 1000)
    } catch (e) {
      setError('microphone_denied')
      setRecording(false)
    }
  }, [supported])

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.stop()
    }
  }, [])

  const clear = useCallback(() => {
    setBlob(null)
    setDurationSec(0)
    chunksRef.current = []
  }, [])

  return { supported, recording, durationSec, blob, error, start, stop, clear }
}

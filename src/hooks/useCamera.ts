import { useCallback, useEffect, useRef, useState } from 'react'

export interface CameraResult {
  supported: boolean
  capturing: boolean
  error: string | null
  capture: () => Promise<Blob>
}

/**
 * Camera helper:
 *  • mobile → capture attribute (system camera)
 *  • desktop → getUserMedia video + canvas snapshot
 * The caller renders the UI; capture() returns a compressed JPEG blob.
 */
export function useCamera(onCaptured: (blob: Blob) => void): CameraResult {
  const supported = typeof navigator !== 'undefined' && !!(navigator.mediaDevices?.getUserMedia)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onCapturedRef = useRef(onCaptured)
  onCapturedRef.current = onCaptured

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => cleanup, [cleanup])

  const capture = useCallback(async (): Promise<Blob> => {
    if (!supported) throw new Error('no_camera')
    setError(null)
    setCapturing(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false })
      streamRef.current = stream
      const video = document.createElement('video')
      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      await new Promise<void>((resolve) => { video.onloadedmetadata = () => resolve(); video.play() })
      await new Promise<void>((resolve) => setTimeout(resolve, 350))
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no_canvas')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob_failed'))), 'image/jpeg', 0.8))
      cleanup()
      onCapturedRef.current(blob)
      setCapturing(false)
      return blob
    } catch (e) {
      cleanup()
      setError('camera_denied')
      setCapturing(false)
      throw e
    }
  }, [supported, cleanup])

  return { supported, capturing, error, capture }
}

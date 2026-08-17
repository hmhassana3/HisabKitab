import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'

export interface MediaState {
  url: string | null
  loading: boolean
  error: boolean
  retry: () => void
}

/** Fetches a Drive file (photos/voice) and exposes a local blob URL. */
export function useMediaUrl(fileId: string | undefined): MediaState {
  const { db } = useApp()
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(!!fileId)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    let live = true
    if (!fileId) {
      setUrl(null)
      setLoading(false)
      setError(false)
      return
    }
    setLoading(true)
    setError(false)
    db.getMedia(fileId)
      .then((blob) => {
        if (!live) return
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        const u = URL.createObjectURL(blob)
        urlRef.current = u
        setUrl(u)
        setLoading(false)
      })
      .catch(() => {
        if (!live) return
        setError(true)
        setLoading(false)
      })
    return () => {
      live = false
    }
  }, [fileId, db, tick])

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  return { url, loading, error, retry: () => setTick((t) => t + 1) }
}

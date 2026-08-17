import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { IconCalculator } from './icons'

interface CalcState {
  display: string
  acc: number | null
  op: string | null
  fresh: boolean
  lastInputAt: number
}

const KEYS: Array<{ k: string; label?: string; cls?: string }> = [
  { k: 'AC', cls: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
  { k: '⌫', label: 'back' },
  { k: '%', cls: 'bg-ink-100 dark:bg-ink-700' },
  { k: '÷', cls: 'bg-brand-600 text-white' },
  { k: '7' }, { k: '8' }, { k: '9' },
  { k: '×', cls: 'bg-brand-600 text-white' },
  { k: '4' }, { k: '5' }, { k: '6' },
  { k: '−', cls: 'bg-brand-600 text-white' },
  { k: '1' }, { k: '2' }, { k: '3' },
  { k: '+', cls: 'bg-brand-600 text-white' },
  { k: '0', cls: 'col-span-2' }, { k: '.' },
  { k: '=', cls: 'bg-amber-500 text-white' },
]

export function Calculator() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [st, setSt] = useState<CalcState>({ display: '0', acc: null, op: null, fresh: true, lastInputAt: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const apply = useCallback((s: CalcState, k: string): CalcState => {
    const now = Date.now()
    if (k === 'AC') return { display: '0', acc: null, op: null, fresh: true, lastInputAt: now }
    if (k === '⌫') {
      const d = s.fresh ? '0' : s.display
      return { ...s, display: d.length > 1 ? d.slice(0, -1) : '0', lastInputAt: now }
    }
    if (k === '%') {
      const n = parseFloat(s.display) || 0
      return { ...s, display: String(n / 100), lastInputAt: now }
    }
    if (['+', '−', '×', '÷'].includes(k)) {
      const cur = parseFloat(s.display) || 0
      const acc = s.acc === null ? cur : compute(s.acc, cur, s.op)
      return { display: fmt(acc), acc, op: k, fresh: true, lastInputAt: now }
    }
    if (k === '=') {
      if (s.op === null) return { ...s, lastInputAt: now }
      const cur = parseFloat(s.display) || 0
      const res = compute(s.acc === null ? 0 : s.acc, cur, s.op)
      return { display: fmt(res), acc: null, op: null, fresh: true, lastInputAt: now }
    }
    // digit or dot
    if (s.fresh) return { ...s, display: k === '.' ? '0.' : k, fresh: false, lastInputAt: now }
    const d = s.display
    if (k === '.' && d.includes('.')) return { ...s, lastInputAt: now }
    if (d === '0' && k !== '.') return { ...s, display: k, lastInputAt: now }
    if (d.replace(/[-.]/g, '').length >= 14) return { ...s, lastInputAt: now }
    return { ...s, display: d + k, lastInputAt: now }
  }, [])

  const press = useCallback((k: string) => {
    setSt((s) => {
      const next = apply(s, k)
      return next
    })
  }, [apply])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setOpen(false)
    }, 2000)
  }, [])

  // auto-hide after 2s of no interaction
  useEffect(() => {
    if (open) {
      resetTimer()
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }
  }, [open, resetTimer])

  // open from anywhere (e.g. dashboard quick action)
  useEffect(() => {
    const onOpen = () => { setOpen(true); resetTimer() }
    window.addEventListener('hk:calc', onOpen)
    return () => window.removeEventListener('hk:calc', onOpen)
  }, [resetTimer])

  const handleKey = useCallback((k: string) => {
    press(k)
    resetTimer()
  }, [press, resetTimer])

  // keyboard support (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return
      const map: Record<string, string> = { '*': '×', '/': '÷', '-': '−', 'Enter': '=', '=': '=', 'Backspace': '⌫', 'Escape': 'AC' }
      const k = map[e.key] ?? (/^[0-9.]$/.test(e.key) ? e.key : null)
      if (k) {
        e.preventDefault()
        handleKey(k)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleKey])

  return (
    <>
      {/* floating icon — top-right, always visible */}
      <button
        onClick={() => { setOpen((o) => !o); resetTimer() }}
        aria-label={t('calc_title')}
        className="fixed top-3 ltr:right-16 rtl:left-16 z-40 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-pop hover:bg-brand-700 transition-transform active:scale-95"
      >
        <IconCalculator width={20} height={20} />
      </button>

      {open && (
        <div
          className="fixed bottom-20 sm:bottom-6 ltr:right-3 rtl:left-3 z-40 w-[calc(100vw-1.5rem)] max-w-[340px] h-[46vh] max-h-[420px] rounded-3xl bg-ink-900 dark:bg-ink-950 shadow-pop p-3 flex flex-col animate-slideup"
          onMouseDown={resetTimer}
          onTouchStart={resetTimer}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-ink-400">{t('calc_title')}</span>
            <button className="text-ink-500 text-xs font-bold px-2" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="mb-2 rounded-2xl bg-ink-800 dark:bg-ink-900 px-4 py-3 text-right rtl:text-left">
            <span className="text-2xl font-bold text-white tabular-nums break-all">{st.display}</span>
          </div>
          <div className="grid flex-1 grid-cols-4 gap-1.5">
            {KEYS.map((b) => (
              <button
                key={b.k}
                onClick={() => handleKey(b.k)}
                className={`rounded-xl text-base font-bold transition-transform active:scale-95 ${b.k === '0' ? 'col-span-2' : ''} ${b.cls || 'bg-ink-800 text-white dark:bg-ink-800 hover:bg-ink-700'}`}
              >
                {b.label === 'back' ? '⌫' : b.k}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function compute(a: number, b: number, op: string | null): number {
  switch (op) {
    case '+': return a + b
    case '−': return a - b
    case '×': return a * b
    case '÷': return b === 0 ? 0 : a / b
    default: return b
  }
}
function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n * 1e10) / 1e10)
}

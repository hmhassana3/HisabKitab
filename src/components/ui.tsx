import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useI18n } from '../i18n'
import type { SyncStatus } from '../types'
import { IconCheck, IconClose, IconRefresh } from './icons'

// ── Button ───────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success'
export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
    secondary: 'bg-ink-100 text-ink-800 hover:bg-ink-200 dark:bg-ink-700 dark:text-ink-100 dark:hover:bg-ink-600',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    ghost: 'bg-transparent text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
    outline: 'border border-ink-300 text-ink-700 hover:bg-ink-50 dark:border-ink-600 dark:text-ink-200 dark:hover:bg-ink-800',
  }
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3.5 text-base' }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none ${styles[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}

export function IconBtn({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`inline-flex items-center justify-center rounded-xl p-2 text-ink-500 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800 transition-colors ${className}`} {...props} />
}

// ── Card ─────────────────────────────────────────────────────
export function Card({ className = '', children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-white dark:bg-ink-800 rounded-2xl shadow-card border border-ink-100 dark:border-ink-700 ${onClick ? 'cursor-pointer hover:shadow-pop transition-shadow' : ''} ${className}`}>
      {children}
    </div>
  )
}

// ── Form controls ────────────────────────────────────────────
const fieldCls =
  'w-full rounded-xl border border-ink-200 dark:border-ink-600 bg-white dark:bg-ink-900 px-3.5 py-2.5 text-sm text-ink-900 dark:text-ink-100 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input className={`${fieldCls} ${className}`} {...rest} />
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', ...rest } = props
  return <select className={`${fieldCls} ${className}`} {...rest} />
}
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props
  return <textarea className={`${fieldCls} min-h-[80px] ${className}`} {...rest} />
}
export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  const { t } = useI18n()
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-red-500">{error}</span>}
    </label>
  )
}

// ── Modal ────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[92vh] overflow-y-auto bg-white dark:bg-ink-800 rounded-t-3xl sm:rounded-3xl shadow-pop p-5 pb-8 animate-slideup`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink-900 dark:text-ink-100">{title}</h3>
          <IconBtn onClick={onClose} aria-label="close"><IconClose /></IconBtn>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Badges ───────────────────────────────────────────────────
export function Badge({ color = 'gray', children, pulse }: { color?: 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple'; children: ReactNode; pulse?: boolean }) {
  const map = {
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    blue: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
    gray: 'bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${map[color]}`}>
      {pulse && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: 'paid' | 'partial' | 'due' | 'overdue' | 'no_balance' }) {
  const { t } = useI18n()
  if (status === 'paid' || status === 'no_balance') return <Badge color="green">{t(status === 'paid' ? 'status_paid' : 'status_noBalance')}</Badge>
  if (status === 'partial') return <Badge color="blue">{t('status_partial')}</Badge>
  if (status === 'due') return <Badge color="amber">{t('status_due')}</Badge>
  return <Badge color="red" pulse>{t('status_overdue')}</Badge>
}

// ── Sync status ──────────────────────────────────────────────
export function SyncBadge({ status }: { status: SyncStatus }) {
  const { t } = useI18n()
  const map: Record<SyncStatus, { color: 'green' | 'gray' | 'red' | 'amber' | 'blue'; label: string; icon?: ReactNode }> = {
    synced: { color: 'green', label: t('common_synced'), icon: <IconCheck width={12} height={12} /> },
    syncing: { color: 'blue', label: t('common_syncing'), icon: <IconRefresh width={12} height={12} className="animate-spin" /> },
    offline: { color: 'amber', label: t('common_offline') },
    sync_failed: { color: 'red', label: t('common_syncFailed') },
    error: { color: 'red', label: t('common_error') },
  }
  const m = map[status]
  return <Badge color={m.color} pulse={status === 'syncing' || status === 'offline'}>{m.icon}{m.label}</Badge>
}

// ── Misc ─────────────────────────────────────────────────────
export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-ink-400">
      <IconRefresh className="animate-spin" width={18} height={18} />
      <span className="text-sm">{label ?? t('common_loading')}</span>
    </div>
  )
}

export function EmptyState({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon && <div className="text-ink-300 dark:text-ink-600">{icon}</div>}
      <p className="text-sm text-ink-400 dark:text-ink-500">{text}</p>
    </div>
  )
}

export function StatCard({ label, value, sub, color = 'ink', icon }: { label: string; value: string; sub?: string; color?: 'green' | 'red' | 'amber' | 'blue' | 'ink'; icon?: ReactNode }) {
  const colors = {
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-sky-600 dark:text-sky-400',
    ink: 'text-ink-900 dark:text-ink-100',
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">{label}</p>
          <p className={`mt-1 truncate text-lg font-bold ${colors[color]}`}>{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-ink-400">{sub}</p>}
        </div>
        {icon && <div className="shrink-0 rounded-xl bg-ink-50 dark:bg-ink-700 p-2 text-brand-600 dark:text-brand-400">{icon}</div>}
      </div>
    </Card>
  )
}

// ── Toasts ───────────────────────────────────────────────────
export function ToastView({ toast, onDismiss }: { toast: { id: number; message: string; kind: 'success' | 'error' | 'info' } | null; onDismiss: () => void }) {
  useEffect(() => {
    if (toast) {
      const t = setTimeout(onDismiss, 3200)
      return () => clearTimeout(t)
    }
  }, [toast, onDismiss])
  if (!toast) return null
  const bg = toast.kind === 'success' ? 'bg-emerald-600' : toast.kind === 'error' ? 'bg-red-600' : 'bg-ink-800'
  return (
    <div className={`fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-2xl ${bg} text-white px-4 py-2.5 text-sm shadow-pop max-w-[92vw] text-center animate-slideup`}>
      {toast.message}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900 dark:text-ink-50">{title}</h1>
        {subtitle && <p className="text-xs text-ink-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500 dark:text-ink-400">{children}</h2>
      {action}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl bg-ink-100 dark:bg-ink-700 p-1 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${value === o.value ? 'bg-white dark:bg-ink-800 text-brand-700 dark:text-brand-300 shadow-sm' : 'text-ink-500 dark:text-ink-400 hover:text-ink-700'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

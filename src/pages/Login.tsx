import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Button } from '../components/ui'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { IconReceipt, IconUsers, IconWallet } from '../components/icons'

const G = (p: { width?: number; height?: number }) => (
  <svg viewBox="0 0 24 24" width={p.width ?? 22} height={p.height ?? 22}>
    <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
    <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5.1l-3.8 2.9C3.3 21.3 7.3 24 12 24z" />
    <path fill="#FBBC05" d="M5.1 14.3c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.3 6.8C.5 8.4 0 10.2 0 12s.5 3.6 1.3 5.2l3.8-2.9z" />
    <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.8l3.8 2.9c1-3 3.7-5 6.9-5z" />
  </svg>
)

export function Login() {
  const { signIn, showToast, clientId } = useApp()
  const { t } = useI18n()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)

  const doLogin = async () => {
    if (!clientId) {
      nav('/setup')
      return
    }
    setBusy(true)
    try {
      await signIn()
      nav('/')
    } catch {
      showToast(t('login_error'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-700 via-brand-600 to-emerald-800">
      <div className="flex justify-end p-4"><LanguageSwitcher light /></div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-white/15 text-5xl font-black text-white backdrop-blur">ح</div>
        <h1 className="text-4xl font-black text-white">{t('appName')}</h1>
        <p className="mt-2 max-w-xs text-sm text-emerald-100">{t('login_subtitle')}</p>

        <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-2">
          {[
            { icon: <IconUsers width={18} height={18} />, label: t('nav_customers') },
            { icon: <IconWallet width={18} height={18} />, label: t('dash_totalBaqi') },
            { icon: <IconReceipt width={18} height={18} />, label: t('txn_receipt') },
          ].map((f) => (
            <div key={f.label} className="rounded-2xl bg-white/10 p-3 backdrop-blur">
              <div className="mx-auto mb-1 w-fit text-white">{f.icon}</div>
              <p className="text-[10px] font-bold text-emerald-50">{f.label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={doLogin}
          disabled={busy}
          className="mt-8 flex w-full max-w-sm items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-base font-bold text-ink-800 shadow-pop transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          <G /> {busy ? t('common_loading') : t('login_continue')}
        </button>

        <p className="mt-4 max-w-sm text-[11px] leading-relaxed text-emerald-100/90">
          {t('login_note')}
        </p>
        {!clientId && (
          <button onClick={() => nav('/setup')} className="mt-4 text-xs font-bold text-white underline underline-offset-2">
            {t('login_needSetup')} → {t('login_goSetup')}
          </button>
        )}
      </div>
      <p className="pb-6 text-center text-[10px] text-emerald-100/70">{t('misc_poweredBy')}</p>
    </div>
  )
}

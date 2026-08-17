import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Badge, SyncBadge } from './ui'
import { Calculator } from './Calculator'
import { IconBell, IconChart, IconGear, IconHome, IconMore, IconSwap, IconUsers } from './icons'

export function Layout() {
  const { user, status, data, online, getShop, lang } = useApp()
  const { t } = useI18n()
  const nav = useNavigate()
  const loc = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const shop = getShop()
  const unread = Object.values(data.notifications.items).filter((n) => !n.read).length

  const navItems = [
    { to: '/', label: t('nav_home'), icon: <IconHome width={22} height={22} /> },
    { to: '/customers', label: t('nav_customers'), icon: <IconUsers width={22} height={22} /> },
    { to: '/transactions', label: t('nav_transactions'), icon: <IconSwap width={22} height={22} /> },
    { to: '/reports', label: t('nav_reports'), icon: <IconChart width={22} height={22} /> },
  ]

  const moreItems = [
    { to: '/notifications', label: t('nav_notifications'), icon: <IconBell width={18} height={18} />, badge: unread },
    { to: '/settings', label: t('nav_settings'), icon: <IconGear width={18} height={18} /> },
    { to: '/customers', label: t('dash_customerSearch'), icon: <IconUsers width={18} height={18} /> },
  ]

  const isActive = (to: string) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to))

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-900">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-100 bg-white dark:border-ink-700 dark:bg-ink-800 lg:flex rtl:left-auto rtl:right-0 rtl:border-l rtl:border-r-0">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-lg font-black text-white">ح</div>
          <div>
            <p className="text-base font-extrabold text-ink-900 dark:text-ink-50">{t('appName')}</p>
            <p className="text-[10px] text-ink-400">{t('misc_poweredBy')}</p>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive: act }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${act || isActive(item.to) ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'text-ink-500 hover:bg-ink-50 dark:text-ink-400 dark:hover:bg-ink-700'}`
              }
            >
              {item.icon}{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-ink-100 dark:border-ink-700 p-3 space-y-1">
          <NavLink to="/notifications" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-500 hover:bg-ink-50 dark:text-ink-400 dark:hover:bg-ink-700">
            <IconBell width={18} height={18} />{t('nav_notifications')}
            {unread > 0 && <Badge color="red">{unread}</Badge>}
          </NavLink>
          <NavLink to="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-500 hover:bg-ink-50 dark:text-ink-400 dark:hover:bg-ink-700">
            <IconGear width={18} height={18} />{t('nav_settings')}
          </NavLink>
          <div className="mt-2 flex items-center justify-between px-3">
            <SyncBadge status={status} />
            {!online && <span className="text-[10px] text-amber-500">⚠</span>}
          </div>
        </div>
      </aside>

      {/* Mobile topbar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-ink-100 bg-white/90 px-4 py-3 backdrop-blur dark:border-ink-700 dark:bg-ink-800/90 lg:hidden">
        <button onClick={() => nav('/')} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-sm font-black text-white">ح</div>
          <div className="text-start">
            <p className="text-sm font-extrabold leading-tight text-ink-900 dark:text-ink-50">{shop?.name || t('appName')}</p>
            <p className="text-[10px] leading-tight text-ink-400"><SyncBadge status={status} /></p>
          </div>
        </button>
        <div className="flex items-center gap-1.5">
          <button onClick={() => nav('/notifications')} className="relative rounded-xl p-2 text-ink-500 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-700">
            <IconBell width={20} height={20} />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button onClick={() => nav('/settings')} className="rounded-xl p-2 text-ink-500 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-700">
            <IconGear width={20} height={20} />
          </button>
        </div>
      </header>

      {/* Desktop top strip */}
      <div className="hidden lg:block sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur dark:border-ink-700 dark:bg-ink-800/90">
        <div className="flex items-center justify-between px-6 py-3 ltr:ml-60 rtl:mr-60">
          <p className="text-sm font-bold text-ink-700 dark:text-ink-200">{shop?.name || t('appName')} — {t('dash_title')}</p>
          <div className="flex items-center gap-3">
            <SyncBadge status={status} />
            <button onClick={() => nav('/notifications')} className="relative rounded-xl p-2 text-ink-500 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-700">
              <IconBell width={19} height={19} />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {user?.picture
              ? <img src={user.picture} alt="" className="h-8 w-8 rounded-full ring-2 ring-brand-500" referrerPolicy="no-referrer" />
              : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{(user?.name || '?').slice(0, 1).toUpperCase()}</div>}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className={`pb-24 lg:pb-8 lg:pl-60 rtl:lg:pl-0 rtl:lg:pr-60 ${lang === 'ur' ? 'rtl' : ''}`}>
        <div className="mx-auto max-w-5xl px-4 py-4 lg:px-6 lg:py-6"><Outlet /></div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-ink-700 dark:bg-ink-800/95 lg:hidden">
        {navItems.map((item) => (
          <button
            key={item.to}
            onClick={() => nav(item.to)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${isActive(item.to) ? 'text-brand-600' : 'text-ink-400'}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
        <button onClick={() => setMoreOpen((o) => !o)} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${moreOpen ? 'text-brand-600' : 'text-ink-400'}`}>
          <IconMore width={22} height={22} />
          {t('nav_more')}
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md rounded-2xl border border-ink-100 bg-white p-2 shadow-pop dark:border-ink-700 dark:bg-ink-800 lg:hidden">
          {moreItems.map((item) => (
            <button
              key={item.to}
              onClick={() => { nav(item.to); setMoreOpen(false) }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700"
            >
              {item.icon}{item.label}
              {item.badge ? <Badge color="red">{item.badge}</Badge> : null}
            </button>
          ))}
        </div>
      )}

      <Calculator />
    </div>
  )
}

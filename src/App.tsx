import { useEffect } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useApp } from './state/AppContext'
import { useI18n } from './i18n'
import { Layout } from './components/Layout'
import { Spinner, ToastView } from './components/ui'
import { Login } from './pages/Login'
import { Setup } from './pages/Setup'
import { Dashboard } from './pages/Dashboard'
import { Customers } from './pages/Customers'
import { CustomerDetail } from './pages/CustomerDetail'
import { Transactions } from './pages/Transactions'
import { TransactionForm } from './components/TransactionForm'
import { TransactionDetail } from './pages/TransactionDetail'
import { PaymentForm } from './pages/PaymentForm'
import { Reports } from './pages/Reports'
import { Notifications } from './pages/Notifications'
import { Settings } from './pages/Settings'
import { Expenses } from './pages/Expenses'

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 dark:bg-ink-900">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-600 text-3xl font-black text-white">ح</div>
      <Spinner />
      <p className="mt-2 text-xs text-ink-400">HisabKitab</p>
    </div>
  )
}

function RequireAuth() {
  const { clientId, user, booted } = useApp()
  if (!booted) return <Splash />
  if (!clientId) return <Navigate to="/setup" replace />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function AppShell() {
  const { toast, data } = useApp()
  const { t, dir, lang } = useI18n()
  const theme = data.settings.items['main']?.theme || 'light'

  // global: RTL + language + title + theme
  useEffect(() => {
    document.documentElement.dir = dir
    document.documentElement.lang = lang
    document.title = t('appName')
  }, [dir, lang, t])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <>
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/transactions/new" element={<TransactionForm />} />
            <Route path="/transactions/:id" element={<TransactionDetail />} />
            <Route path="/payments/new" element={<PaymentForm />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
      <ToastView toast={toast} onDismiss={() => undefined} />
      <span className="hidden">{t('appName')}</span>
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { Button, Card, Input, Field } from '../components/ui'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { IconCheck } from '../components/icons'
import { refreshAccessToken } from '../drive/auth'

const STEPS = ['setup_step1_title', 'setup_step2_title', 'setup_step3_title', 'setup_step4_title', 'setup_step5_title'] as const
const STEP_BODIES = ['setup_step1_body', 'setup_step2_body', 'setup_step3_body', 'setup_step4_body', 'setup_step5_body'] as const

export function Setup() {
  const { setupClientId, clientId, showToast } = useApp()
  const { t } = useI18n()
  const nav = useNavigate()
  const [val, setVal] = useState(clientId)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)

  const save = () => {
    const id = val.trim()
    if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(id) && !/^[\w-]+\.googleusercontent\.com$/.test(id)) {
      showToast(t('setup_invalid'), 'error')
      return
    }
    setupClientId(id)
    showToast(t('setup_saved'))
    nav('/')
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    const id = val.trim()
    if (id) setupClientId(id)
    try {
      await refreshAccessToken()
      setTestResult('ok')
    } catch {
      setTestResult('fail')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-900">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-ink-900 dark:text-ink-50">{t('setup_title')}</h1>
            <p className="text-xs text-ink-400">{t('setup_subtitle')}</p>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="space-y-3">
          {STEPS.map((key, i) => (
            <Card key={key} className="p-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-sm font-black text-white">{i + 1}</div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink-900 dark:text-ink-100">{t(key)}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">{t(STEP_BODIES[i])}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="mt-4 p-4">
          <Field label={t('setup_clientId')}>
            <Input value={val} onChange={(e) => { setVal(e.target.value); setTestResult(null) }} placeholder={t('setup_clientIdPh')} dir="ltr" />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={save} disabled={!val.trim()}><IconCheck width={16} height={16} />{t('setup_save')}</Button>
            <Button variant="outline" onClick={test} disabled={testing || !val.trim()}>{testing ? t('common_loading') : t('setup_test')}</Button>
          </div>
          {testResult === 'ok' && <p className="mt-3 text-xs font-bold text-emerald-600">{t('setup_test_ok')}</p>}
          {testResult === 'fail' && <p className="mt-3 text-xs font-bold text-red-500">{t('setup_test_fail')}</p>}
          <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 dark:border-ink-700">
            <p className="text-xs text-ink-400">{t('misc_poweredBy')}</p>
            <Button variant="ghost" size="sm" onClick={() => nav('/')}>← {t('common_close')}</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

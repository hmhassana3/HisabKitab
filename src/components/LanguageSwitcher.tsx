import { useApp } from '../state/AppContext'
import { useI18n } from '../i18n'
import { IconGlobe } from './icons'

export function LanguageSwitcher({ light }: { light?: boolean }) {
  const { lang, setLang } = useI18n()
  const { saveSettings, getSettings } = useApp()

  const toggle = () => {
    const next = lang === 'en' ? 'ur' : 'en'
    setLang(next)
    const s = getSettings()
    saveSettings({ ...s, language: next })
  }

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
        light ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-700 dark:text-ink-200 dark:hover:bg-ink-600'
      }`}
    >
      <IconGlobe width={14} height={14} />
      {lang === 'en' ? 'اردو' : 'English'}
    </button>
  )
}

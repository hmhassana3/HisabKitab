import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react'
import en, { type TKey } from './en'
import ur from './ur'
import type { Lang } from '../types'

export type { TKey }

type Dict = Record<string, string>

const dicts: Record<Lang, Dict> = { en: en as Dict, ur }

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let s = dicts[lang]?.[key] ?? en[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return s
}

interface I18nCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKey, vars?: Record<string, string | number>) => string
  dir: 'ltr' | 'rtl'
}

const Ctx = createContext<I18nCtx | null>(null)

export function I18nProvider({ lang, onLang, children }: { lang: Lang; onLang: (l: Lang) => void; children: ReactNode }) {
  const setLang = useCallback((l: Lang) => onLang(l), [onLang])
  const t = useCallback((key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang])
  const value = useMemo<I18nCtx>(() => ({ lang, setLang, t, dir: lang === 'ur' ? 'rtl' : 'ltr' }), [lang, setLang, t])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n outside provider')
  return ctx
}

export function useT() {
  return useI18n().t
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import './index.css'
import App from './App'
import { AppProvider, useApp } from './state/AppContext'
import { I18nProvider } from './i18n'

function Root() {
  return (
    <AppProvider>
      <I18nBridge />
    </AppProvider>
  )
}

// I18nProvider takes language from AppContext (persisted in settings)
function I18nBridge() {
  const { lang, setLang } = useApp()
  return (
    <I18nProvider lang={lang} onLang={setLang}>
      <App />
    </I18nProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)

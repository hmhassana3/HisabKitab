/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GCLIENT_ID?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Google Identity Services global (loaded from accounts.google.com/gsi/client)
interface Window {
  google?: any
  __hk_token?: string | null
}

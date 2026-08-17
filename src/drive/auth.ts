// ─────────────────────────────────────────────────────────────
// Google Sign-In (Google Identity Services) + Drive API access.
// Scope "drive.file" = the app can ONLY see files it created —
// that is the security/isolation model: every user's data lives
// in their own Google Drive, inside a private "HisabKitab" folder.
// 100% free — no Firebase, no server, no paid plan.
// ─────────────────────────────────────────────────────────────

export const CLIENT_ID_KEY = 'hk_client_id'
export const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file openid email profile'

export interface GoogleUser {
  sub: string
  email: string
  name: string
  picture?: string
  accessToken: string
}

let gsiPromise: Promise<void> | null = null

function loadGIS(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.defer = true
      s.onload = () => resolve()
      s.onerror = () => {
        gsiPromise = null
        reject(new Error('GIS_LOAD_FAILED'))
      }
      document.head.appendChild(s)
    })
  }
  return gsiPromise
}

export function getClientId(): string {
  const env = import.meta.env?.VITE_GCLIENT_ID
  if (env && env.trim()) return env.trim()
  return localStorage.getItem(CLIENT_ID_KEY) || ''
}

export function setClientId(id: string): void {
  localStorage.setItem(CLIENT_ID_KEY, id.trim())
}

export function clearClientId(): void {
  localStorage.removeItem(CLIENT_ID_KEY)
}

export function hasClientId(): boolean {
  return getClientId().length > 10
}

function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodeURIComponent(escape(json)))
  } catch {
    return null
  }
}

async function fetchUserInfo(accessToken: string): Promise<{ email: string; name: string; picture?: string; sub: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo?alt=json', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('USERINFO_FAILED')
  return res.json()
}

let tokenClient: any = null

/** Full interactive sign-in: user picks Google account, we get Drive API token. */
export async function signInWithGoogle(): Promise<GoogleUser> {
  await loadGIS()
  const clientId = getClientId()
  if (!clientId) throw new Error('NO_CLIENT_ID')
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPES,
      callback: async (resp: any) => {
        try {
          if (resp?.error) throw new Error(resp.error)
          if (!resp?.access_token) throw new Error('NO_TOKEN')
          let sub = ''
          let email = resp.email || ''
          let name = resp.name || ''
          let picture = resp.picture || ''
          const payload = resp.id_token ? decodeJWT(resp.id_token) : null
          if (payload) {
            sub = String(payload.sub || '')
            email = String(payload.email || email)
            name = String(payload.name || name)
            picture = String(payload.picture || picture)
          }
          if (!sub || !email) {
            const info = await fetchUserInfo(resp.access_token)
            sub = info.sub
            email = info.email
            name = name || info.name
            picture = picture || info.picture
          }
          resolve({ sub, email, name, picture, accessToken: resp.access_token })
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)))
        }
      },
    })
    tokenClient.requestAccessToken({ prompt: 'select_account' })
  })
}

/** Silent refresh of the access token (1h lifetime). Always uses its own callback. */
export function refreshAccessToken(): Promise<string> {
  return loadGIS().then(
    () =>
      new Promise((resolve, reject) => {
        const timedOut = setTimeout(() => reject(new Error('REFRESH_TIMEOUT')), 12000)
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: getClientId(),
          scope: DRIVE_SCOPES,
          callback: (resp: any) => {
            clearTimeout(timedOut)
            if (resp?.access_token) resolve(resp.access_token)
            else reject(new Error(resp?.error || 'REFRESH_FAILED'))
          },
        })
        tokenClient.requestAccessToken({ prompt: '' })
      }),
  )
}

export function revokeToken(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const token = window.__hk_token || null
      if (token && window.google?.accounts?.oauth2?.revoke) {
        window.google.accounts.oauth2.revoke(token, () => resolve())
      } else resolve()
    } catch {
      resolve()
    }
  })
}

// The Drive client stores the live token here for reuse.
export function setLiveToken(tok: string | null): void {
  window.__hk_token = tok
}

export function getLiveToken(): string | null {
  return window.__hk_token || null
}

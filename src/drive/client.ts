// ─────────────────────────────────────────────────────────────
// Minimal Google Drive API v3 wrapper.
// Used to store HisabKitab data + photos/voice in the user's own
// Google Drive under a folder named "HisabKitab" (appProperties
// hk=1 marks it as ours).
// ─────────────────────────────────────────────────────────────
import { getLiveToken, refreshAccessToken } from './auth'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
export const APP_FOLDER = 'HisabKitab'
export const FOLDER_ID_KEY = 'hk_folder_id'

export class DriveError extends Error {
  code: number
  constructor(msg: string, code = 0) {
    super(msg)
    this.code = code
  }
}

async function rawFetch(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
  let token = getLiveToken()
  if (!token) throw new DriveError('NO_AUTH')
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
  if (res.status === 401 && !retried) {
    token = await refreshAccessToken()
    setLiveToken(token)
    return rawFetch(url, init, true)
  }
  if (res.status === 403) {
    const body = await res.clone().json().catch(() => null)
    const msg = body?.error?.message || 'PERMISSION_DENIED'
    if (String(msg).toLowerCase().includes('quota')) throw new DriveError('QUOTA_EXCEEDED', 403)
    throw new DriveError('PERMISSION_DENIED', 403)
  }
  if (res.status === 404) throw new DriveError('NOT_FOUND', 404)
  if (!res.ok) throw new DriveError(`HTTP_${res.status}`, res.status)
  return res
}

export function setLiveToken(tok: string | null): void {
  window.__hk_token = tok
}

async function apiGet(path: string, params: Record<string, string | number>, raw = false): Promise<any> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
  const res = await rawFetch(`${API}${path}${qs ? '?' + qs : ''}`)
  return raw ? res.text() : res.json()
}

async function apiDelete(path: string): Promise<void> {
  await rawFetch(`${API}${path}`, { method: 'DELETE' })
}

/** Find-or-create the HisabKitab folder (in the user's own Drive). */
export async function ensureAppFolder(): Promise<string> {
  const cached = localStorage.getItem(FOLDER_ID_KEY)

  // 1) cached folder still valid?
  if (cached) {
    try {
      const f = await apiGet(`/files/${cached}`, { fields: 'id,name,trashed,appProperties' })
      if (!f.trashed && f.name === APP_FOLDER && f.appProperties?.hk === '1') return cached
    } catch (e) {
      if (e instanceof DriveError && e.code === 404) localStorage.removeItem(FOLDER_ID_KEY)
    }
  }

  // 2) search for an existing folder named HisabKitab created by this app
  const q = `name='${APP_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const res = await apiGet('/files', { q, fields: 'files(id,name,appProperties)', pageSize: 100, spaces: 'drive' })
  for (const f of res?.files || []) {
    if (f.appProperties?.hk === '1') {
      localStorage.setItem(FOLDER_ID_KEY, f.id)
      return f.id
    }
  }

  // 3) create fresh
  const meta = { name: APP_FOLDER, mimeType: 'application/vnd.google-apps.folder', appProperties: { hk: '1' } }
  const res2 = await rawFetch(`${API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  })
  const createdFile = await res2.json()
  localStorage.setItem(FOLDER_ID_KEY, createdFile.id)
  return createdFile.id
}

function findFile(folderId: string, name: string): Promise<any> {
  const q = `'${folderId}' in parents and name='${name}' and trashed=false`
  return apiGet('/files', { q, fields: 'files(id,size)', pageSize: 10, spaces: 'drive' })
}

/** Read a JSON file from the app folder (returns null if it doesn't exist). */
export async function readJsonFile(folderId: string, name: string): Promise<any | null> {
  const res = await findFile(folderId, name)
  const f = res?.files?.[0]
  if (!f) return null
  const text = await apiGet(`/files/${f.id}`, { alt: 'media' }, true)
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function createTextFile(folderId: string, name: string, blob: Blob, mime: string): Promise<string> {
  const meta = JSON.stringify({ name, parents: [folderId], mimeType: mime, appProperties: { hk: '1' } })
  const form = new FormData()
  form.append('metadata', new Blob([meta], { type: 'application/json' }))
  form.append('file', blob)
  const res = await rawFetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', body: form })
  const data = await res.json()
  return data.id
}

async function updateFileContent(fileId: string, blob: Blob, mime: string): Promise<void> {
  const res = await rawFetch(`${UPLOAD}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': mime },
    body: blob,
  })
  await res.json()
}

/** Write (create-or-update) a JSON file atomically in the app folder. */
export async function writeJsonFile(folderId: string, name: string, obj: unknown): Promise<void> {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' })
  const res = await findFile(folderId, name)
  const existing = res?.files?.[0]
  if (existing) await updateFileContent(existing.id, blob, 'application/json')
  else await createTextFile(folderId, name, blob, 'application/json')
}

export async function deleteFileByName(folderId: string, name: string): Promise<void> {
  const res = await findFile(folderId, name)
  const f = res?.files?.[0]
  if (f) await apiDelete(`/files/${f.id}`)
}

/** Upload a binary file (photo/voice) into a subfolder of the app folder. */
export async function uploadMedia(folderId: string, subFolder: string, fileName: string, blob: Blob, mime: string): Promise<{ fileId: string; size: number }> {
  // find-or-create subfolder
  const q = `'${folderId}' in parents and name='${subFolder}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const res = await apiGet('/files', { q, fields: 'files(id)', pageSize: 10, spaces: 'drive' })
  let subId = res?.files?.[0]?.id
  if (!subId) {
    const meta = JSON.stringify({ name: subFolder, parents: [folderId], mimeType: 'application/vnd.google-apps.folder', appProperties: { hk: '1' } })
    const r = await rawFetch(`${API}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: meta })
    subId = (await r.json()).id
  }
  const meta = JSON.stringify({ name: fileName, parents: [subId], mimeType: mime, appProperties: { hk: '1' } })
  const form = new FormData()
  form.append('metadata', new Blob([meta], { type: 'application/json' }))
  form.append('file', blob)
  const r = await rawFetch(`${UPLOAD}/files?uploadType=multipart&fields=id,size`, { method: 'POST', body: form })
  const data = await r.json()
  return { fileId: data.id, size: data.size || blob.size }
}

/** Download a file's content as Blob. */
export async function downloadFileBlob(fileId: string): Promise<Blob> {
  const res = await rawFetch(`${API}/files/${fileId}?alt=media`)
  return res.blob()
}

/** Delete a file permanently. */
export async function deleteDriveFile(fileId: string): Promise<void> {
  await apiDelete(`/files/${fileId}`)
}

// ─────────────────────────────────────────────────────────────
// DriveDB — the sync engine.
//
//  • In-memory maps are the working set (single source of truth at runtime)
//  • Every mutation is also saved to an IndexedDB cache → app works offline
//  • When online, collections are flushed to Google Drive (debounced)
//  • On reconnect, queued writes are pushed; conflicts are merged by id
//    (newest updatedAt wins) — never destructive for financial records
//  • Status: synced | syncing | offline | sync_failed
// ─────────────────────────────────────────────────────────────
import type { CollectionName, DriveDBShape, FileStore } from '../types'
import { COLLECTIONS } from '../types'
import * as drive from './client'
import { idb, idbGetAll } from '../lib/idb'

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'sync_failed' | 'error'

export interface PendingOp {
  c: CollectionName
  id: string
  updatedAt: string
  op: 'upsert' | 'delete'
}

export interface DriveDBOptions {
  onStatus?: (s: SyncStatus) => void
  onError?: (msg: string) => void
  onData?: () => void
}

const MAX_AUDITS = 2500
const MAX_NOTIFS = 400

export class DriveDB {
  stores: DriveDBShape
  status: SyncStatus = 'offline'
  private dirty = new Set<CollectionName>()
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private pullTimer: ReturnType<typeof setTimeout> | null = null
  private cacheTimer: ReturnType<typeof setTimeout> | null = null
  private flushing = false
  private opts: DriveDBOptions
  private online = typeof navigator !== 'undefined' ? navigator.onLine : true
  private initialized = false

  constructor(opts: DriveDBOptions = {}) {
    this.opts = opts
    this.stores = this.emptyShape()
  }

  private emptyShape(): DriveDBShape {
    const shape = {} as DriveDBShape
    for (const c of COLLECTIONS) shape[c] = { rev: 0, items: {} } as FileStore<any>
    return shape
  }

  private setStatus(s: SyncStatus) {
    this.status = s
    this.opts.onStatus?.(s)
  }

  private setError(msg: string) {
    this.opts.onError?.(msg)
  }

  // ── boot ──────────────────────────────────────────────────
  async boot(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    // 1) hydrate from local cache immediately (fast first paint, offline-safe)
    await this.hydrateFromCache()

    window.addEventListener('online', () => {
      this.online = true
      this.setStatus('syncing')
      this.schedulePull()
      this.scheduleFlush()
    })
    window.addEventListener('offline', () => {
      this.online = false
      this.setStatus('offline')
    })

    // 2) if online, pull latest from Drive and merge (background — UI stays fast)
    if (this.online) {
      this.setStatus('syncing')
      void this.pullAll()
        .then(() => this.flushQueue())
        .then(() => {
          this.setStatus(this.online ? 'synced' : 'offline')
          void this.persistCache()
        })
        .catch((e) => {
          this.setStatus(this.online ? 'sync_failed' : 'offline')
          this.setError((e as Error).message)
        })
    } else {
      this.setStatus('offline')
    }
  }

  private async hydrateFromCache(): Promise<void> {
    for (const c of COLLECTIONS) {
      try {
        const raw = await idb.get<string>('cache', c)
        if (raw) {
          try {
            const store = JSON.parse(raw) as FileStore<any>
            this.stores[c] = store
          } catch { /* ignore corrupt cache */ }
        }
      } catch { /* IndexedDB unavailable — app still works from Drive */ }
    }
  }

  private async persistCache(c?: CollectionName): Promise<void> {
    try {
      const cols: CollectionName[] = c ? [c] : COLLECTIONS
      for (const col of cols) {
        await idb.set('cache', col, JSON.stringify(this.stores[col]))
      }
    } catch { /* non-fatal */ }
  }

  // ── pull ──────────────────────────────────────────────────
  private async pullAll(): Promise<void> {
    const folderId = await drive.ensureAppFolder()
    for (const c of COLLECTIONS) {
      const remote = await drive.readJsonFile(folderId, `${c}.json`)
      if (remote && typeof remote === 'object') this.mergeStore(c, remote)
    }
    await this.persistCache()
  }

  private schedulePull(): void {
    if (this.pullTimer) clearTimeout(this.pullTimer)
    this.pullTimer = setTimeout(() => {
      this.pullAll()
        .then(() => this.flushQueue())
        .then(() => this.setStatus(this.online ? 'synced' : 'offline'))
        .catch(() => this.setStatus(this.online ? 'sync_failed' : 'offline'))
    }, 1500)
  }

  /** Merge remote store into local, newest updatedAt wins per id. Non-destructive. */
  private mergeStore(c: CollectionName, remote: FileStore<any>): void {
    const local = this.stores[c]
    const merged: Record<string, any> = { ...local.items }
    for (const [id, val] of Object.entries(remote.items || {})) {
      const cur = merged[id]
      if (!cur) merged[id] = val
      else if (val.updatedAt && cur.updatedAt && val.updatedAt > cur.updatedAt) merged[id] = val
      else if (!cur.updatedAt && !val.updatedAt) merged[id] = val // counters etc.
    }
    this.stores[c] = { rev: Math.max(local.rev || 0, remote.rev || 0), items: merged }
    this.opts.onData?.()
  }

  // ── mutations ─────────────────────────────────────────────
  getStore<T>(c: CollectionName): Record<string, T> {
    return this.stores[c].items as Record<string, T>
  }

  upsert<T extends { id: string }>(c: CollectionName, item: T): void {
    this.stores[c].items[item.id] = item as any
    if (c === 'audits') this.trimStore(c, MAX_AUDITS, 'ts')
    if (c === 'notifications') this.trimStore(c, MAX_NOTIFS, 'createdAt')
    this.markDirty(c)
  }

  remove(c: CollectionName, id: string): void {
    delete this.stores[c].items[id]
    this.markDirty(c)
  }

  private trimStore(c: CollectionName, max: number, dateKey: string): void {
    const items = this.stores[c].items as Record<string, any>
    const entries = Object.values(items).sort((a, b) => (a[dateKey] || '').localeCompare(b[dateKey] || ''))
    if (entries.length > max) {
      const drop = new Set(entries.slice(0, entries.length - max).map((e) => e.id))
      for (const id of drop) delete items[id]
    }
  }

  setCounter(counters: any): void {
    this.stores.counters.items['main'] = { id: 'main', ...counters, updatedAt: new Date().toISOString() }
    this.markDirty('counters')
  }

  getCounters(): any {
    return this.stores.counters.items['main'] || {}
  }

  private markDirty(c: CollectionName): void {
    this.dirty.add(c)
    this.scheduleFlush()
    // keep local cache fresh so offline data survives tab close
    if (this.cacheTimer) clearTimeout(this.cacheTimer)
    this.cacheTimer = setTimeout(() => {
      void this.persistCache()
    }, 500)
  }

  // ── flush (write to Drive) ────────────────────────────────
  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => void this.flush(), 900)
  }

  private async flush(): Promise<void> {
    if (this.flushing) return
    if (!this.online) {
      this.setStatus('offline')
      return
    }
    const cols = [...this.dirty]
    if (cols.length === 0) return
    this.flushing = true
    this.setStatus('syncing')
    try {
      const folderId = await drive.ensureAppFolder()
      for (const c of cols) {
        // merge-on-write: re-read remote, merge (newest wins), bump rev, write
        const remote = await drive.readJsonFile(folderId, `${c}.json`)
        if (remote) this.mergeStore(c, remote)
        this.stores[c].rev = (this.stores[c].rev || 0) + 1
        await drive.writeJsonFile(folderId, `${c}.json`, this.stores[c])
        this.dirty.delete(c)
      }
      await this.persistCache()
      this.setStatus('synced')
    } catch (e) {
      this.setStatus(this.online ? 'sync_failed' : 'offline')
      this.setError((e as Error).message)
    } finally {
      this.flushing = false
    }
  }

  // ── offline queue ─────────────────────────────────────────
  async pushOp(op: PendingOp): Promise<void> {
    try { await idb.set('queue', `${op.id}-${Date.now()}`, JSON.stringify(op)) } catch { /* non-fatal */ }
  }

  async clearQueue(): Promise<void> {
    try { await idb.clear('queue') } catch { /* non-fatal */ }
  }

  async flushQueue(): Promise<void> {
    if (!this.online) return
    let ops: Array<{ key: string; value: PendingOp }> = []
    try { ops = await idbGetAll<PendingOp>('queue') } catch { return }
    if (ops.length === 0) return
    this.setStatus('syncing')
    try {
      const folderId = await drive.ensureAppFolder()
      for (const { value } of ops) {
        const remote = await drive.readJsonFile(folderId, `${value.c}.json`)
        if (remote) this.mergeStore(value.c, remote)
        this.stores[value.c].rev = (this.stores[value.c].rev || 0) + 1
        await drive.writeJsonFile(folderId, `${value.c}.json`, this.stores[value.c])
      }
      await idb.clear('queue')
      await this.persistCache()
      this.setStatus('synced')
    } catch (e) {
      this.setStatus(this.online ? 'sync_failed' : 'offline')
      this.setError((e as Error).message)
    }
  }

  // ── media (photos / voice) ────────────────────────────────
  async uploadMedia(subFolder: string, fileName: string, blob: Blob, mime: string): Promise<{ fileId: string; size: number }> {
    if (!this.online) throw new Error('OFFLINE_UPLOAD')
    this.setStatus('syncing')
    try {
      const folderId = await drive.ensureAppFolder()
      const r = await drive.uploadMedia(folderId, subFolder, fileName, blob, mime)
      try { await idb.set('blobs', r.fileId, blob) } catch { /* non-fatal */ }
      this.setStatus('synced')
      return r
    } catch (e) {
      this.setStatus(this.online ? 'sync_failed' : 'offline')
      throw e
    }
  }

  async getMedia(fileId: string): Promise<Blob> {
    try {
      const cached = await idb.get<Blob>('blobs', fileId)
      if (cached) return cached
    } catch { /* non-fatal */ }
    const blob = await drive.downloadFileBlob(fileId)
    try { await idb.set('blobs', fileId, blob) } catch { /* non-fatal */ }
    return blob
  }

  async deleteMedia(fileId: string): Promise<void> {
    try {
      await drive.deleteDriveFile(fileId)
    } catch { /* already gone */ }
    try { await idb.del('blobs', fileId) } catch { /* non-fatal */ }
  }

  async isOnline(): Promise<boolean> {
    if (!this.online) return false
    try {
      await drive.ensureAppFolder()
      return true
    } catch {
      return false
    }
  }
}

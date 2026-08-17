// HisabKitab ke liye GitHub-upload-ready zip banata hai.
// IMPORTANT: zip ke ANDAR koi wrapper folder nahi hota — saari files root par
// (taake GitHub "Upload files" se seedha upload ho sakein).
import { createWriteStream } from 'fs'
import { readdir } from 'fs/promises'
import { join, relative } from 'path'
import { ZipArchive } from 'archiver'

const ROOT = process.cwd()
const OUT = join(ROOT, 'hisabkitab.zip')
const EXCLUDE = new Set(['node_modules', '.git', 'dist', 'hisabkitab.zip', '.DS_Store', 'tsconfig.tsbuildinfo'])

async function collect(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (EXCLUDE.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      await collect(full, out)
    } else {
      out.push(full)
    }
  }
}

const files = []
await collect(ROOT, files)

const output = createWriteStream(OUT)
const archive = new ZipArchive()
archive.pipe(output)
for (const f of files) {
  archive.file(f, { name: relative(ROOT, f) })
}
await archive.finalize()
await new Promise((res) => output.on('close', res))
console.log(`✅ hisabkitab.zip ready (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB) — ${files.length} files, koi wrapper folder nahi.`)

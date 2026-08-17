import { build } from 'esbuild'
import { execSync } from 'child_process'
import fs from 'fs'
await build({
  entryPoints: ['scripts/smoke-test.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'scripts/smoke-test.bundle.mjs',
  logLevel: 'silent',
  jsx: 'transform',
})
try {
  execSync('node scripts/smoke-test.bundle.mjs', { stdio: 'inherit' })
} finally {
  fs.rmSync('scripts/smoke-test.bundle.mjs', { force: true })
}

// Download / share helpers

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function downloadText(text: string, filename: string, mime = 'text/plain'): void {
  downloadBlob(new Blob([text], { type: mime + ';charset=utf-8' }), filename)
}

export function downloadJSON(obj: unknown, filename: string): void {
  downloadText(JSON.stringify(obj, null, 2), filename, 'application/json')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      return true
    } catch {
      return false
    }
  }
}

export function shareText(title: string, text: string): void {
  if (navigator.share) {
    navigator.share({ title, text }).catch(() => undefined)
  } else {
    copyText(text)
  }
}

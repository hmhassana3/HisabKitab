// Receipt → PDF generation (jsPDF + html2canvas)
// The receipt is rendered as HTML first (so Urdu renders perfectly),
// then rasterized to canvas and placed into an A4 PDF.
import { jsPDF } from 'jspdf'

export async function elementToPdf(el: HTMLElement, filename: string): Promise<void> {
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  })
  const img = canvas.toDataURL('image/jpeg', 0.92)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const margin = 8
  const imgW = pageW - margin * 2
  const imgH = (canvas.height * imgW) / canvas.width

  if (imgH <= pageH - margin * 2) {
    pdf.addImage(img, 'JPEG', margin, margin, imgW, imgH)
  } else {
    // split across pages
    let y = 0
    let page = 0
    while (y < imgH) {
      if (page > 0) pdf.addPage()
      const sliceH = pageH - margin * 2
      const srcY = (y / imgH) * canvas.height
      const srcH = (sliceH / imgW) * canvas.width
      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = Math.min(srcH, canvas.height - srcY)
      const ctx = sliceCanvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height)
      }
      const sliceImg = sliceCanvas.toDataURL('image/jpeg', 0.92)
      pdf.addImage(sliceImg, 'JPEG', margin, margin, imgW, sliceH)
      y += sliceH
      page++
    }
  }
  pdf.save(filename)
}

export function printElement(el: HTMLElement): void {
  const printWindow = window.open('', '_blank', 'width=800,height=900')
  if (!printWindow) return
  const styles = Array.from(document.querySelectorAll('style,link[rel="stylesheet"]'))
    .map((s) => s.outerHTML)
    .join('\n')
  printWindow.document.write(`<!doctype html><html><head><title>Receipt</title>${styles}</head><body>${el.outerHTML}<script>window.onload=function(){window.print();window.close()}<\/script></body></html>`)
  printWindow.document.close()
}

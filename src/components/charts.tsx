// Lightweight hand-rolled SVG charts (no external chart lib needed)
import type { ReactNode } from 'react'

export interface Series {
  label: string
  values: number[]
  color: string
}

export function BarChart({ labels, series, height = 180, format }: { labels: string[]; series: Series[]; height?: number; format?: (v: number) => string }) {
  const width = 560
  const padB = 26
  const padT = 16
  const padL = 10
  const padR = 10
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const n = labels.length
  const groupW = (width - padL - padR) / Math.max(1, n)
  const barW = Math.min(26, groupW / (series.length + 0.6))
  const plotH = height - padB - padT

  const bars: ReactNode[] = []
  series.forEach((s, si) => {
    s.values.forEach((v, i) => {
      const h = (v / max) * plotH
      const x = padL + i * groupW + (groupW - barW * series.length) / 2 + si * barW
      bars.push(
        <rect key={`${si}-${i}`} x={x} y={padT + plotH - h} width={barW - 2} height={Math.max(h, v > 0 ? 2 : 0)} rx={3} fill={s.color}>
          <title>{`${s.label} ${labels[i]}: ${format ? format(v) : v}`}</title>
        </rect>,
      )
    })
  })

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[420px]" style={{ height }}>
        {bars}
        {labels.map((l, i) => (
          <text key={l + i} x={padL + i * groupW + groupW / 2} y={height - 8} textAnchor="middle" className="fill-ink-400" fontSize={10}>{l}</text>
        ))}
      </svg>
    </div>
  )
}

export function LineChart({ labels, values, color = '#059669', height = 180, format }: { labels: string[]; values: number[]; color?: string; height?: number; format?: (v: number) => string }) {
  const width = 560
  const padT = 16
  const padB = 26
  const padL = 10
  const padR = 10
  const max = Math.max(1, ...values)
  const n = Math.max(2, labels.length)
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const stepX = plotW / (n - 1)

  const pts = values.map((v, i) => ({ x: padL + i * stepX, y: padT + plotH - (v / max) * plotH }))
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area = `${path} L${pts[pts.length - 1]?.x ?? padL},${padT + plotH} L${padL},${padT + plotH} Z`

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[420px]" style={{ height }}>
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lineFill)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill={color}>
              <title>{`${labels[i]}: ${format ? format(values[i]) : values[i]}`}</title>
            </circle>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l + i} x={padL + i * stepX} y={height - 8} textAnchor="middle" className="fill-ink-400" fontSize={10}>{l}</text>
        ))}
      </svg>
    </div>
  )
}

export function Donut({ segments, size = 160 }: { segments: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  const r = 60
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="flex items-center justify-center gap-4">
      <svg width={size} height={size} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#e2e8f0" strokeWidth="20" />
        {total > 0 && segments.map((s, i) => {
          const frac = s.value / total
          const dash = frac * c
          const el = (
            <circle
              key={i}
              cx="80" cy="80" r={r} fill="none" stroke={s.color} strokeWidth="20"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform="rotate(-90 80 80)"
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          )
          offset += dash
          return el
        })}
      </svg>
      <div className="space-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-ink-500 dark:text-ink-400">{s.label}</span>
            <span className="font-bold text-ink-800 dark:text-ink-100">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

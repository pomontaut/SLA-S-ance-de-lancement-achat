import { useState } from 'react'

export interface BarDatum {
  label: string
  value: number
  sub?: string
}

const STATUS_COLORS = {
  good: '#16a34a',
  warning: '#d97706',
  critical: '#dc2626',
  neutral: '#4f46e5',
}

function colorFor(value: number, max: number): string {
  if (max <= 5) {
    if (value >= 3.5) return STATUS_COLORS.good
    if (value < 2) return STATUS_COLORS.critical
    if (value < 3) return STATUS_COLORS.warning
  }
  return STATUS_COLORS.neutral
}

export default function BarChart({ data, max, unit = '' }: { data: BarDatum[]; max?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length === 0) return <p className="text-sm text-slate-500">Aucune donnée.</p>

  const scaleMax = max ?? Math.max(...data.map((d) => d.value)) * 1.05

  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div
          key={d.label}
          className="flex items-center gap-2 text-sm"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <div className="w-40 shrink-0 truncate text-slate-600" title={d.label}>
            {d.label}
          </div>
          <div className="flex-1 bg-slate-100 rounded-full h-4 relative overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(2, (d.value / scaleMax) * 100)}%`,
                backgroundColor: colorFor(d.value, scaleMax <= 6 ? 5 : scaleMax),
                opacity: hover === null || hover === i ? 1 : 0.5,
              }}
            />
          </div>
          <div className="w-16 shrink-0 text-right text-slate-700 font-medium">
            {d.value}
            {unit}
          </div>
          {d.sub && <div className="w-20 shrink-0 text-[11px] text-slate-400">{d.sub}</div>}
        </div>
      ))}
    </div>
  )
}

import { useState } from 'react'
import type { SecteurTrendSeries } from '../data/evaluationsHistorique'
import { secteurColor } from '../data/palette'

export default function MultiLineChart({ series }: { series: SecteurTrendSeries[] }) {
  const [hover, setHover] = useState<{ s: number; i: number } | null>(null)
  const withPoints = series.filter((s) => s.points.length > 0)
  if (withPoints.length === 0) {
    return <p className="text-sm text-slate-500">Aucune donnée pour les secteurs sélectionnés.</p>
  }

  const allAnnees = Array.from(new Set(withPoints.flatMap((s) => s.points.map((p) => p.annee)))).sort((a, b) => a - b)
  const width = 720
  const height = 240
  const padding = { top: 16, right: 16, bottom: 28, left: 32 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const minNote = 0
  const maxNote = 5
  const x = (annee: number) => {
    const i = allAnnees.indexOf(annee)
    return padding.left + (allAnnees.length === 1 ? innerW / 2 : (i / (allAnnees.length - 1)) * innerW)
  }
  const y = (v: number) => padding.top + innerH - ((v - minNote) / (maxNote - minNote)) * innerH

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Évolution de la moyenne par secteur">
          {[0, 1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line x1={padding.left} x2={width - padding.right} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={padding.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8">
                {v}
              </text>
            </g>
          ))}
          {allAnnees.map((a) => (
            <text key={a} x={x(a)} y={height - 8} textAnchor="middle" fontSize={10} fill="#64748b">
              {a}
            </text>
          ))}
          {withPoints.map((s, si) => {
            const color = secteurColor(s.secteur)
            const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.annee)} ${y(p.moyenne)}`).join(' ')
            return (
              <g key={s.secteur}>
                <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={hover && hover.s !== si ? 0.25 : 1} />
                {s.points.map((p, i) => (
                  <circle
                    key={p.annee}
                    cx={x(p.annee)}
                    cy={y(p.moyenne)}
                    r={hover?.s === si && hover.i === i ? 6 : 4}
                    fill={color}
                    stroke="white"
                    strokeWidth={1.5}
                    opacity={hover && hover.s !== si ? 0.25 : 1}
                    onMouseEnter={() => setHover({ s: si, i })}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </g>
            )
          })}
        </svg>
        {hover && (
          <div
            className="absolute bg-slate-800 text-white text-xs rounded px-2 py-1 pointer-events-none -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(x(withPoints[hover.s].points[hover.i].annee) / width) * 100}%`,
              top: `${(y(withPoints[hover.s].points[hover.i].moyenne) / height) * 100}%`,
            }}
          >
            {withPoints[hover.s].secteur} · {withPoints[hover.s].points[hover.i].annee} : {withPoints[hover.s].points[hover.i].moyenne} / 5
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        {withPoints.map((s) => (
          <div key={s.secteur} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: secteurColor(s.secteur) }} />
            {s.secteur}
          </div>
        ))}
      </div>
    </div>
  )
}

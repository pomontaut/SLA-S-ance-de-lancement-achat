import { useMemo, useState } from 'react'
import type { EvalRecord } from '../data/evaluationsHistorique'
import { noteColor } from '../data/palette'

export default function RiskMatrix({ records, onSelect }: { records: EvalRecord[]; onSelect: (nom: string) => void }) {
  const points = useMemo(() => records.filter((r) => r.ca != null && r.note != null && r.ca! > 0), [records])
  const [hover, setHover] = useState<number | null>(null)

  if (points.length === 0) {
    return <p className="text-sm text-slate-500">Aucune donnée de montant disponible pour ces filtres.</p>
  }

  const width = 720
  const height = 320
  const padding = { top: 16, right: 16, bottom: 32, left: 56 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const maxCa = Math.max(...points.map((p) => p.ca!))
  const x = (ca: number) => padding.left + (Math.log10(ca + 1) / Math.log10(maxCa + 1)) * innerW
  const y = (note: number) => padding.top + innerH - (note / 5) * innerH

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Matrice risque : montant vs note">
        {[0, 1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={padding.left} x2={width - padding.right} y1={y(v)} y2={y(v)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={padding.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8">
              {v}
            </text>
          </g>
        ))}
        <line x1={padding.left} x2={width - padding.right} y1={y(3)} y2={y(3)} stroke="#fca5a5" strokeWidth={1} strokeDasharray="4 3" />
        <text x={width - padding.right} y={y(3) - 4} textAnchor="end" fontSize={9} fill="#dc2626">
          seuil note 3
        </text>
        <text x={padding.left} y={height - 4} fontSize={10} fill="#94a3b8">
          Montant (échelle log) →
        </text>
        <text x={12} y={padding.top + 8} fontSize={10} fill="#94a3b8" transform={`rotate(-90 12 ${padding.top + 8})`}>
          Note
        </text>
        {points.map((p, i) => (
          <circle
            key={`${p.nom}-${p.secteur}-${p.annee}`}
            cx={x(p.ca!)}
            cy={y(p.note!)}
            r={hover === i ? 7 : 5}
            fill={noteColor(p.note!)}
            fillOpacity={0.75}
            stroke="white"
            strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(p.nom)}
          />
        ))}
      </svg>
      {hover != null && (
        <div
          className="absolute bg-slate-800 text-white text-xs rounded px-2 py-1 pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ left: `${(x(points[hover].ca!) / width) * 100}%`, top: `${(y(points[hover].note!) / height) * 100}%` }}
        >
          {points[hover].nom} — {points[hover].note} / 5 — {points[hover].ca!.toLocaleString('fr-CH')} CHF ({points[hover].secteur} {points[hover].annee})
        </div>
      )}
      <p className="text-xs text-slate-400 mt-1">Cliquez un point pour ouvrir la fiche du fournisseur.</p>
    </div>
  )
}

// Petits graphiques SVG / CSS pour l'onglet Chantiers (sans dépendance externe).

const COULEURS = ['#4f46e5', '#0d9488', '#d97706', '#be185d', '#7c3aed', '#0ea5e9', '#84cc16', '#e11d48', '#14b8a6', '#f59e0b', '#64748b', '#a855f7']
export const couleurN = (i: number) => COULEURS[i % COULEURS.length]

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const fmtCompact = (v: number) =>
  Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString('fr-CH', { maximumFractionDigits: 1 })} M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)} k` : String(Math.round(v))

/** Histogramme groupé : une série par année, 12 mois en abscisse. */
export function MoisChart({ series, mois }: { series: { label: string; valeurs: number[] }[]; mois: string[] }) {
  const W = 860, H = 240, P = { t: 14, r: 12, b: 28, l: 52 }
  const max = Math.max(1, ...series.flatMap((s) => s.valeurs))
  const iw = W - P.l - P.r, ih = H - P.t - P.b
  const gw = iw / 12, bw = Math.max(3, (gw - 8) / Math.max(1, series.length))
  const y = (v: number) => P.t + ih - (Math.max(0, v) / max) * ih
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Dépense par mois">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(max * t)} y2={y(max * t)} stroke="#e2e8f0" />
            <text x={P.l - 6} y={y(max * t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8">
              {fmtCompact(max * t)}
            </text>
          </g>
        ))}
        {mois.map((m, i) => (
          <g key={m}>
            <text x={P.l + gw * i + gw / 2} y={H - 10} textAnchor="middle" fontSize={10} fill="#64748b">
              {m}
            </text>
            {series.map((s, k) => (
              <rect key={s.label} x={P.l + gw * i + 4 + k * bw} y={y(s.valeurs[i])} width={bw - 1} height={P.t + ih - y(s.valeurs[i])} fill={couleurN(k)} rx={1.5}>
                <title>{`${s.label} — ${m} : ${fmt(s.valeurs[i])} CHF`}</title>
              </rect>
            ))}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-3 text-xs text-slate-600 mt-1">
        {series.map((s, k) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: couleurN(k) }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Pareto : barres (montant par fournisseur, décroissant) + courbe du cumul en % + repère 80 %. */
export function ParetoChart({ valeurs, maxBarres = 80 }: { valeurs: number[]; maxBarres?: number }) {
  const n = valeurs.length
  if (n === 0) return <p className="text-sm text-slate-500">Aucune donnée.</p>
  const total = valeurs.reduce((s, v) => s + v, 0)
  const shown = valeurs.slice(0, maxBarres)
  const W = 860, H = 260, P = { t: 14, r: 44, b: 26, l: 52 }
  const iw = W - P.l - P.r, ih = H - P.t - P.b
  const max = Math.max(1, shown[0])
  const bw = iw / shown.length
  const yb = (v: number) => P.t + ih - (v / max) * ih
  const yp = (p: number) => P.t + ih - p * ih
  let cum = 0
  const pts = shown.map((v, i) => {
    cum += v
    return [P.l + bw * i + bw / 2, yp(cum / total)] as const
  })
  let c80 = 0, acc = 0
  for (const v of valeurs) { acc += v; c80++; if (acc / total >= 0.8) break }
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Pareto des fournisseurs">
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={yp(t)} y2={yp(t)} stroke={t === 0.8 ? '#f59e0b' : '#e2e8f0'} strokeDasharray={t === 0.8 ? '4 3' : undefined} />
            <text x={W - P.r + 6} y={yp(t)} dominantBaseline="middle" fontSize={10} fill={t === 0.8 ? '#d97706' : '#94a3b8'}>
              {Math.round(t * 100)} %
            </text>
          </g>
        ))}
        {[0, 0.5, 1].map((t) => (
          <text key={t} x={P.l - 6} y={yb(max * t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8">
            {fmtCompact(max * t)}
          </text>
        ))}
        {shown.map((v, i) => (
          <rect key={i} x={P.l + bw * i + 0.5} y={yb(v)} width={Math.max(1, bw - 1)} height={P.t + ih - yb(v)} fill={i < c80 ? '#4f46e5' : '#c7d2fe'}>
            <title>{`#${i + 1} : ${fmt(v)} CHF`}</title>
          </rect>
        ))}
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#dc2626" strokeWidth={2} />
        <text x={P.l} y={H - 8} fontSize={10} fill="#64748b">
          Fournisseurs classés du plus gros au plus petit{n > maxBarres ? ` (${maxBarres} premiers sur ${n})` : ''}
        </text>
      </svg>
      <p className="text-xs text-slate-600 mt-1">
        <span className="font-semibold text-indigo-600">{c80}</span> fournisseur(s) sur {n} ({Math.round((c80 / n) * 1000) / 10} %) font{' '}
        <span className="font-semibold">80 %</span> de la dépense.
      </p>
    </div>
  )
}

/** Liste de barres horizontales (libellé, barre proportionnelle, montant, %). */
export function BarresH({ lignes, couleur = '#4f46e5' }: { lignes: { label: string; valeur: number; pct?: number | null }[]; couleur?: string }) {
  const max = Math.max(1, ...lignes.map((l) => Math.abs(l.valeur)))
  return (
    <div className="space-y-1.5">
      {lignes.map((l) => (
        <div key={l.label} className="flex items-center gap-2 text-xs">
          <div className="w-44 shrink-0 truncate text-slate-600" title={l.label}>
            {l.label}
          </div>
          <div className="flex-1 bg-slate-100 rounded h-4 relative overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(Math.abs(l.valeur) / max) * 100}%`, backgroundColor: couleur }} />
          </div>
          <div className="w-28 shrink-0 text-right tabular-nums">{fmt(l.valeur)}</div>
          <div className="w-12 shrink-0 text-right text-slate-400 tabular-nums">{l.pct != null ? `${l.pct.toLocaleString('fr-CH', { maximumFractionDigits: 1 })} %` : ''}</div>
        </div>
      ))}
    </div>
  )
}

/** Anneau (répartition en %). */
export function Anneau({ tranches }: { tranches: { label: string; valeur: number }[] }) {
  const pos = tranches.filter((t) => t.valeur > 0)
  const total = pos.reduce((s, t) => s + t.valeur, 0)
  if (total <= 0) return <p className="text-sm text-slate-500">Aucune donnée.</p>
  const R = 70, r = 42, c = 90
  let a0 = -Math.PI / 2
  const arcs = pos.map((t, i) => {
    const a1 = a0 + (t.valeur / total) * Math.PI * 2
    const large = a1 - a0 > Math.PI ? 1 : 0
    const full = pos.length === 1
    const p = (rad: number, a: number) => `${c + rad * Math.cos(a)},${c + rad * Math.sin(a)}`
    const d = full
      ? `M ${c - R},${c} A ${R},${R} 0 1 1 ${c + R},${c} A ${R},${R} 0 1 1 ${c - R},${c} M ${c - r},${c} A ${r},${r} 0 1 0 ${c + r},${c} A ${r},${r} 0 1 0 ${c - r},${c}`
      : `M ${p(R, a0)} A ${R},${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r},${r} 0 ${large} 0 ${p(r, a0)} Z`
    a0 = a1
    return { d, couleur: couleurN(i), t }
  })
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 180 180" className="w-44 h-44 shrink-0" role="img" aria-label="Répartition par typologie">
        {arcs.map((a) => (
          <path key={a.t.label} d={a.d} fill={a.couleur} fillRule="evenodd">
            <title>{`${a.t.label} : ${fmt(a.t.valeur)} CHF (${Math.round((a.t.valeur / total) * 1000) / 10} %)`}</title>
          </path>
        ))}
        <text x={c} y={c - 4} textAnchor="middle" fontSize={11} fill="#64748b">
          Total
        </text>
        <text x={c} y={c + 12} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1e293b">
          {fmtCompact(total)}
        </text>
      </svg>
      <div className="text-xs space-y-1">
        {arcs.map((a) => (
          <div key={a.t.label} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: a.couleur }} />
            <span className="text-slate-600">{a.t.label}</span>
            <span className="text-slate-400">{Math.round((a.t.valeur / total) * 1000) / 10} %</span>
          </div>
        ))}
      </div>
    </div>
  )
}

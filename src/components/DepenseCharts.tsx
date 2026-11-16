// Petits graphiques SVG / CSS pour l'onglet Chantiers (sans dépendance externe).

const COULEURS = ['#4f46e5', '#0d9488', '#d97706', '#be185d', '#7c3aed', '#0ea5e9', '#84cc16', '#e11d48', '#14b8a6', '#f59e0b', '#64748b', '#a855f7']
export const couleurN = (i: number) => COULEURS[i % COULEURS.length]

const fmt = (v: number) => Math.round(v).toLocaleString('fr-CH')
const fmtCompact = (v: number) =>
  Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString('fr-CH', { maximumFractionDigits: 1 })} M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)} k` : String(Math.round(v))

/** Histogramme groupé : une série par année, 12 mois en abscisse. Cliquer une barre ou une année de la
 * légende isole cette année (zoom : barres larges avec leur montant) ; cliquer à nouveau revient à toutes. */
export function MoisChart({
  series,
  mois,
  isolee = null,
  onChoisir,
}: {
  series: { cle: string; label: string; valeurs: number[] }[]
  mois: string[]
  isolee?: string | null
  onChoisir?: (cle: string | null) => void
}) {
  const W = 860, H = 240, P = { t: 22, r: 12, b: 28, l: 52 }
  const visibles = isolee ? series.filter((x) => x.cle === isolee) : series
  const max = Math.max(1, ...visibles.flatMap((x) => x.valeurs))
  const iw = W - P.l - P.r, ih = H - P.t - P.b
  const gw = iw / 12, bw = Math.max(3, (gw - 8) / Math.max(1, visibles.length))
  const y = (v: number) => P.t + ih - (Math.max(0, v) / max) * ih
  const toggle = (cle: string) => onChoisir?.(isolee === cle ? null : cle)
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
            {visibles.map((s2, k) => {
              const idx = series.findIndex((x) => x.cle === s2.cle)
              const w = isolee ? gw - 14 : bw - 1
              const x = isolee ? P.l + gw * i + 7 : P.l + gw * i + 4 + k * bw
              return (
                <g key={s2.cle} style={{ cursor: onChoisir ? 'pointer' : undefined }} onClick={() => toggle(s2.cle)}>
                  <rect x={x} y={y(s2.valeurs[i])} width={w} height={P.t + ih - y(s2.valeurs[i])} fill={couleurN(idx)} rx={1.5}>
                    <title>{`${s2.label} — ${m} : ${fmt(s2.valeurs[i])} CHF`}</title>
                  </rect>
                  {isolee && s2.valeurs[i] > 0 && (
                    <text x={x + w / 2} y={y(s2.valeurs[i]) - 4} textAnchor="middle" fontSize={9} fill="#475569">
                      {fmtCompact(s2.valeurs[i])}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
        {series.map((s2, k) => {
          const actif = isolee === s2.cle
          return (
            <button
              key={s2.cle}
              type="button"
              disabled={!onChoisir}
              onClick={() => toggle(s2.cle)}
              title={isolee ? (actif ? 'Revenir à toutes les années' : `Voir ${s2.label}`) : `Zoomer sur ${s2.label}`}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
              style={{ borderColor: actif ? couleurN(k) : '#e2e8f0', backgroundColor: actif ? '#eef2ff' : 'white', opacity: isolee && !actif ? 0.5 : 1 }}
            >
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: couleurN(k) }} />
              {s2.label}
            </button>
          )
        })}
        {isolee && (
          <button type="button" className="text-indigo-600 hover:underline" onClick={() => onChoisir?.(null)}>
            Toutes les années
          </button>
        )}
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

/** Camembert. En mode Pareto (par défaut) on garde les plus gros éléments jusqu'à 80 % du total et on
 * regroupe le reste dans « Autres ». */
export function Camembert({
  lignes,
  pareto = true,
  seuil = 0.8,
  unite = 'CHF',
}: {
  lignes: { label: string; valeur: number }[]
  pareto?: boolean
  seuil?: number
  unite?: string
}) {
  const pos = lignes.filter((l) => l.valeur > 0).sort((a, b) => b.valeur - a.valeur)
  const total = pos.reduce((t, l) => t + l.valeur, 0)
  if (total <= 0) return <p className="text-sm text-slate-500">Aucune donnée.</p>
  let tranches = pos
  if (pareto) {
    let cum = 0
    let n = 0
    for (const l of pos) {
      cum += l.valeur
      n++
      if (cum / total >= seuil) break
    }
    const reste = pos.slice(n)
    tranches = reste.length >= 2 ? [...pos.slice(0, n), { label: `Autres (${reste.length})`, valeur: reste.reduce((t, l) => t + l.valeur, 0) }] : pos
  }
  const R = 80, c = 90
  let a0 = -Math.PI / 2
  const arcs = tranches.map((t, i) => {
    const part = t.valeur / total
    const a1 = a0 + part * Math.PI * 2
    const large = a1 - a0 > Math.PI ? 1 : 0
    const pt = (rad: number, a: number) => `${c + rad * Math.cos(a)},${c + rad * Math.sin(a)}`
    const d = tranches.length === 1 ? `M ${c - R},${c} A ${R},${R} 0 1 1 ${c + R},${c} A ${R},${R} 0 1 1 ${c - R},${c} Z` : `M ${c},${c} L ${pt(R, a0)} A ${R},${R} 0 ${large} 1 ${pt(R, a1)} Z`
    const am = (a0 + a1) / 2
    a0 = a1
    const autres = t.label.startsWith('Autres (')
    return { d, t, part, couleur: autres ? '#94a3b8' : couleurN(i), lx: c + R * 0.62 * Math.cos(am), ly: c + R * 0.62 * Math.sin(am) }
  })
  return (
    <div className="flex flex-wrap items-start gap-5">
      <svg viewBox="0 0 180 180" className="w-52 h-52 shrink-0" role="img" aria-label="Répartition">
        {arcs.map((a) => (
          <path key={a.t.label} d={a.d} fill={a.couleur} stroke="white" strokeWidth={1}>
            <title>{`${a.t.label} : ${fmt(a.t.valeur)} ${unite} (${Math.round(a.part * 1000) / 10} %)`}</title>
          </path>
        ))}
        {arcs.filter((a) => a.part >= 0.07).map((a) => (
          <text key={a.t.label} x={a.lx} y={a.ly} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight={600} fill="white">
            {Math.round(a.part * 100)} %
          </text>
        ))}
      </svg>
      <div className="text-xs space-y-1 min-w-[220px] flex-1">
        {arcs.map((a) => (
          <div key={a.t.label} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: a.couleur }} />
            <span className="text-slate-700 truncate" title={a.t.label}>
              {a.t.label}
            </span>
            <span className="ml-auto text-slate-500 tabular-nums whitespace-nowrap">
              {fmt(a.t.valeur)} · {Math.round(a.part * 1000) / 10} %
            </span>
          </div>
        ))}
        {pareto && <div className="text-[10px] text-slate-400 pt-1">Mode Pareto : les éléments qui font 80 % du total, le reste regroupé en « Autres ».</div>}
      </div>
    </div>
  )
}

/** Évolution annuelle (barres + courbe). Pour l'année partielle : « x % de N-1 », rouge si < 100 %. */
export function EvolutionChart({ points }: { points: { annee: string; valeur: number; partielle: boolean }[] }) {
  if (points.length === 0) return <p className="text-sm text-slate-500">Aucune donnée.</p>
  const W = 640, H = 260, P = { t: 52, r: 16, b: 34, l: 52 }
  const iw = W - P.l - P.r, ih = H - P.t - P.b
  const max = Math.max(1, ...points.map((p) => p.valeur))
  const gw = iw / points.length
  const bw = Math.min(70, gw - 18)
  const y = (v: number) => P.t + ih - (Math.max(0, v) / max) * ih
  const cx = (i: number) => P.l + gw * i + gw / 2
  const ligne = points.map((p, i) => `${cx(i)},${y(p.valeur)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-w-2xl" role="img" aria-label="Évolution annuelle">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(max * t)} y2={y(max * t)} stroke="#e2e8f0" />
          <text x={P.l - 6} y={y(max * t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8">
            {fmtCompact(max * t)}
          </text>
        </g>
      ))}
      <polyline points={ligne} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" />
      {points.map((p, i) => (
        <circle key={p.annee} cx={cx(i)} cy={y(p.valeur)} r={3.5} fill="#f59e0b" />
      ))}
      {points.map((p, i) => {
        const prev = i > 0 ? points[i - 1].valeur : null
        const pctPrev = prev && prev > 0 ? (p.valeur / prev) * 100 : null
        // année complète : variation vs N-1 ; année partielle : part déjà réalisée de N-1
        const texte = pctPrev == null ? '' : p.partielle ? `${Math.round(pctPrev)} % de ${points[i - 1].annee}` : `${pctPrev >= 100 ? '+' : '−'}${Math.abs(Math.round(pctPrev - 100))} %`
        const couleur = pctPrev == null ? '#94a3b8' : pctPrev >= 100 ? '#16a34a' : '#dc2626'
        return (
          <g key={p.annee}>
            <rect x={cx(i) - bw / 2} y={y(p.valeur)} width={bw} height={P.t + ih - y(p.valeur)} fill={p.partielle ? '#a5b4fc' : '#4f46e5'} rx={2}>
              <title>{`${p.annee}${p.partielle ? ' (partielle)' : ''} : ${fmt(p.valeur)} CHF HT`}</title>
            </rect>
            <text x={cx(i)} y={y(p.valeur) - 28} textAnchor="middle" fontSize={11} fontWeight={600} fill="#1e293b">
              {fmtCompact(p.valeur)}
            </text>
            <text x={cx(i)} y={y(p.valeur) - 14} textAnchor="middle" fontSize={10} fontWeight={600} fill={couleur}>
              {texte}
            </text>
            <text x={cx(i)} y={H - 12} textAnchor="middle" fontSize={11} fill="#475569">
              {p.annee}
              {p.partielle ? ' (partielle)' : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Cumul mensuel de plusieurs années (une courbe par année) : « où en est-on par rapport aux années précédentes ». */
export function CumulChart({ series, mois }: { series: { label: string; valeurs: (number | null)[]; couleur?: string }[]; mois: string[] }) {
  const W = 760, H = 250, P = { t: 16, r: 70, b: 28, l: 56 }
  const iw = W - P.l - P.r, ih = H - P.t - P.b
  const max = Math.max(1, ...series.flatMap((s2) => s2.valeurs.filter((v): v is number => v != null)))
  const x = (i: number) => P.l + (i / 11) * iw
  const y = (v: number) => P.t + ih - (v / max) * ih
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Cumul mensuel">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(max * t)} y2={y(max * t)} stroke="#e2e8f0" />
            <text x={P.l - 6} y={y(max * t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8">
              {fmtCompact(max * t)}
            </text>
          </g>
        ))}
        {mois.map((m, i) => (
          <text key={m} x={x(i)} y={H - 10} textAnchor="middle" fontSize={10} fill="#64748b">
            {m}
          </text>
        ))}
        {series.map((s2, k) => {
          const couleur = s2.couleur ?? couleurN(k)
          const pts = s2.valeurs.map((v, i) => (v == null ? null : ([x(i), y(v)] as const)))
          const reels = pts.filter((p): p is readonly [number, number] => p != null)
          const dernier = reels[reels.length - 1]
          const dv = [...s2.valeurs].reverse().find((v) => v != null)
          return (
            <g key={s2.label}>
              <polyline points={reels.map((p) => p.join(',')).join(' ')} fill="none" stroke={couleur} strokeWidth={k === 0 ? 3 : 2} strokeDasharray={k === 0 ? undefined : '5 3'} />
              {dernier && (
                <>
                  <circle cx={dernier[0]} cy={dernier[1]} r={4} fill={couleur} />
                  <text x={dernier[0] + 6} y={dernier[1] + 3} fontSize={10} fontWeight={600} fill={couleur}>
                    {fmtCompact(dv ?? 0)}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-3 text-xs text-slate-600 mt-1">
        {series.map((s2, k) => (
          <span key={s2.label} className="inline-flex items-center gap-1">
            <span className="inline-block w-4 h-0.5" style={{ backgroundColor: s2.couleur ?? couleurN(k) }} />
            {s2.label}
          </span>
        ))}
      </div>
    </div>
  )
}

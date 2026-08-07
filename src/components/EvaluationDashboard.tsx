import { useEffect, useMemo, useState } from 'react'
import type { EvalRecord, SecteurKpis, SecteurStat } from '../data/evaluationsHistorique'
import {
  SECTEURS,
  anneesDisponibles,
  computeKpis,
  critereMoyennes,
  familleBreakdown,
  findSecteurStat,
  loadEvaluationsHistorique,
  loadSecteurStats,
  trendParAnnee,
} from '../data/evaluationsHistorique'
import BarChart from './BarChart'
import SecteurComparison from './SecteurComparison'

function formatCurrency(value: number | null): string {
  if (value == null) return 'Non disponible'
  return value.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
}

function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'warning' | 'critical'
}) {
  const toneClass = tone === 'good' ? 'text-green-600' : tone === 'warning' ? 'text-amber-600' : tone === 'critical' ? 'text-red-600' : 'text-indigo-600'
  const isFallback = value === 'Non disponible'
  return (
    <div className="card text-center py-4">
      <div className={isFallback ? 'text-sm font-medium text-slate-400' : `text-2xl font-bold ${toneClass}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function TrendChart({ data }: { data: { annee: number; moyenne: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length < 2) {
    return <p className="text-sm text-slate-500">Pas assez d'années disponibles pour tracer une évolution.</p>
  }

  const width = 640
  const height = 200
  const padding = { top: 16, right: 16, bottom: 28, left: 32 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const minNote = 0
  const maxNote = 5
  const x = (i: number) => padding.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const y = (v: number) => padding.top + innerH - ((v - minNote) / (maxNote - minNote)) * innerH

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.moyenne)}`).join(' ')

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Évolution de la moyenne d'évaluation par année">
        {[0, 1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={padding.left} x2={width - padding.right} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={padding.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8">
              {v}
            </text>
          </g>
        ))}
        <path d={pathD} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={d.annee}>
            <circle
              cx={x(i)}
              cy={y(d.moyenne)}
              r={hover === i ? 6 : 4}
              fill="#4f46e5"
              stroke="white"
              strokeWidth={1.5}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            />
            <text x={x(i)} y={height - 8} textAnchor="middle" fontSize={10} fill="#64748b">
              {d.annee}
            </text>
          </g>
        ))}
      </svg>
      {hover != null && (
        <div
          className="absolute bg-slate-800 text-white text-xs rounded px-2 py-1 pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ left: `${(x(hover) / width) * 100}%`, top: `${(y(data[hover].moyenne) / height) * 100}%` }}
        >
          {data[hover].annee} : {data[hover].moyenne} / 5
        </div>
      )}
    </div>
  )
}

export default function EvaluationDashboard() {
  const [all, setAll] = useState<EvalRecord[] | null>(null)
  const [secteurStats, setSecteurStats] = useState<SecteurStat[]>([])
  const [secteur, setSecteur] = useState<string>('GC')
  const [annee, setAnnee] = useState<number | null>(null)
  const [view, setView] = useState<'secteur' | 'comparaison'>('secteur')

  useEffect(() => {
    loadEvaluationsHistorique().then(setAll)
    loadSecteurStats().then(setSecteurStats)
  }, [])

  const annees = useMemo(() => (all ? anneesDisponibles(all, secteur) : []), [all, secteur])

  useEffect(() => {
    if (annees.length > 0 && (annee == null || !annees.includes(annee))) {
      setAnnee(annees[0])
    }
  }, [annees, annee])

  const kpis: SecteurKpis | null = useMemo(() => {
    if (!all || annee == null) return null
    return computeKpis(all, secteur, annee)
  }, [all, secteur, annee])

  const trend = useMemo(() => (all ? trendParAnnee(all, secteur) : []), [all, secteur])

  const currentRows = useMemo(() => {
    if (!all || annee == null) return []
    return all
      .filter((r) => r.secteur === secteur && r.annee === annee && r.note != null)
      .sort((a, b) => (b.ca ?? -1) - (a.ca ?? -1) || (b.note ?? 0) - (a.note ?? 0))
  }, [all, secteur, annee])

  const critereData = useMemo(() => critereMoyennes(currentRows), [currentRows])
  const familleData = useMemo(() => familleBreakdown(currentRows), [currentRows])
  const stat = useMemo(() => (annee != null ? findSecteurStat(secteurStats, secteur, annee) : null), [secteurStats, secteur, annee])

  if (!all) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-slate-500">Chargement des données d'évaluation…</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Dashboard évaluation fournisseurs</h2>
        <p className="text-sm text-slate-500 mt-1">
          Basé sur l'historique 2007-2025 fourni (import statique). La richesse des données (chiffre d'affaires,
          nombre d'évaluateurs) varie selon les secteurs et les années : les indicateurs non calculables affichent
          « Non disponible » plutôt qu'une estimation.
        </p>
      </div>

      <div className="flex gap-1">
        <button className={view === 'secteur' ? 'btn-primary' : 'btn-secondary'} onClick={() => setView('secteur')}>
          Vue par secteur
        </button>
        <button className={view === 'comparaison' ? 'btn-primary' : 'btn-secondary'} onClick={() => setView('comparaison')}>
          Comparaison secteurs
        </button>
      </div>

      {view === 'comparaison' ? (
        annee != null && <SecteurComparison all={all} secteurStats={secteurStats} annee={annee} />
      ) : (
        <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {SECTEURS.map((s) => (
            <button
              key={s}
              className={s === secteur ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setSecteur(s)}
            >
              {s}
            </button>
          ))}
        </div>
        {annees.length > 0 && (
          <select className="input w-32" value={annee ?? ''} onChange={(e) => setAnnee(Number(e.target.value))}>
            {annees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
      </div>

      {!kpis || kpis.fournisseursEvalues === 0 ? (
        <p className="text-sm text-slate-500">Aucune donnée pour ce secteur / cette année.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Fournisseurs évalués" value={String(kpis.fournisseursEvalues)} />
            <StatTile
              label={`Moyenne globale ${kpis.annee}`}
              value={kpis.moyenneGlobale != null ? `${kpis.moyenneGlobale} / 5` : '—'}
              sub={kpis.evolution != null ? `${kpis.evolution >= 0 ? '+' : ''}${kpis.evolution} pt vs ${kpis.annee - 1}` : undefined}
            />
            <StatTile label="Périmètre évalué" value={formatCurrency(kpis.perimetreEvalue)} />
            <StatTile
              label="Top 10 (montant)"
              value={formatCurrency(kpis.top10Montant)}
              sub={kpis.top10PctPerimetre != null ? `${kpis.top10PctPerimetre}% du périmètre` : undefined}
            />
            <StatTile label="Fournisseurs ≥ 3,5" value={String(kpis.excellents)} tone="good" />
            <StatTile label="Fournisseurs < 3" value={String(kpis.faibles)} tone="warning" />
            <StatTile label="dont < 2" value={String(kpis.tresFaibles)} tone="critical" />
            <StatTile label="À une seule évaluation" value={String(kpis.uneEvaluation)} />
            <StatTile label="Non évalués l'année précédente" value={String(kpis.nonEvaluesAnneePrecedente)} />
            <StatTile label="Jamais évalués avant" value={String(kpis.jamaisEvaluesAvant)} />
            <StatTile
              label="Fournisseurs communs (iso-périmètre)"
              value={String(kpis.fournisseursCommuns)}
              sub={
                kpis.moyenneIsoPerimetre != null
                  ? `Moyenne iso-périmètre : ${kpis.moyenneIsoPerimetre} / 5${kpis.evolutionIsoPerimetre != null ? ` (${kpis.evolutionIsoPerimetre >= 0 ? '+' : ''}${kpis.evolutionIsoPerimetre} pt)` : ''}`
                  : undefined
              }
            />
            <StatTile
              label="Nombre d'évaluateurs"
              value={stat?.nbEvaluateurs != null ? String(stat.nbEvaluateurs) : 'Non disponible'}
              sub={kpis.moyenneNbEvaluateurs != null ? `Moyenne ${kpis.moyenneNbEvaluateurs} / fournisseur` : undefined}
            />
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">Évolution de la moyenne — {secteur}</h3>
            <TrendChart data={trend} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold mb-3">
                Moyenne par critère — {secteur} {annee}
              </h3>
              {critereData.length > 0 ? (
                <BarChart data={critereData.map((c) => ({ label: c.label, value: c.moyenne, sub: `${c.nbFournisseurs} fournisseurs` }))} max={5} />
              ) : (
                <p className="text-sm text-slate-500">
                  Détail par critère non disponible pour ce secteur/année (seuls GC 2025 et BAT GE 2025 en disposent
                  actuellement).
                </p>
              )}
            </div>
            <div className="card">
              <h3 className="font-semibold mb-3">
                Moyenne par famille / segment — {secteur} {annee}
              </h3>
              {familleData.length > 0 && familleData.some((f) => f.famille) ? (
                <BarChart
                  data={familleData
                    .filter((f) => f.famille)
                    .map((f) => ({ label: f.famille, value: f.moyenne, sub: `${f.count} fournisseurs` }))}
                  max={5}
                />
              ) : (
                <p className="text-sm text-slate-500">Pas de catégorisation par famille disponible pour ce secteur/année.</p>
              )}
            </div>
          </div>

          {kpis.top10.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-3">Top 10 fournisseurs par montant — {secteur} {annee}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-2">Fournisseur</th>
                      <th className="py-2 pr-2">Montant</th>
                      <th className="py-2 pr-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.top10.map((r) => (
                      <tr key={r.nom} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2 font-medium">{r.nom}</td>
                        <td className="py-1.5 pr-2">{formatCurrency(r.ca)}</td>
                        <td className="py-1.5 pr-2">{r.note} / 5</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold mb-3">
              Détail — {secteur} {annee} ({currentRows.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-2">Fournisseur</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Montant</th>
                    <th className="py-2 pr-2">Note</th>
                    <th className="py-2 pr-2">Nb évaluateurs</th>
                    <th className="py-2 pr-2">Remarques</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.map((r) => (
                    <tr key={r.nom} className="border-b border-slate-100 align-top">
                      <td className="py-1.5 pr-2 font-medium">{r.nom}</td>
                      <td className="py-1.5 pr-2 text-slate-500">{r.type}</td>
                      <td className="py-1.5 pr-2">{formatCurrency(r.ca)}</td>
                      <td className="py-1.5 pr-2">
                        <span
                          className={
                            r.note! >= 3.5
                              ? 'text-green-600 font-medium'
                              : r.note! < 2
                                ? 'text-red-600 font-medium'
                                : r.note! < 3
                                  ? 'text-amber-600 font-medium'
                                  : ''
                          }
                        >
                          {r.note} / 5
                        </span>
                      </td>
                      <td className="py-1.5 pr-2">{r.nbEvaluateurs ?? '—'}</td>
                      <td className="py-1.5 pr-2 text-slate-500 max-w-xs truncate" title={r.remarques}>
                        {r.remarques}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
        </>
      )}
    </div>
  )
}

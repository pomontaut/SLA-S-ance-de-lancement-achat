import { useMemo } from 'react'
import type { EvalRecord, GlobalFilters, SecteurStat } from '../data/evaluationsHistorique'
import {
  SECTEURS,
  applyFilters,
  distinctCfc,
  distinctTypes,
  multiSecteurTrend,
  montantDistribution,
  noteDistribution,
} from '../data/evaluationsHistorique'
import OverviewHeader from './OverviewHeader'
import MultiLineChart from './MultiLineChart'
import Histogram from './Histogram'
import RiskMatrix from './RiskMatrix'
import BarChart from './BarChart'
import { familleBreakdown, critereMoyennes } from '../data/evaluationsHistorique'

function formatCurrency(v: number | null): string {
  return v == null ? 'Non disponible' : v.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
}

export default function OverviewTab({
  all,
  filters,
  onFiltersChange,
  onZoom,
}: {
  all: EvalRecord[]
  filters: GlobalFilters
  onFiltersChange: (f: GlobalFilters) => void
  onZoom: (nom: string) => void
}) {
  const types = useMemo(() => distinctTypes(all), [all])
  const anneeBounds = useMemo((): [number, number] => {
    const annees = all.map((r) => r.annee)
    return [Math.min(...annees), Math.max(...annees)]
  }, [all])

  const filtered = useMemo(() => applyFilters(all, filters), [all, filters])
  const secteursForTrend = filters.secteurs.length > 0 ? filters.secteurs : [...SECTEURS]
  const trend = useMemo(() => multiSecteurTrend(all, secteursForTrend), [all, secteursForTrend])
  const distribution = useMemo(() => noteDistribution(filtered), [filtered])
  const montantDist = useMemo(() => montantDistribution(filtered), [filtered])
  const famille = useMemo(() => familleBreakdown(filtered).slice(0, 12), [filtered])
  const criteres = useMemo(() => critereMoyennes(filtered), [filtered])
  const supplierNames = useMemo(() => Array.from(new Set(all.map((r) => r.nom))).sort((a, b) => a.localeCompare(b)), [all])
  const cfcList = useMemo(() => distinctCfc(all), [all])

  // Points d'attention : année de fin de période, hors filtre de période pour pouvoir comparer à N-1.
  const attention = useMemo(() => {
    const an = filters.anneeMax
    const sansPeriode = applyFilters(all, { ...filters, anneeMin: an - 1, anneeMax: an })
    const cle = (r: EvalRecord) => `${r.nom.toLowerCase()}|${r.secteur}`
    const prev = new Map(sansPeriode.filter((r) => r.annee === an - 1).map((r) => [cle(r), r.note!]))
    const cur = sansPeriode.filter((r) => r.annee === an)
    const lignes = cur.map((r) => ({ r, delta: prev.has(cle(r)) ? r.note! - prev.get(cle(r))! : null }))
    const prioritaires = lignes.filter((l) => l.r.note! < 3).sort((a, b) => (b.r.ca ?? 0) - (a.r.ca ?? 0)).slice(0, 8)
    const baisses = lignes.filter((l) => l.delta != null && l.delta <= -0.3).sort((a, b) => a.delta! - b.delta!).slice(0, 8)
    const hausses = lignes.filter((l) => l.delta != null && l.delta >= 0.3).sort((a, b) => b.delta! - a.delta!).slice(0, 8)
    return { an, prioritaires, baisses, hausses }
  }, [all, filters])

  return (
    <div className="space-y-4">
      <OverviewHeader
        all={all}
        filters={filters}
        onChange={onFiltersChange}
        types={types}
        supplierNames={supplierNames}
        cfcList={cfcList}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AttentionTable
          titre={`Fournisseurs à traiter en priorité — ${attention.an}`}
          sous="Note inférieure à 3, classés par montant (CA)."
          lignes={attention.prioritaires}
          onZoom={onZoom}
          vide="Aucun fournisseur sous 3 sur ce périmètre."
        />
        <AttentionTable
          titre={`Plus fortes baisses de note — ${attention.an}`}
          sous={`Baisse d'au moins 0,3 point par rapport à ${attention.an - 1}.`}
          lignes={attention.baisses}
          onZoom={onZoom}
          vide="Aucune baisse notable."
        />
        <AttentionTable
          titre={`Plus fortes hausses de note — ${attention.an}`}
          sous={`Hausse d'au moins 0,3 point par rapport à ${attention.an - 1}.`}
          lignes={attention.hausses}
          onZoom={onZoom}
          vide="Aucune hausse notable."
        />
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">Évolution comparée par secteur</h3>
        <MultiLineChart series={trend} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold mb-3">Distribution des notes</h3>
          <Histogram data={distribution} />
        </div>
        <div className="card">
          <h3 className="font-semibold mb-1">Distribution des montants</h3>
          <p className="text-xs text-slate-500 mb-3">Même tranches de note, mais pondérées par le CA plutôt que par le nombre de fournisseurs.</p>
          <Histogram data={montantDist} formatValue={(v) => formatCurrency(v)} />
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">Moyenne par type de fournisseur</h3>
        {famille.length > 0 ? (
          <BarChart data={famille.map((f) => ({ label: f.famille, value: f.moyenne, sub: `${f.count} éval.` }))} max={5} />
        ) : (
          <p className="text-sm text-slate-500">Aucune donnée.</p>
        )}
      </div>

      {/* Moyenne par critère : uniquement quand on filtre par type ou par fournisseur. */}
      {(filters.types.length > 0 || filters.search.trim() !== '') && (
        <div className="card">
          <h3 className="font-semibold mb-3">
            Moyenne par critère
            {filters.types.length > 0 ? ` — ${filters.types.join(', ')}` : ''}
            {filters.search.trim() ? ` — ${filters.search.trim()}` : ''}
          </h3>
          {criteres.length > 0 ? (
            <BarChart
              data={criteres.map((c) => ({ label: c.label, value: c.moyenne, sub: `${c.nbFournisseurs} note(s)` }))}
              max={5}
            />
          ) : (
            <p className="text-sm text-slate-500">Aucun détail par critère disponible pour ces filtres.</p>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold mb-1">Matrice risque — montant vs performance</h3>
        <p className="text-xs text-slate-500 mb-3">
          Chaque point est une évaluation (fournisseur × année). En haut à droite : gros volumes bien notés (partenaires
          stratégiques). En bas à droite : gros volumes mal notés (risque prioritaire).
        </p>
        <RiskMatrix records={filtered} onSelect={onZoom} />
      </div>
    </div>
  )
}

const fmt2 = (v: number) => v.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function AttentionTable({
  titre,
  sous,
  lignes,
  onZoom,
  vide,
}: {
  titre: string
  sous: string
  lignes: { r: EvalRecord; delta: number | null }[]
  onZoom: (nom: string) => void
  vide: string
}) {
  return (
    <div className="card">
      <h3 className="font-semibold">{titre}</h3>
      <p className="text-xs text-slate-500 mb-2">{sous}</p>
      {lignes.length === 0 ? (
        <p className="text-sm text-slate-500">{vide}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {lignes.map(({ r, delta }) => (
              <tr key={`${r.nom}|${r.secteur}`} className="border-b border-slate-100">
                <td className="py-1.5 pr-2">
                  <button className="text-left hover:text-indigo-600 hover:underline" onClick={() => onZoom(r.nom)}>
                    {r.nom}
                  </button>
                  <div className="text-[11px] text-slate-400">
                    {r.secteur}
                    {r.ca != null ? ` · ${formatCurrency(r.ca)}` : ''}
                  </div>
                </td>
                <td className="py-1.5 text-right tabular-nums font-semibold" style={{ color: r.note! < 2 ? '#b91c1c' : r.note! < 3 ? '#c2410c' : r.note! >= 3.5 ? '#15803d' : '#475569' }}>
                  {fmt2(r.note!)}
                </td>
                <td className="py-1.5 pl-2 text-right tabular-nums text-xs w-14" style={{ color: delta == null ? '#94a3b8' : delta < 0 ? '#b91c1c' : '#15803d' }}>
                  {delta == null ? '—' : `${delta > 0 ? '+' : ''}${fmt2(delta)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

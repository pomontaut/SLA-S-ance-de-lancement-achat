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
        <h3 className="font-semibold mb-3">Moyenne par famille / segment (top 12)</h3>
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

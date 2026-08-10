import { useMemo, useState } from 'react'
import type { EvalRecord, GlobalFilters, SecteurStat } from '../data/evaluationsHistorique'
import {
  SECTEURS,
  applyFilters,
  distinctTypes,
  globalKpis,
  multiSecteurTrend,
  noteDistribution,
} from '../data/evaluationsHistorique'
import FilterBar from './FilterBar'
import MultiLineChart from './MultiLineChart'
import Histogram from './Histogram'
import RiskMatrix from './RiskMatrix'
import BarChart from './BarChart'
import SupplierZoom from './SupplierZoom'
import { familleBreakdown } from '../data/evaluationsHistorique'

function formatCurrency(v: number | null): string {
  return v == null ? 'Non disponible' : v.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card text-center py-4">
      <div className="text-2xl font-bold text-indigo-600">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function OverviewTab({
  all,
  filters,
  onFiltersChange,
}: {
  all: EvalRecord[]
  filters: GlobalFilters
  onFiltersChange: (f: GlobalFilters) => void
}) {
  const [zoomNom, setZoomNom] = useState<string | null>(null)
  const types = useMemo(() => distinctTypes(all), [all])
  const anneeBounds = useMemo((): [number, number] => {
    const annees = all.map((r) => r.annee)
    return [Math.min(...annees), Math.max(...annees)]
  }, [all])

  const filtered = useMemo(() => applyFilters(all, filters), [all, filters])
  const kpis = useMemo(() => globalKpis(filtered), [filtered])
  const secteursForTrend = filters.secteurs.length > 0 ? filters.secteurs : [...SECTEURS]
  const trend = useMemo(() => multiSecteurTrend(all, secteursForTrend), [all, secteursForTrend])
  const distribution = useMemo(() => noteDistribution(filtered), [filtered])
  const famille = useMemo(() => familleBreakdown(filtered).slice(0, 12), [filtered])

  return (
    <div className="space-y-4">
      <FilterBar filters={filters} onChange={onFiltersChange} types={types} anneeBounds={anneeBounds} />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatTile label="Fournisseurs évalués" value={String(kpis.fournisseursEvalues)} />
        <StatTile label="Évaluations" value={String(kpis.evaluationsTotal)} />
        <StatTile label="Moyenne globale" value={kpis.moyenneGlobale != null ? `${kpis.moyenneGlobale} / 5` : '—'} />
        <StatTile label="Périmètre (montants connus)" value={formatCurrency(kpis.perimetreEvalue)} />
        <StatTile label="Secteurs / années couverts" value={`${kpis.secteursCouverts} / ${kpis.anneesCouvertes}`} />
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
          <h3 className="font-semibold mb-3">Moyenne par famille / segment (top 12)</h3>
          {famille.length > 0 ? (
            <BarChart data={famille.map((f) => ({ label: f.famille, value: f.moyenne, sub: `${f.count} éval.` }))} max={5} />
          ) : (
            <p className="text-sm text-slate-500">Aucune donnée.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-1">Matrice risque — montant vs performance</h3>
        <p className="text-xs text-slate-500 mb-3">
          Chaque point est une évaluation (fournisseur × année). En haut à droite : gros volumes bien notés (partenaires
          stratégiques). En bas à droite : gros volumes mal notés (risque prioritaire).
        </p>
        <RiskMatrix records={filtered} onSelect={setZoomNom} />
      </div>

      {zoomNom && <SupplierZoom all={all} initialNom={zoomNom} onClose={() => setZoomNom(null)} />}
    </div>
  )
}

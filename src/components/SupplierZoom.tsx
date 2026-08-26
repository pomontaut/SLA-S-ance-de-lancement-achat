import { useEffect, useMemo, useState } from 'react'
import type { EvalRecord } from '../data/evaluationsHistorique'
import { listSuppliers, supplierHistory } from '../data/evaluationsHistorique'
import { secteurColor, noteColor } from '../data/palette'
import BarChart from './BarChart'

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function formatCurrency(v: number | null): string {
  return v == null ? '—' : v.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
}

function MiniTrend({ history }: { history: EvalRecord[] }) {
  const points = [...history].sort((a, b) => a.annee - b.annee)
  if (points.length < 2) return null
  const width = 500
  const height = 120
  const pad = { top: 10, right: 10, bottom: 20, left: 24 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const x = (i: number) => pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => pad.top + innerH - (v / 5) * innerH
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.note!)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[0, 2.5, 5].map((v) => (
        <line key={v} x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
      ))}
      <path d={d} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinecap="round" />
      {points.map((p, i) => {
        // Plusieurs points peuvent partager la même année (un fournisseur évalué dans
        // plusieurs secteurs la même année) : n'afficher l'étiquette qu'une fois par
        // année, sinon les libellés se chevauchent et deviennent illisibles.
        const showLabel = i === 0 || points[i - 1].annee !== p.annee
        return (
          <g key={`${p.secteur}-${p.annee}-${i}`}>
            <circle cx={x(i)} cy={y(p.note!)} r={4} fill={secteurColor(p.secteur)} stroke="white" strokeWidth={1} />
            {showLabel && (
              <text x={x(i)} y={height - 4} textAnchor="middle" fontSize={11} fontWeight={500} fill="#334155">
                {p.annee}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default function SupplierZoom({ all, initialNom, onClose }: { all: EvalRecord[]; initialNom?: string; onClose: () => void }) {
  const suppliers = useMemo(() => listSuppliers(all), [all])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(initialNom ?? null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return suppliers.slice(0, 30)
    return suppliers.filter((s) => s.nom.toLowerCase().includes(q)).slice(0, 30)
  }, [suppliers, query])

  const history = useMemo(() => (selected ? supplierHistory(all, selected) : []), [all, selected])
  const secteursDisponibles = useMemo(() => Array.from(new Set(history.map((h) => h.secteur))).sort(), [history])
  const anneeBounds = useMemo((): [number, number] => {
    if (history.length === 0) return [0, 0]
    const annees = history.map((h) => h.annee)
    return [Math.min(...annees), Math.max(...annees)]
  }, [history])

  const [filterSecteurs, setFilterSecteurs] = useState<string[]>([])
  const [filterAnneeMin, setFilterAnneeMin] = useState<number | null>(null)
  const [filterAnneeMax, setFilterAnneeMax] = useState<number | null>(null)

  // Réinitialise les filtres à chaque changement de fournisseur sélectionné.
  useEffect(() => {
    setFilterSecteurs([])
    setFilterAnneeMin(null)
    setFilterAnneeMax(null)
  }, [selected])

  // Par défaut, n'affiche que les 5 dernières années disponibles (élargissable via le filtre) :
  // l'historique complet remonte parfois à 2007 et rend le graphique illisible sans ce recentrage.
  const defaultAnneeMin = Math.max(anneeBounds[0], anneeBounds[1] - 4)
  const anneeMin = filterAnneeMin ?? defaultAnneeMin
  const anneeMax = filterAnneeMax ?? anneeBounds[1]

  const filteredHistory = useMemo(
    () =>
      history.filter(
        (h) =>
          h.annee >= anneeMin && h.annee <= anneeMax && (filterSecteurs.length === 0 || filterSecteurs.includes(h.secteur)),
      ),
    [history, anneeMin, anneeMax, filterSecteurs],
  )
  const latestWithCriteres = filteredHistory.find((h) => h.criteres)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <input
            className="input flex-1"
            autoFocus
            placeholder="Rechercher un fournisseur…"
            value={selected ?? query}
            onChange={(e) => {
              setSelected(null)
              setQuery(e.target.value)
            }}
          />
          <button className="btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {!selected ? (
            <div className="divide-y divide-slate-100">
              {results.length === 0 && <p className="text-sm text-slate-500 py-4">Aucun fournisseur trouvé.</p>}
              {results.map((s) => (
                <button
                  key={s.nom}
                  className="w-full text-left py-2 px-1 hover:bg-slate-50 rounded flex items-center justify-between"
                  onClick={() => setSelected(s.nom)}
                >
                  <div>
                    <div className="font-medium text-sm">{s.nom}</div>
                    <div className="text-xs text-slate-500">
                      {s.secteurs.map((sec) => (
                        <span
                          key={sec}
                          className="inline-block mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                          style={{ backgroundColor: secteurColor(sec) }}
                        >
                          {sec}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm font-medium" style={{ color: s.dernierNote != null ? noteColor(s.dernierNote) : undefined }}>
                    {s.dernierNote != null ? `${s.dernierNote} / 5 (${s.dernierAnnee})` : ''}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{selected}</h3>
                <button className="btn-secondary text-xs" onClick={() => setSelected(null)}>
                  ← Autre fournisseur
                </button>
              </div>

              {secteursDisponibles.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 bg-slate-50 rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs uppercase text-slate-500 mr-1">Secteurs</span>
                    {secteursDisponibles.map((s) => {
                      const active = filterSecteurs.includes(s)
                      return (
                        <button
                          key={s}
                          className="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
                          style={
                            active
                              ? { backgroundColor: secteurColor(s), borderColor: secteurColor(s), color: 'white' }
                              : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }
                          }
                          onClick={() => setFilterSecteurs(toggle(filterSecteurs, s))}
                        >
                          {s}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase text-slate-500">Années</span>
                    <select
                      className="input w-24 py-1"
                      value={anneeMin}
                      onChange={(e) => setFilterAnneeMin(Number(e.target.value))}
                    >
                      {Array.from({ length: anneeBounds[1] - anneeBounds[0] + 1 }, (_, i) => anneeBounds[0] + i).map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <span className="text-slate-400">→</span>
                    <select
                      className="input w-24 py-1"
                      value={anneeMax}
                      onChange={(e) => setFilterAnneeMax(Number(e.target.value))}
                    >
                      {Array.from({ length: anneeBounds[1] - anneeBounds[0] + 1 }, (_, i) => anneeBounds[0] + i).map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(filterSecteurs.length > 0 || filterAnneeMin != null || filterAnneeMax != null) && (
                    <button
                      className="text-xs text-slate-400 underline"
                      onClick={() => {
                        setFilterSecteurs([])
                        setFilterAnneeMin(null)
                        setFilterAnneeMax(null)
                      }}
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>
              )}

              <div>
                <h4 className="text-xs uppercase text-slate-500 mb-2">Évolution de la note</h4>
                <MiniTrend history={filteredHistory} />
              </div>

              {latestWithCriteres?.criteres && (
                <div>
                  <h4 className="text-xs uppercase text-slate-500 mb-2">
                    Détail par critère ({latestWithCriteres.secteur} {latestWithCriteres.annee})
                  </h4>
                  <BarChart
                    data={Object.entries(latestWithCriteres.criteres).map(([label, value]) => ({ label, value }))}
                    max={5}
                  />
                </div>
              )}

              <div>
                <h4 className="text-xs uppercase text-slate-500 mb-2">
                  Historique {filteredHistory.length !== history.length ? `filtré (${filteredHistory.length} / ${history.length})` : `complet (${history.length})`}
                </h4>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-1.5 pr-2">Secteur</th>
                      <th className="py-1.5 pr-2">Année</th>
                      <th className="py-1.5 pr-2">Note</th>
                      <th className="py-1.5 pr-2">Montant</th>
                      <th className="py-1.5 pr-2">Nb éval.</th>
                      <th className="py-1.5">Remarques</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((h) => (
                      <tr key={`${h.secteur}-${h.annee}`} className="border-b border-slate-100 align-top">
                        <td className="py-1.5 pr-2">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                            style={{ backgroundColor: secteurColor(h.secteur) }}
                          >
                            {h.secteur}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2">{h.annee}</td>
                        <td className="py-1.5 pr-2 font-medium" style={{ color: noteColor(h.note!) }}>
                          {h.note} / 5
                        </td>
                        <td className="py-1.5 pr-2">{formatCurrency(h.ca)}</td>
                        <td className="py-1.5 pr-2">{h.nbEvaluateurs ?? '—'}</td>
                        <td className="py-1.5 text-slate-500 max-w-xs truncate" title={h.remarques}>
                          {h.remarques}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

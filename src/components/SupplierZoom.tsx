import { useEffect, useMemo, useState } from 'react'
import type { EvalRecord } from '../data/evaluationsHistorique'
import { canonicalizeCriteres, listSuppliers, supplierHistory } from '../data/evaluationsHistorique'
import { secteurColor, noteColor } from '../data/palette'
import BarChart from './BarChart'
import type { DepenseFournisseur, GroupeFournisseur, LiensDirigeantsEntry } from '../data/depenses'
import {
  findDepenseFournisseur,
  findGroupeDetails,
  findLiensDirigeants,
  loadDepensesFournisseurs,
  loadGroupesFournisseurs,
  loadLiensDirigeants,
} from '../data/depenses'
import SupplierFinances from './SupplierFinances'

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function formatCurrency(v: number | null): string {
  return v == null ? '—' : v.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
}

function MiniTrend({ history, generalSeries }: { history: EvalRecord[]; generalSeries?: { annee: number; note: number }[] }) {
  const points = history.filter((h) => h.note != null)
  const general = generalSeries ?? []
  if (points.length < 2 && general.length < 2) return null
  const annees = Array.from(new Set([...points.map((p) => p.annee), ...general.map((g) => g.annee)])).sort((a, b) => a - b)
  const secteurs = Array.from(new Set(points.map((p) => p.secteur)))
  const width = 500
  const height = 120
  const pad = { top: 10, right: 10, bottom: 20, left: 24 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const minA = annees[0]
  const maxA = annees[annees.length - 1]
  // Une courbe distincte par secteur, alignée sur une échelle d'années commune : deux
  // secteurs pour un même fournisseur ne sont pas la même série et ne doivent pas être
  // reliés par un seul trait zigzagant.
  const x = (a: number) => pad.left + (maxA === minA ? innerW / 2 : ((a - minA) / (maxA - minA)) * innerW)
  const y = (v: number) => pad.top + innerH - (v / 5) * innerH
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {[0, 2.5, 5].map((v) => (
          <line key={v} x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
        ))}
        {secteurs.map((sec) => {
          const pts = points.filter((p) => p.secteur === sec).sort((a, b) => a.annee - b.annee)
          const color = secteurColor(sec)
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.annee)} ${y(p.note!)}`).join(' ')
          return (
            <g key={sec}>
              <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
              {pts.map((p) => (
                <circle key={p.annee} cx={x(p.annee)} cy={y(p.note!)} r={4} fill={color} stroke="white" strokeWidth={1} />
              ))}
            </g>
          )
        })}
        {general.length > 0 && (
          <g>
            <path
              d={general
                .slice()
                .sort((a, b) => a.annee - b.annee)
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.annee)} ${y(p.note)}`)
                .join(' ')}
              fill="none"
              stroke={secteurColor('Général')}
              strokeWidth={2}
              strokeDasharray="5 3"
              strokeLinecap="round"
            />
            {general.map((p) => (
              <circle
                key={p.annee}
                cx={x(p.annee)}
                cy={y(p.note)}
                r={4}
                fill={secteurColor('Général')}
                stroke="white"
                strokeWidth={1}
              />
            ))}
          </g>
        )}
        {annees.map((a) => (
          <text key={a} x={x(a)} y={height - 4} textAnchor="middle" fontSize={11} fontWeight={500} fill="#334155">
            {a}
          </text>
        ))}
      </svg>
      {(secteurs.length > 1 || general.length > 0) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
          {secteurs.map((sec) => (
            <div key={sec} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: secteurColor(sec) }} />
              {sec}
            </div>
          ))}
          {general.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: secteurColor('Général') }} />
              Général (moyenne tous secteurs)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Pour un même critère, empile les barres de chaque secteur directement l'une sous
 * l'autre (plutôt que deux graphiques côte à côte non alignés) pour comparer d'un
 * coup d'œil les secteurs qui partagent le même libellé de critère. */
function PairedCriteriaChart({ series }: { series: { label: string; color: string; criteres: Record<string, number> }[] }) {
  const labels = Array.from(new Set(series.flatMap((s) => Object.keys(s.criteres))))
  return (
    <div className="space-y-3">
      {labels.map((label) => (
        <div key={label}>
          <div className="text-xs text-slate-500 mb-1 truncate" title={label}>
            {label}
          </div>
          <div className="space-y-1">
            {series.map((s) => {
              const value = s.criteres[label]
              if (value == null) return null
              return (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                    title={s.label}
                  />
                  <div className="flex-1 bg-slate-100 rounded-full h-3 relative overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(2, (value / 5) * 100)}%`, backgroundColor: s.color }}
                    />
                  </div>
                  <div className="w-10 shrink-0 text-right text-slate-700 font-medium">{value}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SupplierZoom({ all, initialNom, onClose }: { all: EvalRecord[]; initialNom?: string; onClose: () => void }) {
  const suppliers = useMemo(() => listSuppliers(all), [all])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(initialNom ?? null)

  const [depenseFournisseurs, setDepenseFournisseurs] = useState<DepenseFournisseur[] | null>(null)
  useEffect(() => {
    loadDepensesFournisseurs().then(setDepenseFournisseurs)
  }, [])
  const depenseFournisseur = useMemo(
    () => (selected && depenseFournisseurs ? findDepenseFournisseur(depenseFournisseurs, selected) : null),
    [selected, depenseFournisseurs],
  )

  const [groupes, setGroupes] = useState<GroupeFournisseur[] | null>(null)
  useEffect(() => {
    loadGroupesFournisseurs().then(setGroupes)
  }, [])
  const groupeDetails = useMemo(
    () =>
      depenseFournisseur && groupes && depenseFournisseurs
        ? findGroupeDetails(groupes, depenseFournisseurs, depenseFournisseur.nfr)
        : [],
    [depenseFournisseur, groupes, depenseFournisseurs],
  )

  const [liensDirigeants, setLiensDirigeants] = useState<LiensDirigeantsEntry[] | null>(null)
  useEffect(() => {
    loadLiensDirigeants().then(setLiensDirigeants)
  }, [])
  const liensReseau = useMemo(
    () => (depenseFournisseur && liensDirigeants ? findLiensDirigeants(liensDirigeants, depenseFournisseur.nfr) : null),
    [depenseFournisseur, liensDirigeants],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return suppliers.slice(0, 30)
    return suppliers.filter((s) => s.nom.toLowerCase().includes(q)).slice(0, 30)
  }, [suppliers, query])

  const history = useMemo(() => (selected ? supplierHistory(all, selected) : []), [all, selected])

  // Note la plus récente disponible pour ce fournisseur (moyenne tous secteurs de l'année, comme
  // "Général" ailleurs dans cette vue) et l'année précédente, pour afficher la variation.
  const notesRecentes = useMemo(() => {
    const annees = Array.from(new Set(history.filter((h) => h.note != null).map((h) => h.annee))).sort((a, b) => b - a)
    if (annees.length === 0) return null
    const avgForYear = (y: number) => {
      const notes = history.filter((h) => h.annee === y && h.note != null).map((h) => h.note!)
      return notes.length ? Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 100) / 100 : null
    }
    const yLatest = annees[0]
    const yPrev = annees[1] ?? null
    return {
      yLatest,
      noteLatest: avgForYear(yLatest),
      yPrev,
      notePrev: yPrev != null ? avgForYear(yPrev) : null,
    }
  }, [history])
  // "Général" est toujours proposé, même sans historique pré-2017 : sélectionné, il n'affiche
  // pas un secteur réel mais la moyenne agrégée tous secteurs confondus (cf. generalSeries).
  const secteursDisponibles = useMemo(() => {
    const reels = Array.from(new Set(history.map((h) => h.secteur))).filter((s) => s !== 'Général').sort()
    return history.length > 0 ? [...reels, 'Général'] : []
  }, [history])
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
  // Le plus récent enregistrement avec critères, par secteur : deux secteurs peuvent
  // utiliser des libellés de critères identiques (ex. "Rapport Qualité/Prix" pour
  // fournisseurs GC et BAT VD) et se comparent alors utilement côte à côte.
  const critereRecordsBySecteur = useMemo(() => {
    const bySecteur = new Map<string, EvalRecord>()
    for (const h of [...filteredHistory].sort((a, b) => b.annee - a.annee)) {
      if (h.criteres && !bySecteur.has(h.secteur)) bySecteur.set(h.secteur, h)
    }
    return Array.from(bySecteur.values())
  }, [filteredHistory])

  const showGeneral = filterSecteurs.includes('Général')

  // "Général" = moyenne tous secteurs confondus, année par année (et non le secteur
  // historique "Général" à part) : ce que demande la personne qui utilise l'outil.
  const generalSeries = useMemo(() => {
    if (!showGeneral) return []
    const byAnnee = new Map<number, number[]>()
    for (const h of history) {
      if (h.note == null || h.annee < anneeMin || h.annee > anneeMax) continue
      if (!byAnnee.has(h.annee)) byAnnee.set(h.annee, [])
      byAnnee.get(h.annee)!.push(h.note)
    }
    return Array.from(byAnnee.entries())
      .map(([annee, notes]) => ({ annee, note: Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 100) / 100 }))
      .sort((a, b) => a.annee - b.annee)
  }, [history, anneeMin, anneeMax, showGeneral])

  const generalCriteres = useMemo(() => {
    if (!showGeneral) return null
    const bucket = new Map<string, number[]>()
    for (const rec of critereRecordsBySecteur) {
      for (const [label, value] of Object.entries(canonicalizeCriteres(rec.criteres))) {
        if (!bucket.has(label)) bucket.set(label, [])
        bucket.get(label)!.push(value)
      }
    }
    if (bucket.size === 0) return null
    const criteres: Record<string, number> = {}
    for (const [label, vals] of bucket.entries()) {
      criteres[label] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
    }
    return criteres
  }, [critereRecordsBySecteur, showGeneral])

  const anneesPourComparaison = useMemo(() => Array.from(new Set(history.map((h) => h.annee))).sort((a, b) => b - a), [history])
  const [compareOn, setCompareOn] = useState(false)
  const [compareA, setCompareA] = useState<number | null>(null)
  const [compareB, setCompareB] = useState<number | null>(null)

  useEffect(() => {
    setCompareOn(false)
    setCompareA(anneesPourComparaison[0] ?? null)
    setCompareB(anneesPourComparaison[1] ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const recordForYear = (y: number | null) => {
    if (y == null) return undefined
    return history.find((h) => h.annee === y && h.criteres) ?? history.find((h) => h.annee === y)
  }
  const recA = recordForYear(compareA)
  const recB = recordForYear(compareB)
  // Canonicalisés pour que le même critère se compare sur une seule ligne même si compareA et
  // compareB proviennent de secteurs utilisant des libellés différents (ex. BAT GE vs GC).
  const critereA = useMemo(() => canonicalizeCriteres(recA?.criteres), [recA])
  const critereB = useMemo(() => canonicalizeCriteres(recB?.criteres), [recB])
  const critereLabels = Array.from(new Set([...Object.keys(critereA), ...Object.keys(critereB)]))

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

              <SupplierFinances
                fournisseur={depenseFournisseur}
                loading={depenseFournisseurs === null}
                notesRecentes={notesRecentes}
                groupeDetails={groupeDetails}
                liensReseau={liensReseau}
              />

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
                <MiniTrend history={filteredHistory} generalSeries={generalSeries} />
              </div>

              <div>
                <button className="btn-secondary text-xs" onClick={() => setCompareOn((v) => !v)}>
                  {compareOn ? 'Masquer le comparatif' : 'Comparer deux années'}
                </button>
                {compareOn && anneesPourComparaison.length >= 2 && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <select
                        className="input w-28 py-1"
                        value={compareA ?? ''}
                        onChange={(e) => setCompareA(Number(e.target.value))}
                      >
                        {anneesPourComparaison.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                      <span className="text-slate-400">vs</span>
                      <select
                        className="input w-28 py-1"
                        value={compareB ?? ''}
                        onChange={(e) => setCompareB(Number(e.target.value))}
                      >
                        {anneesPourComparaison.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                          <th className="py-1.5 pr-3">Indicateur</th>
                          <th className="py-1.5 pr-3">{compareA ?? '—'}</th>
                          <th className="py-1.5">{compareB ?? '—'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="py-1.5 pr-3 text-slate-600">Secteur</td>
                          <td className="py-1.5 pr-3">{recA?.secteur ?? '—'}</td>
                          <td className="py-1.5">{recB?.secteur ?? '—'}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-1.5 pr-3 text-slate-600">Note globale</td>
                          <td className="py-1.5 pr-3 font-medium" style={{ color: recA?.note != null ? noteColor(recA.note) : undefined }}>
                            {recA?.note != null ? `${recA.note} / 5` : '—'}
                          </td>
                          <td className="py-1.5 font-medium" style={{ color: recB?.note != null ? noteColor(recB.note) : undefined }}>
                            {recB?.note != null ? `${recB.note} / 5` : '—'}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-1.5 pr-3 text-slate-600">Montant</td>
                          <td className="py-1.5 pr-3">{formatCurrency(recA?.ca ?? null)}</td>
                          <td className="py-1.5">{formatCurrency(recB?.ca ?? null)}</td>
                        </tr>
                        {critereLabels.map((label) => (
                          <tr key={label} className="border-b border-slate-100">
                            <td className="py-1.5 pr-3 text-slate-600">{label}</td>
                            <td className="py-1.5 pr-3">{critereA[label] ?? '—'}</td>
                            <td className="py-1.5">{critereB[label] ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {compareOn && anneesPourComparaison.length < 2 && (
                  <p className="text-sm text-slate-500 mt-2">Pas assez d'années disponibles pour ce fournisseur.</p>
                )}
              </div>

              {(critereRecordsBySecteur.length > 0 || generalCriteres) && (
                <div>
                  <h4 className="text-xs uppercase text-slate-500 mb-2">
                    Détail par critère
                    {critereRecordsBySecteur.length === 1 && !generalCriteres
                      ? ` (${critereRecordsBySecteur[0].secteur} ${critereRecordsBySecteur[0].annee})`
                      : ''}
                  </h4>
                  {critereRecordsBySecteur.length + (generalCriteres ? 1 : 0) > 1 ? (
                    <>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                        {critereRecordsBySecteur.map((rec) => (
                          <div key={rec.secteur} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: secteurColor(rec.secteur) }}
                            />
                            {rec.secteur} {rec.annee}
                          </div>
                        ))}
                        {generalCriteres && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: secteurColor('Général') }}
                            />
                            Général (moyenne tous secteurs)
                          </div>
                        )}
                      </div>
                      <PairedCriteriaChart
                        series={[
                          ...critereRecordsBySecteur.map((rec) => ({
                            label: `${rec.secteur} ${rec.annee}`,
                            color: secteurColor(rec.secteur),
                            criteres: canonicalizeCriteres(rec.criteres),
                          })),
                          ...(generalCriteres
                            ? [{ label: 'Général', color: secteurColor('Général'), criteres: generalCriteres }]
                            : []),
                        ]}
                      />
                    </>
                  ) : (
                    <BarChart
                      data={Object.entries(canonicalizeCriteres(critereRecordsBySecteur[0].criteres)).map(([label, value]) => ({ label, value }))}
                      max={5}
                    />
                  )}
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

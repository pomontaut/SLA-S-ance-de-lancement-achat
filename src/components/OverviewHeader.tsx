import { useMemo, useState } from 'react'
import type { EvalRecord, GlobalFilters } from '../data/evaluationsHistorique'
import { applyFilters, globalKpis } from '../data/evaluationsHistorique'
import { secteurColor } from '../data/palette'

// En-tête « Dashboard évaluation » (maquette du propriétaire) : indicateurs de l'année choisie
// avec la comparaison à l'année précédente, puis analyse par secteurs (plusieurs possibles), par
// année / période, par fournisseur et par type (menu déroulant).

// Secteurs proposés. L'historique d'évaluation ne distingue pas EG GE et EG VD (un seul secteur
// « EG GE/VD ») : ils partagent donc le même bouton. BAT GE inclut TRANSFO RENO.
const SECTEUR_BOUTONS: { secteur: string; label: string; aide?: string }[] = [
  { secteur: 'GC', label: 'GC' },
  { secteur: 'BAT GE', label: 'BAT GE', aide: 'y compris TRANSFO RENO' },
  { secteur: 'BAT VD', label: 'BAT VD' },
  { secteur: 'EG GE/VD', label: 'EG GE / EG VD', aide: "l'historique d'évaluation ne distingue pas EG GE et EG VD" },
  { secteur: 'EG VS', label: 'EG VS' },
]

const ANNEE_MIN_BOUTONS = 2017

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function chf(v: number | null): string {
  return v == null ? 'Non disponible' : v.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
}

/** Évolution signée à côté du chiffre : « +12 » vert, « −48 » rouge, « = » gris. */
function Evolution({ texte, signe }: { texte: string; signe: number }) {
  const couleur = signe > 0 ? '#16a34a' : signe < 0 ? '#dc2626' : '#94a3b8'
  return (
    <span className="text-sm font-semibold ml-2 align-middle whitespace-nowrap" style={{ color: couleur }}>
      {texte}
    </span>
  )
}

function Tuile({
  label,
  value,
  precedent,
  evolution,
}: {
  label: string
  value: string
  precedent?: string
  evolution?: { texte: string; signe: number } | null
}) {
  return (
    <div className="card text-center py-4 min-h-[120px] flex flex-col justify-center">
      <div className="text-2xl font-bold text-indigo-600 whitespace-nowrap">
        {value}
        {evolution && <Evolution texte={evolution.texte} signe={evolution.signe} />}
      </div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {precedent !== undefined && <div className="text-[11px] text-slate-400 mt-0.5">{precedent}</div>}
    </div>
  )
}

/** « +48 » / « −12 » (vrai signe moins) ; null si une des deux valeurs manque. */
function delta(cur: number | null, prec: number | null, opts: { decimales?: number; unite?: string; compact?: boolean } = {}) {
  if (cur == null || prec == null) return null
  const d = cur - prec
  const signe = Math.abs(d) < 1e-9 ? 0 : d > 0 ? 1 : -1
  if (signe === 0) return { texte: '=', signe }
  const abs = Math.abs(d)
  const nombre = opts.compact
    ? `${(abs / 1e6).toLocaleString('fr-CH', { maximumFractionDigits: 1 })} M`
    : abs.toLocaleString('fr-CH', { minimumFractionDigits: opts.decimales ?? 0, maximumFractionDigits: opts.decimales ?? 0 })
  return { texte: `${signe > 0 ? '+' : '−'}${nombre}${opts.unite ?? ''}`, signe }
}

export default function OverviewHeader({
  all,
  filters,
  onChange,
  types,
  supplierNames,
  cfcList,
}: {
  all: EvalRecord[]
  filters: GlobalFilters
  onChange: (f: GlobalFilters) => void
  types: string[]
  supplierNames: string[]
  cfcList: string[]
}) {
  const [avance, setAvance] = useState(false)
  const annees = useMemo(() => Array.from(new Set(all.map((r) => r.annee))).sort((a, b) => a - b), [all])
  const anneesBoutons = annees.filter((a) => a >= ANNEE_MIN_BOUTONS)

  // Indicateurs : année de fin de période (« 2025 ») et année précédente, à filtres identiques
  // (secteurs, type, fournisseur, note, CFC) hormis la période.
  const annee = filters.anneeMax
  const kpi = useMemo(() => globalKpis(applyFilters(all, { ...filters, anneeMin: annee, anneeMax: annee })), [all, filters, annee])
  const kpiPrec = useMemo(
    () => globalKpis(applyFilters(all, { ...filters, anneeMin: annee - 1, anneeMax: annee - 1 })),
    [all, filters, annee],
  )
  const precDispo = kpiPrec.evaluationsTotal > 0

  const periodeMultiple = filters.anneeMin !== filters.anneeMax

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <h3 className="text-2xl font-bold">Dashboard évaluation {annee}</h3>
        {periodeMultiple && (
          <span className="text-xs text-slate-500">
            Indicateurs de {annee} (comparés à {annee - 1}) — graphiques sur la période {filters.anneeMin} → {filters.anneeMax}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tuile
          label="Fournisseurs évalués"
          value={String(kpi.fournisseursEvalues)}
          evolution={precDispo ? delta(kpi.fournisseursEvalues, kpiPrec.fournisseursEvalues) : null}
          precedent={`${annee - 1} : ${precDispo ? kpiPrec.fournisseursEvalues : '—'}`}
        />
        <Tuile
          label="Nombre d'évaluations"
          value={String(kpi.evaluationsTotal)}
          evolution={precDispo ? delta(kpi.evaluationsTotal, kpiPrec.evaluationsTotal) : null}
          precedent={`${annee - 1} : ${precDispo ? kpiPrec.evaluationsTotal : '—'}`}
        />
        <Tuile
          label="Moyenne globale"
          value={kpi.moyenneGlobale != null ? `${kpi.moyenneGlobale} / 5` : '—'}
          evolution={delta(kpi.moyenneGlobale, kpiPrec.moyenneGlobale, { decimales: 2 })}
          precedent={`${annee - 1} : ${kpiPrec.moyenneGlobale != null ? `${kpiPrec.moyenneGlobale} / 5` : '—'}`}
        />
        <Tuile
          label="Périmètre évalué en CHF"
          value={kpi.perimetreEvalue != null ? Math.round(kpi.perimetreEvalue).toLocaleString('fr-CH') : 'Non disponible'}
          evolution={delta(kpi.perimetreEvalue, kpiPrec.perimetreEvalue, { compact: true })}
          precedent={`${annee - 1} : ${chf(kpiPrec.perimetreEvalue)}`}
        />
      </div>

      <div className="card space-y-4">
        <div>
          <div className="text-xs uppercase text-slate-500 mb-2">
            Analyse par secteurs <span className="normal-case text-slate-400">(plusieurs possibles)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {SECTEUR_BOUTONS.map(({ secteur, label, aide }) => {
              const actif = filters.secteurs.includes(secteur)
              return (
                <button
                  key={secteur}
                  title={aide}
                  className="h-14 w-full px-2 rounded-lg text-sm font-medium border transition-colors flex flex-col items-center justify-center leading-tight"
                  style={
                    actif
                      ? { backgroundColor: secteurColor(secteur), borderColor: secteurColor(secteur), color: 'white' }
                      : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }
                  }
                  onClick={() => onChange({ ...filters, secteurs: toggle(filters.secteurs, secteur) })}
                >
                  {label}
                  {secteur === 'BAT GE' && <span className="text-[10px] font-normal opacity-80">(y c. TRANSFO RENO)</span>}
                </button>
              )
            })}
          </div>
          {filters.secteurs.length > 0 && (
            <button className="text-xs text-slate-400 underline mt-2" onClick={() => onChange({ ...filters, secteurs: [] })}>
              Tous les secteurs
            </button>
          )}
        </div>

        <div>
          <div className="text-xs uppercase text-slate-500 mb-2">Par année</div>
          <div className="flex flex-wrap items-center gap-2">
            {anneesBoutons.map((a) => {
              const actif = filters.anneeMin === a && filters.anneeMax === a
              return (
                <button
                  key={a}
                  className="px-3 py-1 rounded-lg text-sm font-medium border transition-colors"
                  style={
                    actif
                      ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: 'white' }
                      : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }
                  }
                  onClick={() => onChange({ ...filters, anneeMin: a, anneeMax: a })}
                >
                  {a}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className="text-slate-500">Période de</span>
            <select
              className="input !w-24 py-1"
              value={filters.anneeMin}
              onChange={(e) => {
                const min = Number(e.target.value)
                onChange({ ...filters, anneeMin: min, anneeMax: Math.max(min, filters.anneeMax) })
              }}
            >
              {annees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <span className="text-slate-500">à</span>
            <select
              className="input !w-24 py-1"
              value={filters.anneeMax}
              onChange={(e) => {
                const max = Number(e.target.value)
                onChange({ ...filters, anneeMax: max, anneeMin: Math.min(max, filters.anneeMin) })
              }}
            >
              {annees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase text-slate-500 block mb-1">Par fournisseur</label>
            <input
              className="input"
              list="fournisseurs-datalist"
              placeholder="Rechercher un fournisseur…"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
            />
            <datalist id="fournisseurs-datalist">
              {supplierNames.map((nom) => (
                <option key={nom} value={nom} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500 block mb-1">Par type</label>
            <select
              className="input"
              value={filters.types[0] ?? ''}
              onChange={(e) => onChange({ ...filters, types: e.target.value ? [e.target.value] : [] })}
            >
              <option value="">Tous les types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <button className="text-xs text-slate-400 underline" onClick={() => setAvance((v) => !v)}>
            {avance ? 'Masquer les filtres avancés' : 'Filtres avancés (note, CFC)'}
          </button>
          {avance && (
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-slate-500">Note</span>
                <input type="number" min={0} max={5} step={0.5} className="input !w-16 py-1" value={filters.noteMin} onChange={(e) => onChange({ ...filters, noteMin: Number(e.target.value) })} />
                <span className="text-slate-400">→</span>
                <input type="number" min={0} max={5} step={0.5} className="input !w-16 py-1" value={filters.noteMax} onChange={(e) => onChange({ ...filters, noteMax: Number(e.target.value) })} />
              </div>
              {cfcList.length > 0 && (
                <>
                  <input className="input flex-1 min-w-[200px] py-1" placeholder="Rechercher un CFC…" value={filters.cfc} onChange={(e) => onChange({ ...filters, cfc: e.target.value })} list="cfc-datalist" />
                  <datalist id="cfc-datalist">
                    {cfcList.map((cfc) => (
                      <option key={cfc} value={cfc} />
                    ))}
                  </datalist>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

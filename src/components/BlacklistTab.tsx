import { useMemo, useState } from 'react'
import type { BlacklistEntry, EvalRecord } from '../data/evaluationsHistorique'
import { normalizeType, supplierClassifications, supplierHistoryFuzzy } from '../data/evaluationsHistorique'
import { secteurColor, noteColor } from '../data/palette'

function formatCurrency(v: number | null): string {
  return v == null ? '—' : v.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
}

// Les valeurs de "type" du fichier source (colonne Excel) sont orthographiées de façon
// incohérente (casse, espace au lieu de tiret) — on les fait passer par normalizeType()
// pour rejoindre les mêmes libellés que le reste du dashboard, avec un repli manuel pour
// "sous traitant" (sans tiret) que normalizeType ne reconnaît pas.
function normalizeBlacklistType(raw: string): string {
  const t = raw.trim()
  if (/^sous[\s-]traitants?$/i.test(t)) return 'Sous-traitant'
  return normalizeType(t) || t
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function EntryCard({ entry, all, onZoom }: { entry: BlacklistEntry; all: EvalRecord[]; onZoom: (nom: string) => void }) {
  const history = useMemo(() => supplierHistoryFuzzy(all, entry.nom), [all, entry.nom])

  return (
    <div className="card border border-red-200">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button className="font-semibold text-base hover:underline" onClick={() => onZoom(entry.nom)}>
            {entry.nom}
          </button>
          <span className="ml-2 text-xs text-slate-500">{normalizeBlacklistType(entry.type)}</span>
        </div>
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-white bg-red-600">🚫 Blacklisté</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        <div>
          <h4 className="text-xs uppercase text-slate-500 mb-1.5">Remarques (ordre chronologique)</h4>
          {entry.remarques.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune remarque.</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-600 list-disc list-inside">
              {entry.remarques.map((r, i) => (
                <li key={i} className="whitespace-pre-line">
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="text-xs uppercase text-slate-500 mb-1.5">Historique de notation</h4>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune note dans l'historique d'évaluation.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-1 pr-2">Secteur</th>
                    <th className="py-1 pr-2">Année</th>
                    <th className="py-1 pr-2">Note</th>
                    <th className="py-1">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={`${h.secteur}-${h.annee}`} className="border-b border-slate-100">
                      <td className="py-1 pr-2">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                          style={{ backgroundColor: secteurColor(h.secteur) }}
                        >
                          {h.secteur}
                        </span>
                      </td>
                      <td className="py-1 pr-2">{h.annee}</td>
                      <td className="py-1 pr-2 font-medium" style={{ color: noteColor(h.note!) }}>
                        {h.note} / 5
                      </td>
                      <td className="py-1">{formatCurrency(h.ca)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BlacklistTab({ all, blacklist, onZoom }: { all: EvalRecord[]; blacklist: BlacklistEntry[]; onZoom: (nom: string) => void }) {
  const enriched = useMemo(
    () =>
      blacklist.map((entry) => ({
        entry,
        type: normalizeBlacklistType(entry.type),
        classifications: supplierClassifications(all, entry.nom),
      })),
    [all, blacklist],
  )

  const typeOptions = useMemo(() => Array.from(new Set(enriched.map((e) => e.type).filter(Boolean))).sort(), [enriched])
  const cfcOptions = useMemo(
    () => Array.from(new Set(enriched.flatMap((e) => e.classifications.cfc))).sort(),
    [enriched],
  )

  const [selectedFilters, setSelectedFilters] = useState<string[]>([])

  const filtered = useMemo(() => {
    if (selectedFilters.length === 0) return enriched
    return enriched.filter(
      (e) => selectedFilters.includes(e.type) || e.classifications.cfc.some((c) => selectedFilters.includes(c)),
    )
  }, [enriched, selectedFilters])

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="font-semibold mb-1 text-red-700">🚫 Fournisseurs blacklistés ({blacklist.length})</h3>
        <p className="text-xs text-slate-500 mb-3">
          Identifiés dans l'historique 2008-2025 (colonne Remarques) comme à ne plus consulter. Les remarques
          n'étant pas datées individuellement dans le fichier source, elles sont listées dans leur ordre
          d'origine sans année assignée (sauf mention explicite dans le texte).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs uppercase text-slate-500 mr-1">Type</span>
            {typeOptions.map((t) => {
              const active = selectedFilters.includes(t)
              return (
                <button
                  key={t}
                  className={active ? 'btn-primary text-xs py-1' : 'btn-secondary text-xs py-1'}
                  onClick={() => setSelectedFilters(toggle(selectedFilters, t))}
                >
                  {t}
                </button>
              )
            })}
          </div>
          {cfcOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs uppercase text-slate-500 mr-1">CFC</span>
              {cfcOptions.map((c) => {
                const active = selectedFilters.includes(c)
                return (
                  <button
                    key={c}
                    className={active ? 'btn-primary text-xs py-1' : 'btn-secondary text-xs py-1'}
                    onClick={() => setSelectedFilters(toggle(selectedFilters, c))}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          )}
          {selectedFilters.length > 0 && (
            <button className="text-xs text-slate-400 underline" onClick={() => setSelectedFilters([])}>
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun fournisseur blacklisté pour ce filtre.</p>
      ) : (
        filtered.map(({ entry }) => <EntryCard key={entry.nom} entry={entry} all={all} onZoom={onZoom} />)
      )}
    </div>
  )
}

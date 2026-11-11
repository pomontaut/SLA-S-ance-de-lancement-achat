import { useEffect, useMemo, useState } from 'react'
import type { EvaluationFormulaire } from '../types'
import { deleteEvaluationFormulaire, listEvaluationsFormulaire } from '../data/db'
import { moyenneCriteres } from '../data/formulaireEvaluation'
import { normNom } from '../data/evaluationsHistorique'

function anneeDe(e: EvaluationFormulaire): number {
  const y = new Date(e.createdAt).getFullYear()
  return Number.isNaN(y) ? new Date().getFullYear() : y
}

/** Encadré "Évaluations du formulaire" du compte fournisseur : toutes les évaluations saisies via
 * le Formulaire d'évaluation pour ce fournisseur, l'année en cours en tête (moyenne + détail),
 * les années précédentes en dessous. Chaque évaluation peut être supprimée. */
export default function SupplierFormulaireEvaluations({ nom }: { nom: string }) {
  const [evaluations, setEvaluations] = useState<EvaluationFormulaire[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setEvaluations(null)
    listEvaluationsFormulaire()
      .then((all) => !cancelled && setEvaluations(all))
      .catch((e) => {
        if (cancelled) return
        setError((e as Error).message)
        setEvaluations([])
      })
    return () => {
      cancelled = true
    }
  }, [nom])

  const mine = useMemo(() => {
    const n = normNom(nom)
    return (evaluations ?? []).filter((e) => normNom(e.fournisseurNom) === n)
  }, [evaluations, nom])

  const anneeCourante = new Date().getFullYear()
  const parAnnee = useMemo(() => {
    const m = new Map<number, EvaluationFormulaire[]>()
    for (const e of mine) {
      const y = anneeDe(e)
      m.set(y, [...(m.get(y) ?? []), e])
    }
    if (!m.has(anneeCourante)) m.set(anneeCourante, [])
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0])
  }, [mine, anneeCourante])

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette évaluation ?')) return
    try {
      await deleteEvaluationFormulaire(id)
      setEvaluations((prev) => (prev ? prev.filter((e) => e.id !== id) : prev))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-3">
      <h4 className="text-sm font-semibold mb-2">
        Évaluations du formulaire {evaluations ? <span className="font-normal text-slate-500">({mine.length})</span> : null}
      </h4>
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      {!evaluations ? (
        <p className="text-xs text-slate-500">Chargement…</p>
      ) : (
        <div className="space-y-3">
          {parAnnee.map(([annee, liste]) => {
            const moy = moyenneCriteres(Object.fromEntries(liste.filter((e) => e.moyenne != null).map((e, i) => [String(i), e.moyenne])))
            return (
              <div key={annee}>
                <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>
                    {annee}
                    {annee === anneeCourante ? ' (année en cours)' : ''}
                  </span>
                  <span>
                    {liste.length} évaluation{liste.length > 1 ? 's' : ''}
                    {moy != null ? ` · moyenne ${moy} / 4` : ''}
                  </span>
                </div>
                {liste.length === 0 ? (
                  <p className="text-xs text-slate-400">Aucune évaluation saisie cette année.</p>
                ) : (
                  <div className="bg-white rounded border border-slate-200 divide-y divide-slate-100">
                    {liste.map((e) => (
                      <div key={e.id} className="px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <button className="text-left flex-1 hover:underline" onClick={() => setOpenId(openId === e.id ? null : e.id)}>
                            <span className="font-medium">{new Date(e.createdAt).toLocaleDateString('fr-CH')}</span>
                            {' · '}
                            {[e.numeroChantier, e.nomChantier].filter(Boolean).join(' — ') || 'Chantier non renseigné'}
                            <span className="text-slate-400"> · {e.famille}</span>
                            {e.evaluateur ? <span className="text-slate-400"> · {e.evaluateur}</span> : null}
                          </button>
                          <span className="font-semibold">{e.moyenne != null ? `${e.moyenne} / 4` : '—'}</span>
                          <button className="text-red-600 hover:underline" onClick={() => handleDelete(e.id)}>
                            Supprimer
                          </button>
                        </div>
                        {openId === e.id && (
                          <div className="mt-1.5 pl-2 text-xs grid grid-cols-[minmax(0,1fr)_3rem] gap-x-3 gap-y-0.5">
                            {Object.entries(e.criteres).map(([label, note]) => (
                              <div key={label} className="contents">
                                <span className="truncate" title={label}>
                                  {label}
                                </span>
                                <span className="text-right">{note != null ? `${note} / 4` : '—'}</span>
                              </div>
                            ))}
                            {e.remarques && <div className="col-span-2 text-slate-500 mt-1">{e.remarques}</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

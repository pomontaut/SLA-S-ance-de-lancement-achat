import { useEffect, useState } from 'react'
import type { Dossier, Evaluation, Lot } from '../types'
import { noteGlobale } from '../types'
import { listEvaluations, listLots } from '../data/db'
import EvaluationFormModal from './EvaluationFormModal'

const STATUT_COLORS: Record<string, string> = {
  Brouillon: 'bg-amber-100 text-amber-700',
  Complété: 'bg-green-100 text-green-700',
}

export default function EvaluationTab({ dossier }: { dossier: Dossier }) {
  const [lots, setLots] = useState<Lot[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openEvaluationId, setOpenEvaluationId] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [dossier.id])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [l, e] = await Promise.all([listLots(dossier.id), listEvaluations(dossier.id)])
      setLots(l)
      setEvaluations(e)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleSaved(updated: Evaluation) {
    setEvaluations((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }

  if (loading) return <div className="text-sm text-slate-500">Chargement…</div>

  const rows = lots
    .filter((lot) => lot.fournisseurChoisi.trim())
    .map((lot) => ({ lot, evaluation: evaluations.find((e) => e.lotId === lot.id) ?? null }))

  const openEvaluation = evaluations.find((e) => e.id === openEvaluationId) ?? null

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="font-semibold">Évaluation fournisseur</h3>
        <p className="text-sm text-slate-500 mt-1">
          Une fiche d'évaluation est créée automatiquement dès qu'un fournisseur est renseigné comme « Fournisseur choisi »
          pour un lot (onglet Suivi HA). À remplir en fin de chantier pour garder un historique consultable sur les
          prochains projets.
        </p>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">Erreur : {error}</div>}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun lot n'a encore de fournisseur choisi. Renseignez le champ « Fournisseur choisi » dans le détail d'un lot
          (onglet Suivi HA) pour faire apparaître une fiche ici.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-2">Lot</th>
                <th className="py-2 pr-2">Fournisseur choisi</th>
                <th className="py-2 pr-2">Statut</th>
                <th className="py-2 pr-2">Note globale</th>
                <th className="py-2 pr-2">Recommandation</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ lot, evaluation }) => (
                <tr key={lot.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 font-medium">{lot.familleLot || 'Sans nom'}</td>
                  <td className="py-2 pr-2">{lot.fournisseurChoisi}</td>
                  <td className="py-2 pr-2">
                    {evaluation ? (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_COLORS[evaluation.statut] ?? ''}`}>
                        {evaluation.statut}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 pr-2">{evaluation && noteGlobale(evaluation) != null ? `${noteGlobale(evaluation)} / 5` : '—'}</td>
                  <td className="py-2 pr-2">{evaluation?.recommandation || '—'}</td>
                  <td className="py-2">
                    {evaluation && (
                      <button className="btn-secondary" onClick={() => setOpenEvaluationId(evaluation.id)}>
                        {evaluation.statut === 'Complété' ? 'Voir / modifier' : 'Remplir'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openEvaluation && (
        <EvaluationFormModal
          evaluation={openEvaluation}
          onClose={() => setOpenEvaluationId(null)}
          onSaved={handleSaved}
          onError={setError}
        />
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { Evaluation } from '../types'
import { EVALUATION_CRITERES, EVALUATION_STATUT_OPTIONS, RECOMMANDATION_OPTIONS, noteGlobale } from '../types'
import { listEvaluationsForSupplier, updateEvaluation } from '../data/db'
import type { EvaluationHistoryEntry } from '../data/db'

function NoteSelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <select
      className="input w-24"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">—</option>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n} / 5
        </option>
      ))}
    </select>
  )
}

export default function EvaluationFormModal({
  evaluation,
  onClose,
  onSaved,
  onError,
}: {
  evaluation: Evaluation
  onClose: () => void
  onSaved: (evaluation: Evaluation) => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState<Evaluation>(evaluation)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<EvaluationHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    listEvaluationsForSupplier(evaluation.fournisseurNom, evaluation.dossierId)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [evaluation.fournisseurNom, evaluation.dossierId])

  function set<K extends keyof Evaluation>(key: K, value: Evaluation[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const note = noteGlobale(form)

  async function handleSave(statut?: string) {
    setSaving(true)
    try {
      const saved = await updateEvaluation(statut ? { ...form, statut } : form)
      onSaved(saved)
      onClose()
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Évaluation — {form.fournisseurNom}</h3>
          <button className="btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>

        {!historyLoading && history.length > 0 && (
          <section className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-sm uppercase text-slate-500">
              Historique de ce fournisseur ({history.length} évaluation{history.length > 1 ? 's' : ''} sur d'autres chantiers)
            </h4>
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.evaluation.id} className="text-sm border-b border-slate-200 pb-2 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {h.dossier.numeroChantier || 'Sans numéro'} — {h.dossier.adresse}
                    </span>
                    <span className="text-xs text-slate-500">
                      {noteGlobale(h.evaluation) != null ? `Note : ${noteGlobale(h.evaluation)} / 5` : ''}
                      {h.evaluation.recommandation ? ` · ${h.evaluation.recommandation}` : ''}
                    </span>
                  </div>
                  {h.evaluation.commentaire && <p className="text-xs text-slate-500 mt-1">{h.evaluation.commentaire}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Date d'évaluation</label>
              <input
                className="input"
                type="date"
                value={form.dateEvaluation}
                onChange={(e) => set('dateEvaluation', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Évaluateur</label>
              <input className="input" value={form.evaluateur} onChange={(e) => set('evaluateur', e.target.value)} />
            </div>
          </div>
        </section>

        <section>
          <h4 className="font-semibold mb-3 text-sm uppercase text-slate-500">Critères</h4>
          <div className="space-y-2">
            {EVALUATION_CRITERES.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3">
                <span className="text-sm">{c.label}</span>
                <NoteSelect value={form[c.key]} onChange={(v) => set(c.key, v)} />
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm font-medium">Note globale : {note != null ? `${note} / 5` : '—'}</div>
        </section>

        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Recommandation</label>
              <select className="input" value={form.recommandation} onChange={(e) => set('recommandation', e.target.value)}>
                <option value=""></option>
                {RECOMMANDATION_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Statut</label>
              <select className="input" value={form.statut} onChange={(e) => set('statut', e.target.value)}>
                {EVALUATION_STATUT_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="label">Commentaire</label>
            <textarea
              className="input min-h-[80px]"
              value={form.commentaire}
              onChange={(e) => set('commentaire', e.target.value)}
            />
          </div>
        </section>

        <div className="flex gap-2 pt-2 border-t border-slate-200">
          <button className="btn-primary" disabled={saving} onClick={() => handleSave('Complété')}>
            {saving ? 'Enregistrement…' : 'Enregistrer et marquer complété'}
          </button>
          <button className="btn-secondary" disabled={saving} onClick={() => handleSave()}>
            Enregistrer comme brouillon
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

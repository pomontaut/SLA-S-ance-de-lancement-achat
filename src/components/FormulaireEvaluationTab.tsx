import { useEffect, useState } from 'react'
import type { EvaluationFormulaire, NewEvaluationFormulaire } from '../types'
import { FAMILLES_EVALUATION, NOTE_OPTIONS, criteresPourFamille, moyenneCriteres } from '../data/formulaireEvaluation'
import { createEvaluationFormulaire, deleteEvaluationFormulaire, listEvaluationsFormulaire, updateEvaluationFormulaire } from '../data/db'
import SupplierPicker from './SupplierPicker'

const EMPTY_FORM: NewEvaluationFormulaire = {
  famille: FAMILLES_EVALUATION[0].famille,
  fournisseurId: null,
  fournisseurNom: '',
  numeroChantier: '',
  nomChantier: '',
  criteres: {},
  moyenne: null,
  remarques: '',
  evaluateur: '',
}

function NoteSelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <select
      className="input w-24"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">—</option>
      {NOTE_OPTIONS.map((n) => (
        <option key={n} value={n}>
          {n} / 4
        </option>
      ))}
    </select>
  )
}

export default function FormulaireEvaluationTab() {
  const [form, setForm] = useState<NewEvaluationFormulaire>(EMPTY_FORM)
  const [editing, setEditing] = useState<EvaluationFormulaire | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evaluations, setEvaluations] = useState<EvaluationFormulaire[] | null>(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    try {
      setEvaluations(await listEvaluationsFormulaire())
    } catch (e) {
      setError((e as Error).message)
      setEvaluations([])
    }
  }

  function set<K extends keyof NewEvaluationFormulaire>(key: K, value: NewEvaluationFormulaire[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setFamille(famille: string) {
    // Les critères dépendent de la famille — on repart d'une grille vierge en changeant de famille.
    setForm((f) => ({ ...f, famille, criteres: {}, moyenne: null }))
  }

  function setCritere(label: string, value: number | null) {
    setForm((f) => {
      const criteres = { ...f.criteres, [label]: value }
      return { ...f, criteres, moyenne: moyenneCriteres(criteres) }
    })
  }

  function resetForm() {
    setForm((f) => ({ ...EMPTY_FORM, numeroChantier: f.numeroChantier, nomChantier: f.nomChantier, evaluateur: f.evaluateur }))
    setEditing(null)
  }

  function handleEdit(e: EvaluationFormulaire) {
    setForm({
      famille: e.famille,
      fournisseurId: e.fournisseurId,
      fournisseurNom: e.fournisseurNom,
      numeroChantier: e.numeroChantier,
      nomChantier: e.nomChantier,
      criteres: e.criteres,
      moyenne: e.moyenne,
      remarques: e.remarques,
      evaluateur: e.evaluateur,
    })
    setEditing(e)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    if (!form.fournisseurNom.trim()) {
      setError('Choisissez un fournisseur avant d’enregistrer.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        const updated = await updateEvaluationFormulaire({ ...editing, ...form })
        setEvaluations((prev) => (prev ? prev.map((e) => (e.id === updated.id ? updated : e)) : prev))
      } else {
        const created = await createEvaluationFormulaire(form)
        setEvaluations((prev) => (prev ? [created, ...prev] : [created]))
      }
      resetForm()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette évaluation ?')) return
    try {
      await deleteEvaluationFormulaire(id)
      setEvaluations((prev) => (prev ? prev.filter((e) => e.id !== id) : prev))
      if (editing?.id === id) resetForm()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const criteres = criteresPourFamille(form.famille)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold">Formulaire d'évaluation</h2>
        <p className="text-sm text-slate-500 mt-1">
          Les critères affichés dépendent de la famille choisie (Fournisseurs, Sous-traitants, Transporteurs…), sur le
          même modèle que l'évaluation annuelle de référence. Vous pouvez enchaîner l'évaluation de plusieurs
          fournisseurs à la suite.
        </p>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="card space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Famille</label>
            <select className="input" value={form.famille} onChange={(e) => setFamille(e.target.value)}>
              {FAMILLES_EVALUATION.map((f) => (
                <option key={f.famille} value={f.famille}>
                  {f.famille}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fournisseur</label>
            <div className="flex gap-2">
              <input className="input bg-slate-50" readOnly value={form.fournisseurNom} placeholder="Aucun fournisseur choisi" />
              <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setPickerOpen(true)}>
                Choisir…
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">N° chantier</label>
            <input className="input" value={form.numeroChantier} onChange={(e) => set('numeroChantier', e.target.value)} />
          </div>
          <div>
            <label className="label">Nom du chantier</label>
            <input className="input" value={form.nomChantier} onChange={(e) => set('nomChantier', e.target.value)} />
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3 text-sm uppercase text-slate-500">
            Critères — {form.famille}
            {form.famille !== 'FOURNISSEURS' &&
              (form.famille === 'FOURNISSEURS (SANS FACTURATION DIRECTE)' || form.famille === 'MARCHANDS') && (
                <span className="normal-case font-normal text-slate-400"> (mêmes critères que Fournisseurs)</span>
              )}
          </h3>
          <div className="space-y-2">
            {criteres.map((label) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-sm">{label}</span>
                <NoteSelect value={form.criteres[label] ?? null} onChange={(v) => setCritere(label, v)} />
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm font-medium">Moyenne : {form.moyenne != null ? `${form.moyenne} / 4` : '—'}</div>
        </div>

        <div>
          <label className="label">Remarques</label>
          <textarea className="input min-h-[80px]" value={form.remarques} onChange={(e) => set('remarques', e.target.value)} />
        </div>

        <div>
          <label className="label">Évaluateur</label>
          <input className="input" value={form.evaluateur} onChange={(e) => set('evaluateur', e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
          <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
            {saving ? 'Enregistrement…' : editing ? 'Mettre à jour cette évaluation' : 'Enregistrer et évaluer un autre fournisseur'}
          </button>
          {editing && (
            <button className="btn-secondary" disabled={saving} onClick={resetForm}>
              Annuler la modification
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">Évaluations enregistrées{evaluations ? ` (${evaluations.length})` : ''}</h3>
        {!evaluations ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : evaluations.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune évaluation enregistrée pour l'instant.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {evaluations.map((e) => (
              <div key={e.id} className="py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-sm">
                    {e.fournisseurNom} <span className="text-xs text-slate-400 font-normal">— {e.famille}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {[e.numeroChantier, e.nomChantier].filter(Boolean).join(' — ') || 'Chantier non renseigné'}
                    {e.moyenne != null ? ` · Moyenne ${e.moyenne} / 4` : ''}
                    {e.evaluateur ? ` · ${e.evaluateur}` : ''}
                  </div>
                  {e.remarques && <div className="text-xs text-slate-400 mt-1">{e.remarques}</div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="text-xs text-indigo-600 hover:underline" onClick={() => handleEdit(e)}>
                    Modifier
                  </button>
                  <button className="text-xs text-red-600 hover:underline" onClick={() => handleDelete(e.id)}>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pickerOpen && (
        <SupplierPicker
          onSelect={(f) => {
            set('fournisseurId', f.id)
            set('fournisseurNom', f.nom)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

import { useState } from 'react'
import type { Lot } from '../types'
import { computeLot } from '../types'
import { ensureEvaluationForLot, updateLot } from '../data/db'
import { PRIORITE_OPTIONS, STATUT_LOT_OPTIONS, TYPE_ACHAT_OPTIONS, OUI_NON_OPTIONS, UNITE_OPTIONS } from '../data/lists'
import type { Fournisseur } from '../data/fournisseurs'
import SupplierPicker from './SupplierPicker'

function supplierLabel(f: Fournisseur): string {
  return [f.nom, [f.npa, f.lieu].filter(Boolean).join(' ')].filter(Boolean).join(' — ')
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly string[]
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value=""></option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function LotDetailPanel({
  lot,
  onClose,
  onSaved,
  onError,
}: {
  lot: Lot
  onClose: () => void
  onSaved: (lot: Lot) => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState<Lot>(lot)
  const [saving, setSaving] = useState(false)
  const [pickerFor, setPickerFor] = useState<'impose' | 'consulter' | 'choisi' | null>(null)

  function set<K extends keyof Lot>(key: K, value: Lot[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSupplierSelected(f: Fournisseur) {
    if (pickerFor === 'impose') {
      set('fournisseurImpose', supplierLabel(f))
    } else if (pickerFor === 'consulter') {
      const line = supplierLabel(f)
      set('fournisseursAConsulter', form.fournisseursAConsulter ? `${form.fournisseursAConsulter}\n${line}` : line)
    } else if (pickerFor === 'choisi') {
      set('fournisseurChoisi', f.nom)
    }
  }

  const computed = computeLot(form)

  async function handleSave() {
    setSaving(true)
    try {
      const saved = await updateLot(form)
      await ensureEvaluationForLot(saved)
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
          <h3 className="text-lg font-semibold">{form.familleLot || 'Nouveau lot'}</h3>
          <button className="btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>

        <section>
          <h4 className="font-semibold mb-3 text-sm uppercase text-slate-500">Identification & priorité</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="CFC / code" value={form.cfcCode} onChange={(v) => set('cfcCode', v)} />
            <TextField label="Famille / lot" value={form.familleLot} onChange={(v) => set('familleLot', v)} />
            <div className="sm:col-span-2">
              <label className="label">Description technique / variantes</label>
              <textarea
                className="input min-h-[80px]"
                value={form.descriptionTechnique}
                onChange={(e) => set('descriptionTechnique', e.target.value)}
              />
            </div>
            <SelectField label="Priorité" value={form.priorite} onChange={(v) => set('priorite', v)} options={PRIORITE_OPTIONS} />
            <SelectField label="Statut" value={form.statut} onChange={(v) => set('statut', v)} options={STATUT_LOT_OPTIONS} />
            <TextField label="Acheteur" value={form.acheteur} onChange={(v) => set('acheteur', v)} />
            <TextField label="Resp. travaux" value={form.respTravaux} onChange={(v) => set('respTravaux', v)} />
            <SelectField label="Type d'achat" value={form.typeAchat} onChange={(v) => set('typeAchat', v)} options={TYPE_ACHAT_OPTIONS} />
            <SelectField
              label="Mise en concurrence"
              value={form.miseEnConcurrence}
              onChange={(v) => set('miseEnConcurrence', v)}
              options={OUI_NON_OPTIONS}
            />
            <div>
              <label className="label">Fournisseur imposé</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={form.fournisseurImpose}
                  onChange={(e) => set('fournisseurImpose', e.target.value)}
                />
                <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setPickerFor('impose')}>
                  Rechercher
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Fournisseurs à consulter</label>
              <div className="flex gap-2">
                <textarea
                  className="input min-h-[60px] flex-1"
                  value={form.fournisseursAConsulter}
                  onChange={(e) => set('fournisseursAConsulter', e.target.value)}
                />
                <button type="button" className="btn-secondary whitespace-nowrap h-fit" onClick={() => setPickerFor('consulter')}>
                  + Ajouter
                </button>
              </div>
            </div>
            <div>
              <label className="label">Fournisseur choisi</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={form.fournisseurChoisi}
                  onChange={(e) => set('fournisseurChoisi', e.target.value)}
                />
                <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setPickerFor('choisi')}>
                  Rechercher
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Une fois renseigné, une évaluation fournisseur est automatiquement créée pour ce lot (onglet 4).
              </p>
            </div>
          </div>
        </section>

        <section>
          <h4 className="font-semibold mb-3 text-sm uppercase text-slate-500">Budget</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NumberField label="Budget CTX (CHF)" value={form.budgetCtx} onChange={(v) => set('budgetCtx', v)} />
            <NumberField label="Budget achat / BE (CHF)" value={form.budgetAchatBe} onChange={(v) => set('budgetAchatBe', v)} />
            <NumberField label="Déduction (%)" value={form.deductionPct} onChange={(v) => set('deductionPct', v)} />
            <NumberField label="Montant commande (CHF)" value={form.montantCommande} onChange={(v) => set('montantCommande', v)} />
            <NumberField label="Quantité" value={form.quantite} onChange={(v) => set('quantite', v)} />
            <SelectField label="Unité" value={form.unite} onChange={(v) => set('unite', v)} options={UNITE_OPTIONS} />
            <div>
              <label className="label">Budget net cible (calculé)</label>
              <div className="input bg-slate-50 text-slate-500">
                {computed.budgetNetCible != null ? computed.budgetNetCible.toLocaleString('fr-CH') + ' CHF' : '—'}
              </div>
            </div>
            <div>
              <label className="label">Écart budget (calculé)</label>
              <div className="input bg-slate-50 text-slate-500">
                {computed.ecartBudget != null ? computed.ecartBudget.toLocaleString('fr-CH') + ' CHF' : '—'}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h4 className="font-semibold mb-3 text-sm uppercase text-slate-500">Planning</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              label="Date remise besoin CTX"
              type="date"
              value={form.dateRemiseBesoinCtx}
              onChange={(v) => set('dateRemiseBesoinCtx', v)}
            />
            <TextField
              label="Préparation dossier"
              type="date"
              value={form.preparationDossier}
              onChange={(v) => set('preparationDossier', v)}
            />
            <TextField
              label="Lancement consultation"
              type="date"
              value={form.lancementConsultation}
              onChange={(v) => set('lancementConsultation', v)}
            />
            <TextField label="Retour offres" type="date" value={form.retourOffres} onChange={(v) => set('retourOffres', v)} />
            <TextField
              label="Choix fournisseur"
              type="date"
              value={form.choixFournisseur}
              onChange={(v) => set('choixFournisseur', v)}
            />
            <TextField label="Date commande" type="date" value={form.dateCommande} onChange={(v) => set('dateCommande', v)} />
            <TextField
              label="1re livraison"
              type="date"
              value={form.premiereLivraison}
              onChange={(v) => set('premiereLivraison', v)}
            />
            <TextField
              label="Dernière livraison"
              type="date"
              value={form.derniereLivraison}
              onChange={(v) => set('derniereLivraison', v)}
            />
            <div>
              <label className="label">Jours avant livraison (calculé)</label>
              <div className="input bg-slate-50 text-slate-500">{computed.joursAvantLivraison ?? '—'}</div>
            </div>
            <div>
              <label className="label">Délai / alerte (calculé)</label>
              <div className="input bg-slate-50 text-slate-500">{computed.delaiAlerte || '—'}</div>
            </div>
          </div>
        </section>

        <section>
          <h4 className="font-semibold mb-3 text-sm uppercase text-slate-500">Documents & suivi</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Documents / plans nécessaires</label>
              <textarea
                className="input min-h-[60px]"
                value={form.documentsPlansNecessaires}
                onChange={(e) => set('documentsPlansNecessaires', e.target.value)}
              />
            </div>
            <TextField label="Prochaine action" value={form.prochaineAction} onChange={(v) => set('prochaineAction', v)} />
            <div>
              <label className="label">Contrôle (calculé)</label>
              <div className="input bg-slate-50 text-slate-500">{computed.controle || '—'}</div>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Remarques / lien</label>
              <textarea
                className="input min-h-[60px]"
                value={form.remarquesLien}
                onChange={(e) => set('remarquesLien', e.target.value)}
              />
            </div>
          </div>
        </section>

        <div className="flex gap-2 pt-2 border-t border-slate-200">
          <button className="btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>

      {pickerFor && <SupplierPicker onSelect={handleSupplierSelected} onClose={() => setPickerFor(null)} />}
    </div>
  )
}

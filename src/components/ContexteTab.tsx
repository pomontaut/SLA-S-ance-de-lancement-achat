import { useState } from 'react'
import type { Acheteur, Dossier } from '../types'
import { updateDossier } from '../data/db'

function ListEditor({
  title,
  placeholder,
  items,
  onChange,
}: {
  title: string
  placeholder: string
  items: string[]
  onChange: (items: string[]) => void
}) {
  return (
    <div>
      <label className="label">{title}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input"
              value={item}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
            />
            <button className="btn-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn-secondary" onClick={() => onChange([...items, ''])}>
          + Ajouter une ligne
        </button>
      </div>
    </div>
  )
}

function AcheteursEditor({ items, onChange }: { items: Acheteur[]; onChange: (items: Acheteur[]) => void }) {
  return (
    <div>
      <label className="label">Légende des acheteurs (initiales → nom)</label>
      <div className="space-y-2">
        {items.map((a, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input w-20"
              value={a.initiales}
              placeholder="AD"
              onChange={(e) => {
                const next = [...items]
                next[i] = { ...next[i], initiales: e.target.value }
                onChange(next)
              }}
            />
            <input
              className="input"
              value={a.nom}
              placeholder="Anthony Dupont"
              onChange={(e) => {
                const next = [...items]
                next[i] = { ...next[i], nom: e.target.value }
                onChange(next)
              }}
            />
            <button className="btn-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn-secondary" onClick={() => onChange([...items, { initiales: '', nom: '' }])}>
          + Ajouter un acheteur
        </button>
      </div>
    </div>
  )
}

export default function ContexteTab({
  dossier,
  onChange,
}: {
  dossier: Dossier
  onChange: (dossier: Dossier) => void
}) {
  const [form, setForm] = useState<Dossier>(dossier)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof Dossier>(key: K, value: Dossier[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const saved = await updateDossier(form)
      setForm(saved)
      onChange(saved)
      setSavedAt(new Date())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card space-y-6">
      <section>
        <h3 className="font-semibold mb-3">Chantier</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">N° chantier</label>
            <input className="input" value={form.numeroChantier} onChange={(e) => set('numeroChantier', e.target.value)} />
          </div>
          <div>
            <label className="label">Adresse</label>
            <input className="input" value={form.adresse} onChange={(e) => set('adresse', e.target.value)} />
          </div>
          <div>
            <label className="label">Client</label>
            <input className="input" value={form.client} onChange={(e) => set('client', e.target.value)} />
          </div>
          <div>
            <label className="label">Architecte</label>
            <input className="input" value={form.architecte} onChange={(e) => set('architecte', e.target.value)} />
          </div>
          <div>
            <label className="label">Ingénieur civil</label>
            <input className="input" value={form.ingenieur} onChange={(e) => set('ingenieur', e.target.value)} />
          </div>
          <div>
            <label className="label">Conducteur de travaux</label>
            <input
              className="input"
              value={form.conducteurTravaux}
              onChange={(e) => set('conducteurTravaux', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Contremaître</label>
            <input className="input" value={form.contremaitre} onChange={(e) => set('contremaitre', e.target.value)} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-3">Typologie des travaux</h3>
        <textarea
          className="input min-h-[100px]"
          value={form.typologieTravaux}
          onChange={(e) => set('typologieTravaux', e.target.value)}
          placeholder="Description du type de travaux, surfaces, quantités principales…"
        />
      </section>

      <section>
        <h3 className="font-semibold mb-3">Planning</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Démarrage des travaux</label>
            <input
              className="input"
              value={form.planningDemarrage}
              onChange={(e) => set('planningDemarrage', e.target.value)}
              placeholder="18.05.2026"
            />
          </div>
          <div>
            <label className="label">Fin des travaux / durée</label>
            <input
              className="input"
              value={form.planningFin}
              onChange={(e) => set('planningFin', e.target.value)}
              placeholder="Fin janvier 2027"
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-3">Conditions contractuelles</h3>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="label">Conditions (forfait, révisable…)</label>
            <input className="input" value={form.conditions} onChange={(e) => set('conditions', e.target.value)} />
          </div>
          <div>
            <label className="label">Garanties</label>
            <input className="input" value={form.garanties} onChange={(e) => set('garanties', e.target.value)} />
          </div>
          <div>
            <label className="label">Déductions contractuelles</label>
            <input
              className="input"
              value={form.deductionsContractuelles}
              onChange={(e) => set('deductionsContractuelles', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section>
        <ListEditor
          title="Documents à disposition"
          placeholder="Dossier étude : M:\... ou lien GED"
          items={form.documentsDisposition}
          onChange={(items) => set('documentsDisposition', items)}
        />
      </section>

      <section>
        <ListEditor
          title="Particularités du projet"
          placeholder="Ex. pas de grue au démarrage, zone de stockage limitée…"
          items={form.particularites}
          onChange={(items) => set('particularites', items)}
        />
      </section>

      <section>
        <AcheteursEditor items={form.acheteurs} onChange={(items) => set('acheteurs', items)} />
      </section>

      {error && <div className="text-sm text-red-600">Erreur : {error}</div>}

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {savedAt && <span className="text-xs text-slate-400">Enregistré à {savedAt.toLocaleTimeString('fr-CH')}</span>}
      </div>
    </div>
  )
}

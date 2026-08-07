import { useEffect, useState } from 'react'
import type { Dossier } from '../types'
import { computeLot } from '../types'
import { updateDossier, listLots, listChecklistItems } from '../data/db'
import { FICHE_SECTIONS } from '../data/ficheFields'
import { CHECKLIST_DOCUMENTS_STATUT_EN_ATTENTE } from '../data/lists'

interface Indicators {
  lotsRenseignes: number
  lotsUrgents: number
  lotsACompleter: number
  documentsEnAttente: number
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="card text-center py-4">
      <div className="text-2xl font-bold text-indigo-600">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}

export default function FicheChantierTab({
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
  const [indicators, setIndicators] = useState<Indicators | null>(null)
  const [openSection, setOpenSection] = useState<string>(FICHE_SECTIONS[0].id)

  useEffect(() => {
    Promise.all([listLots(dossier.id), listChecklistItems(dossier.id)])
      .then(([lots, items]) => {
        const computed = lots.map(computeLot)
        setIndicators({
          lotsRenseignes: lots.filter((l) => l.familleLot).length,
          lotsUrgents: lots.filter((l) => l.priorite === 'Critique' || l.priorite === 'Haute').length,
          lotsACompleter: computed.filter((c) => c.controle === 'À compléter').length,
          documentsEnAttente: items.filter((i) =>
            (CHECKLIST_DOCUMENTS_STATUT_EN_ATTENTE as readonly string[]).includes(i.statut),
          ).length,
        })
      })
      .catch(() => setIndicators(null))
  }, [dossier.id])

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, fiche: { ...f.fiche, [key]: value } }))
  }

  function setTop<K extends 'numeroChantier' | 'adresse' | 'client'>(key: K, value: string) {
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
    <div className="space-y-4">
      {indicators && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Lots renseignés" value={indicators.lotsRenseignes} />
          <StatTile label="Lots urgents" value={indicators.lotsUrgents} />
          <StatTile label="Lots à compléter" value={indicators.lotsACompleter} />
          <StatTile label="Documents en attente" value={indicators.documentsEnAttente} />
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold mb-3">Identifiants principaux</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">N° chantier</label>
            <input className="input" value={form.numeroChantier} onChange={(e) => setTop('numeroChantier', e.target.value)} />
          </div>
          <div>
            <label className="label">Adresse</label>
            <input className="input" value={form.adresse} onChange={(e) => setTop('adresse', e.target.value)} />
          </div>
          <div>
            <label className="label">Client</label>
            <input className="input" value={form.client} onChange={(e) => setTop('client', e.target.value)} />
          </div>
        </div>
      </div>

      {FICHE_SECTIONS.map((section) => (
        <div key={section.id} className="card">
          <button
            className="w-full flex items-center justify-between text-left font-semibold"
            onClick={() => setOpenSection(openSection === section.id ? '' : section.id)}
          >
            {section.title}
            <span className="text-slate-400">{openSection === section.id ? '▲' : '▼'}</span>
          </button>
          {openSection === section.id && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {section.fields.map((field) => (
                <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <label className="label">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="input min-h-[80px]"
                      value={form.fiche[field.key] ?? ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                    />
                  ) : (
                    <input
                      className="input"
                      type={field.type === 'date' ? 'date' : 'text'}
                      value={form.fiche[field.key] ?? ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

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

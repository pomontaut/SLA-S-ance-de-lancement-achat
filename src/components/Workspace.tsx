import { useEffect, useState } from 'react'
import type { Dossier } from '../types'
import { deleteDossier, getDossier } from '../data/db'
import FicheChantierTab from './FicheChantierTab'
import ChecklistTab from './ChecklistTab'
import SuiviHaTab from './SuiviHaTab'
import EvaluationTab from './EvaluationTab'

type TabKey = 'fiche' | 'checklist' | 'suivi' | 'evaluation'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'fiche', label: '1. Fiche chantier' },
  { key: 'checklist', label: '2. Checklist documents' },
  { key: 'suivi', label: '3. Suivi HA' },
  { key: 'evaluation', label: '4. Évaluation fournisseur' },
]

export default function Workspace({ dossierId, onBack }: { dossierId: string; onBack: () => void }) {
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [tab, setTab] = useState<TabKey>('fiche')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDossier(dossierId)
      .then(setDossier)
      .catch((e) => setError((e as Error).message))
  }, [dossierId])

  async function handleDelete() {
    if (!dossier) return
    if (!confirm('Supprimer définitivement ce dossier, sa checklist, sa grille d\'achats et ses évaluations ?')) return
    await deleteDossier(dossier.id)
    onBack()
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card border-red-300 bg-red-50 text-sm text-red-700">Erreur : {error}</div>
        <button className="btn-secondary mt-4" onClick={onBack}>
          ← Retour
        </button>
      </div>
    )
  }

  if (!dossier) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-sm text-slate-500">Chargement…</div>
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <button className="btn-secondary" onClick={onBack}>
          ← Tous les dossiers
        </button>
        <div className="text-right">
          <div className="font-semibold">
            {dossier.numeroChantier || 'Sans numéro'} — {dossier.adresse}
          </div>
          <div className="text-sm text-slate-500">{dossier.client}</div>
        </div>
        <button className="btn-danger" onClick={handleDelete}>
          Supprimer
        </button>
      </div>

      <div className="border-b border-slate-200 flex mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-button ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fiche' && <FicheChantierTab dossier={dossier} onChange={setDossier} />}
      {tab === 'checklist' && <ChecklistTab dossier={dossier} />}
      {tab === 'suivi' && <SuiviHaTab dossier={dossier} />}
      {tab === 'evaluation' && <EvaluationTab dossier={dossier} />}
    </div>
  )
}

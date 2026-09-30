import { useState } from 'react'
import type { Dossier } from './types'
import { isSupabaseConfigured } from './lib/supabase'
import DossiersList from './components/DossiersList'
import Workspace from './components/Workspace'
import FournisseursAnnuaire from './components/FournisseursAnnuaire'
import EvaluationDashboard from './components/EvaluationDashboard'
import FormulaireEvaluationTab from './components/FormulaireEvaluationTab'

type View = 'dossiers' | 'fournisseurs' | 'dashboard' | 'formulaire'

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [openDossierId, setOpenDossierId] = useState<string | null>(null)

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-brand-from to-brand-to text-white px-6 py-5">
        {/* Titre temporairement renommé (bascule prévue plus tard vers "SLA — Séance de lancement achats") */}
        <h1 className="text-2xl font-bold">Dashboard Évaluation Fournisseur</h1>
        {/* Fournisseurs (annuaire) reste masqué de la navigation (fonctionnalité en pause) —
            Séance de lancement achats (Dossiers) remise temporairement visible sur demande. */}
        {!openDossierId && (
          <nav className="flex gap-4 mt-4">
            <button
              className={`text-sm font-medium pb-1 border-b-2 ${view === 'dashboard' ? 'border-white' : 'border-transparent text-white/70'}`}
              onClick={() => setView('dashboard')}
            >
              Dashboard évaluations
            </button>
            <button
              className={`text-sm font-medium pb-1 border-b-2 ${view === 'formulaire' ? 'border-white' : 'border-transparent text-white/70'}`}
              onClick={() => setView('formulaire')}
            >
              Formulaire d'évaluation
            </button>
            <button
              className={`text-sm font-medium pb-1 border-b-2 ${view === 'dossiers' ? 'border-white' : 'border-transparent text-white/70'}`}
              onClick={() => setView('dossiers')}
            >
              Séance de lancement achats
            </button>
          </nav>
        )}
      </header>

      {!isSupabaseConfigured ? (
        <div className="max-w-2xl mx-auto mt-10 px-4">
          <div className="card border-amber-300 bg-amber-50">
            <h2 className="text-lg font-semibold mb-2">Configuration requise</h2>
            <p className="text-sm text-slate-700">
              Les variables d'environnement <code className="font-mono">VITE_SUPABASE_URL</code> et{' '}
              <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> ne sont pas définies. Copiez{' '}
              <code className="font-mono">.env.example</code> vers <code className="font-mono">.env</code> et
              renseignez les valeurs de votre projet Supabase (voir README).
            </p>
          </div>
        </div>
      ) : openDossierId ? (
        <Workspace dossierId={openDossierId} onBack={() => setOpenDossierId(null)} />
      ) : view === 'fournisseurs' ? (
        <FournisseursAnnuaire />
      ) : view === 'dashboard' ? (
        <EvaluationDashboard />
      ) : view === 'formulaire' ? (
        <FormulaireEvaluationTab />
      ) : (
        <DossiersList onOpen={setOpenDossierId} />
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Dossier, Profile } from './types'
import { isSupabaseConfigured } from './lib/supabase'
import { getSession, onAuthStateChange, signOut } from './lib/auth'
import { getMyProfile } from './data/db'
import { can, canViewDashboard } from './data/permissions'
import DossiersList from './components/DossiersList'
import Workspace from './components/Workspace'
import FournisseursAnnuaire from './components/FournisseursAnnuaire'
import EvaluationDashboard from './components/EvaluationDashboard'
import FormulaireEvaluationTab from './components/FormulaireEvaluationTab'
import AdminUsersTab from './components/AdminUsersTab'
import LoginScreen from './components/LoginScreen'

type View = 'dossiers' | 'fournisseurs' | 'dashboard' | 'formulaire' | 'admin'

// Fonctionnalités mises en pause indépendamment des droits par compte (voir historique de
// l'app) — repasser à true pour les rendre à nouveau accessibles aux comptes qui y ont droit.
const FEATURE_SEANCE_LANCEMENT_ENABLED = false
const FEATURE_FOURNISSEURS_ENABLED = false

function visibleViews(profile: Profile): View[] {
  const views: View[] = []
  if (canViewDashboard(profile)) views.push('dashboard')
  if (can(profile, 'canViewFormulaire')) views.push('formulaire')
  if (FEATURE_SEANCE_LANCEMENT_ENABLED && can(profile, 'canViewSeanceLancement')) views.push('dossiers')
  if (FEATURE_FOURNISSEURS_ENABLED && can(profile, 'canViewFournisseurs')) views.push('fournisseurs')
  if (profile.isAdmin) views.push('admin')
  return views
}

const VIEW_LABELS: Record<View, string> = {
  dashboard: 'Dashboard évaluations',
  formulaire: "Formulaire d'évaluation",
  dossiers: 'Séance de lancement achats',
  fournisseurs: 'Fournisseurs',
  admin: 'Administration',
}

export default function App() {
  const [sessionLoading, setSessionLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [openDossierId, setOpenDossierId] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSessionLoading(false)
      return
    }
    getSession()
      .then(setSession)
      .finally(() => setSessionLoading(false))
    return onAuthStateChange((s) => {
      setSession(s)
      if (!s) {
        setProfile(null)
        setView(null)
      }
    })
  }, [])

  useEffect(() => {
    if (!session) return
    getMyProfile(session.user.id)
      .then((p) => {
        setProfile(p)
        if (p) setView(visibleViews(p)[0] ?? null)
      })
      .catch((e) => setProfileError((e as Error).message))
  }, [session])

  async function handleSignOut() {
    await signOut()
    setSession(null)
    setProfile(null)
    setView(null)
    setOpenDossierId(null)
  }

  const allowed = profile ? visibleViews(profile) : []

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-brand-from to-brand-to text-white px-6 py-5">
        {/* Titre temporairement renommé (bascule prévue plus tard vers "SLA — Séance de lancement achats") */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Dashboard Évaluation Fournisseur</h1>
          {session && (
            <div className="flex items-center gap-3 text-sm text-white/90">
              <span>{profile?.fullName || session.user.email}</span>
              <button className="text-white/80 hover:text-white underline" onClick={handleSignOut}>
                Se déconnecter
              </button>
            </div>
          )}
        </div>
        {!openDossierId && profile && (
          <nav className="flex gap-4 mt-4">
            {allowed.map((v) => (
              <button
                key={v}
                className={`text-sm font-medium pb-1 border-b-2 ${view === v ? 'border-white' : 'border-transparent text-white/70'}`}
                onClick={() => setView(v)}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
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
      ) : sessionLoading ? (
        <p className="text-sm text-slate-500 text-center mt-10">Chargement…</p>
      ) : !session ? (
        <LoginScreen />
      ) : profileError ? (
        <div className="max-w-2xl mx-auto mt-10 px-4">
          <div className="card border-red-300 bg-red-50">
            <p className="text-sm text-red-700">Erreur lors du chargement de votre profil : {profileError}</p>
          </div>
        </div>
      ) : !profile ? (
        <p className="text-sm text-slate-500 text-center mt-10">Chargement de votre profil…</p>
      ) : allowed.length === 0 ? (
        <div className="max-w-md mx-auto mt-16 px-4">
          <div className="card text-center">
            <h2 className="text-lg font-semibold mb-2">Aucun accès pour l'instant</h2>
            <p className="text-sm text-slate-600">
              Votre compte ({profile.email}) n'a pas encore de droit d'accès. Demandez à un administrateur de vous en
              attribuer.
            </p>
          </div>
        </div>
      ) : openDossierId ? (
        <Workspace dossierId={openDossierId} onBack={() => setOpenDossierId(null)} />
      ) : view === 'fournisseurs' ? (
        <FournisseursAnnuaire />
      ) : view === 'dashboard' ? (
        <EvaluationDashboard profile={profile} />
      ) : view === 'formulaire' ? (
        <FormulaireEvaluationTab />
      ) : view === 'admin' ? (
        <AdminUsersTab />
      ) : view === 'dossiers' ? (
        <DossiersList onOpen={setOpenDossierId} />
      ) : null}
    </div>
  )
}

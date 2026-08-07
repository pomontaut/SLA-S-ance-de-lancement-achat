import { useState } from 'react'
import type { Dossier } from './types'
import { isSupabaseConfigured } from './lib/supabase'
import { diagnoseEnvVar } from './lib/envDiagnostics'
import DossiersList from './components/DossiersList'
import Workspace from './components/Workspace'

const diagnostics = [
  diagnoseEnvVar('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  diagnoseEnvVar('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY),
].filter((d) => d.badChars.length > 0)

export default function App() {
  const [openDossierId, setOpenDossierId] = useState<string | null>(null)

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-brand-from to-brand-to text-white px-6 py-5">
        <h1 className="text-2xl font-bold">SLA — Séance de lancement achats</h1>
        <p className="text-sm text-white/80 mt-1">
          Dossier de passation achat, de la phase soumission à la phase exécution
        </p>
      </header>

      {diagnostics.length > 0 && (
        <div className="max-w-2xl mx-auto mt-10 px-4">
          <div className="card border-red-300 bg-red-50 text-sm text-red-800 space-y-2">
            <h2 className="text-lg font-semibold">Caractère invalide détecté dans la configuration</h2>
            {diagnostics.map((d) => (
              <div key={d.name}>
                <div className="font-mono font-semibold">{d.name}</div>
                <div>Longueur : {d.length} caractères</div>
                <div>
                  Début : {d.firstChars} — Fin : {d.lastChars}
                </div>
                <div>
                  Caractère(s) invalide(s) :{' '}
                  {d.badChars.map((b) => `position ${b.index} = ${b.hex}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
      ) : (
        <DossiersList onOpen={setOpenDossierId} />
      )}
    </div>
  )
}

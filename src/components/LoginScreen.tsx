import { useState } from 'react'
import type { FormEvent } from 'react'
import { EMAIL_DOMAIN, signIn, signUp } from '../lib/auth'

export default function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupDone, setSignupDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        await signUp(email, password, fullName)
        setSignupDone(true)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (signupDone) {
    return (
      <div className="max-w-md mx-auto mt-16 px-4">
        <div className="card text-center">
          <h2 className="text-lg font-semibold mb-2">Compte créé</h2>
          <p className="text-sm text-slate-600">
            Vérifiez votre boîte mail ({email}) pour confirmer votre adresse, puis connectez-vous. Un administrateur
            doit ensuite vous donner accès aux onglets nécessaires — vous ne verrez rien tant que ce n'est pas fait.
          </p>
          <button
            className="btn-secondary mt-4"
            onClick={() => {
              setSignupDone(false)
              setMode('signin')
            }}
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">{mode === 'signin' ? 'Connexion' : 'Créer un compte'}</h2>
        <p className="text-sm text-slate-500 mb-4">Dashboard Évaluation Fournisseur — accès réservé aux comptes Induni.</p>

        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="label">Nom complet</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label">E-mail</label>
            <input
              className="input"
              type="email"
              placeholder={`prenom.nom${EMAIL_DOMAIN}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <button className="btn-primary w-full justify-center" type="submit" disabled={loading}>
            {loading ? 'Veuillez patienter…' : mode === 'signin' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>

        <button
          className="text-xs text-indigo-600 hover:underline mt-4"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
          }}
        >
          {mode === 'signin' ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>
  )
}

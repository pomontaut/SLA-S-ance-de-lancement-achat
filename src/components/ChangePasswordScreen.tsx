import { useState } from 'react'
import type { FormEvent } from 'react'
import { setOwnPassword, signOut } from '../lib/auth'

/** Écran imposé à la première connexion (compte créé par un administrateur avec mot de passe
 * temporaire : `user_metadata.must_change_password`). */
export default function ChangePasswordScreen({ email, onDone }: { email: string; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères.')
    if (password !== confirm) return setError('Les deux mots de passe ne sont pas identiques.')
    if (/^Induni-/.test(password)) return setError('Choisissez un mot de passe différent du mot de passe temporaire.')
    setLoading(true)
    try {
      await setOwnPassword(password)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">Choisissez votre mot de passe</h2>
        <p className="text-sm text-slate-500 mb-4">
          Première connexion de {email} : remplacez le mot de passe temporaire reçu par e-mail par le vôtre.
        </p>
        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
        {error?.includes('session a expiré') && (
          <button type="button" className="btn-secondary w-full justify-center mb-3" onClick={() => signOut()}>
            Retour à la connexion
          </button>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Nouveau mot de passe</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoFocus />
          </div>
          <div>
            <label className="label">Confirmer le mot de passe</label>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
          </div>
          <button className="btn-primary w-full justify-center" type="submit" disabled={loading}>
            {loading ? 'Veuillez patienter…' : 'Enregistrer et continuer'}
          </button>
        </form>
      </div>
    </div>
  )
}

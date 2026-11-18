import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

function requireClient() {
  if (!supabase) throw new Error('Supabase non configuré (variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes).')
  return supabase
}

/** Compte interne Induni uniquement — même règle que le formulaire d'inscription ESHOP-INDUNI. */
export const EMAIL_DOMAIN = '@induni.ch'

export function isInduniEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(EMAIL_DOMAIN)
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await requireClient().auth.getSession()
  if (error) throw error
  return data.session
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data } = requireClient().auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
}

export async function signUp(email: string, password: string, fullName: string): Promise<void> {
  if (!isInduniEmail(email)) {
    throw new Error(`Seules les adresses ${EMAIL_DOMAIN} peuvent créer un compte.`)
  }
  const { error } = await requireClient().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw error
}

/** Remplace le mot de passe temporaire et lève l'obligation de le changer (`must_change_password`). */
export async function setOwnPassword(password: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.auth.updateUser({ password, data: { must_change_password: false } })
  if (error) {
    // « Auth session missing » : la session n'est plus valide côté serveur (mot de passe temporaire
    // régénéré par un administrateur, session expirée…).
    if (/session/i.test(error.message)) {
      throw new Error(
        'Votre session a expiré. Reconnectez-vous avec le DERNIER mot de passe temporaire reçu par e-mail (chaque « Renvoyer le lien » en génère un nouveau), puis choisissez votre mot de passe.',
      )
    }
    throw error
  }
}

export async function signOut(): Promise<void> {
  const { error } = await requireClient().auth.signOut()
  if (error) throw error
}

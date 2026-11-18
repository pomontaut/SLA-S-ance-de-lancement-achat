import type { PermissionKey } from '../types'
import { supabase } from './supabase'

function requireClient() {
  if (!supabase) throw new Error('Supabase non configuré (variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes).')
  return supabase
}

/** Appelle l'Edge Function "admin-users" (seul endroit autorisé à utiliser la clé service_role,
 * car elle tourne côté serveur) — voir supabase/functions/admin-users/index.ts. */
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireClient().functions.invoke('admin-users', { body })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as T
}

export interface CreateUserInput {
  fullName: string
  email: string
  password: string
  isAdmin: boolean
  adminConfirmationCode?: string
  permissions: Partial<Record<PermissionKey, boolean>>
}

/** `emailSent` : l'e-mail (lien + mot de passe temporaire) est parti automatiquement. */
export async function createUserAccount(input: CreateUserInput): Promise<{ emailSent: boolean }> {
  const result = await invoke<{ emailSent?: boolean }>({
    action: 'create',
    fullName: input.fullName,
    email: input.email,
    password: input.password,
    isAdmin: input.isAdmin,
    adminConfirmationCode: input.adminConfirmationCode,
    ...input.permissions,
  })
  return { emailSent: Boolean(result?.emailSent) }
}

/** Retourne le nouveau mot de passe généré (affiché à l'administrateur pour le communiquer à la
 * personne — pas d'envoi d'e-mail automatique, voir la note dans AdminUsersTab). */
export async function resetUserPassword(userId: string): Promise<string> {
  const result = await invoke<{ password: string }>({ action: 'reset_password', userId })
  return result.password
}

/** « Renvoyer le lien » : génère un nouveau mot de passe temporaire et renvoie l'e-mail d'accès
 * (lien de l'app + mot de passe). Le mot de passe est aussi retourné pour être communiqué à la main
 * si l'envoi échoue. */
export async function resendUserInvite(userId: string): Promise<{ password: string; emailSent: boolean; emailError: string | null }> {
  const result = await invoke<{ password: string; emailSent?: boolean; emailError?: string | null }>({
    action: 'reset_password',
    userId,
    sendEmail: true,
  })
  return { password: result.password, emailSent: Boolean(result.emailSent), emailError: result.emailError ?? null }
}

export async function deleteUserAccount(userId: string): Promise<void> {
  await invoke({ action: 'delete', userId })
}

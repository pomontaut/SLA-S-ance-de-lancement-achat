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

export async function createUserAccount(input: CreateUserInput): Promise<void> {
  await invoke({
    action: 'create',
    fullName: input.fullName,
    email: input.email,
    password: input.password,
    isAdmin: input.isAdmin,
    adminConfirmationCode: input.adminConfirmationCode,
    ...input.permissions,
  })
}

/** Retourne le nouveau mot de passe généré (affiché à l'administrateur pour le communiquer à la
 * personne — pas d'envoi d'e-mail automatique, voir la note dans AdminUsersTab). */
export async function resetUserPassword(userId: string): Promise<string> {
  const result = await invoke<{ password: string }>({ action: 'reset_password', userId })
  return result.password
}

export async function deleteUserAccount(userId: string): Promise<void> {
  await invoke({ action: 'delete', userId })
}

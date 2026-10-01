import type { PermissionKey, Profile } from '../types'

export interface PermissionDef {
  key: PermissionKey
  label: string
  /** Regroupement visuel dans l'écran Administration. */
  groupe: string
}

/** Même garde-fou que la fonction SQL is_admin() et PERMANENT_ADMIN_EMAILS côté ESHOP-INDUNI :
 * reste administrateur même si sa ligne `profiles` est absente ou mal configurée. */
const PERMANENT_ADMIN_EMAILS = ['pomontaut@induni.ch']

export function isAdminProfile(profile: Profile | null): boolean {
  if (!profile) return false
  return profile.isAdmin || PERMANENT_ADMIN_EMAILS.includes(profile.email.toLowerCase())
}

// L'ordre reflète la navigation de l'app : d'abord les sous-onglets du Dashboard évaluations,
// puis les autres onglets de premier niveau.
export const PERMISSIONS: PermissionDef[] = [
  { key: 'canViewOverview', label: "Vue d'ensemble", groupe: 'Dashboard évaluations' },
  { key: 'canViewSecteur', label: 'Par secteur', groupe: 'Dashboard évaluations' },
  { key: 'canViewComparaison', label: 'Comparaison secteurs', groupe: 'Dashboard évaluations' },
  { key: 'canViewDepense', label: '💰 Analyse de la dépense', groupe: 'Dashboard évaluations' },
  { key: 'canViewConsortium', label: 'Consortium', groupe: 'Dashboard évaluations' },
  { key: 'canViewBlacklist', label: '🚫 Blacklist', groupe: 'Dashboard évaluations' },
  { key: 'canViewFormulaire', label: "Formulaire d'évaluation", groupe: 'Autres onglets' },
  { key: 'canViewSeanceLancement', label: 'Séance de lancement achats', groupe: 'Autres onglets' },
  { key: 'canViewFournisseurs', label: 'Fournisseurs (annuaire)', groupe: 'Autres onglets' },
]

/** true si le profil peut voir cet onglet — un admin voit toujours tout. */
export function can(profile: Profile | null, key: PermissionKey): boolean {
  if (!profile) return false
  return isAdminProfile(profile) || profile[key]
}

/** true si le profil a au moins un droit parmi les sous-onglets du Dashboard évaluations —
 * détermine si l'onglet de premier niveau "Dashboard évaluations" doit apparaître du tout. */
export function canViewDashboard(profile: Profile | null): boolean {
  if (!profile) return false
  if (isAdminProfile(profile)) return true
  return (
    profile.canViewOverview ||
    profile.canViewSecteur ||
    profile.canViewComparaison ||
    profile.canViewDepense ||
    profile.canViewConsortium ||
    profile.canViewBlacklist
  )
}

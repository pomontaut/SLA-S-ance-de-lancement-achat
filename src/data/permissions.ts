import type { PermissionKey, Profile } from '../types'

/** Même garde-fou que la fonction SQL is_admin() et PERMANENT_ADMIN_EMAILS côté ESHOP-INDUNI :
 * reste administrateur même si sa ligne `profiles` est absente ou mal configurée. */
const PERMANENT_ADMIN_EMAILS = ['pomontaut@induni.ch']

export function isAdminProfile(profile: Profile | null): boolean {
  if (!profile) return false
  return profile.isAdmin || PERMANENT_ADMIN_EMAILS.includes(profile.email.toLowerCase())
}

// ---- Structure de l'app : sections (onglets du haut) > sous-sections (onglets du dessous) ---------------
// Chaque sous-section a son propre droit ; une section est visible si au moins une de ses sous-sections
// l'est. L'administration (comptes et accès) est réservée aux administrateurs.

export type SectionKey = 'evaluation' | 'depense' | 'bfa'

export type SousSectionView =
  | 'overview'
  | 'secteur'
  | 'comparaison'
  | 'blacklist'
  | 'zoomEvaluation'
  | 'formulaire'
  | 'depense'
  | 'chantiers'
  | 'consortium'
  | 'synthese'
  | 'analyseFournisseurs'
  | 'paiement'
  | 'zoomFournisseur'
  | 'bfa'

export interface SousSectionDef {
  view: SousSectionView
  label: string
  permission: PermissionKey
}

export interface SectionDef {
  key: SectionKey
  label: string
  subs: SousSectionDef[]
}

export const SECTIONS: SectionDef[] = [
  {
    key: 'evaluation',
    label: 'Évaluation',
    subs: [
      { view: 'overview', label: "📊 Vue d'ensemble", permission: 'canViewOverview' },
      { view: 'secteur', label: '🏭 Analyse par secteur', permission: 'canViewSecteur' },
      { view: 'comparaison', label: '⚖️ Comparaison des secteurs', permission: 'canViewComparaison' },
      { view: 'zoomEvaluation', label: '🔍 Zoom fournisseur', permission: 'canViewZoomEvaluation' },
      { view: 'blacklist', label: '🚫 Blacklist', permission: 'canViewBlacklist' },
      { view: 'formulaire', label: "📝 Formulaire d'évaluation", permission: 'canViewFormulaire' },
    ],
  },
  {
    key: 'depense',
    label: 'Analyse Dépense',
    // Ordre logique : où en est-on ? (synthèse) > d'où vient la dépense ? > avec qui ? > sur quels chantiers ? > comment paie-t-on ? > détail.
    subs: [
      { view: 'synthese', label: '📊 Synthèse', permission: 'canViewSynthese' },
      { view: 'depense', label: '💰 Analyse de la dépense', permission: 'canViewDepense' },
      { view: 'analyseFournisseurs', label: '🏢 Analyse fournisseurs', permission: 'canViewAnalyseFournisseurs' },
      { view: 'chantiers', label: '🏗 Analyse chantier', permission: 'canViewChantiers' },
      { view: 'paiement', label: '💳 Paiement', permission: 'canViewPaiement' },
      { view: 'consortium', label: 'Consortium', permission: 'canViewConsortium' },
      { view: 'zoomFournisseur', label: '🔍 Zoom fournisseur', permission: 'canViewZoomFournisseur' },
    ],
  },
  {
    key: 'bfa',
    label: 'Suivi BFA',
    subs: [{ view: 'bfa', label: 'Suivi BFA', permission: 'canViewBfa' }],
  },
]

export interface PermissionDef {
  key: PermissionKey
  label: string
  /** Regroupement visuel dans l'écran Administration (nom de la section). */
  groupe: string
  /** Clé de la section ('pause' = fonctionnalités actuellement désactivées dans l'app). */
  section: SectionKey | 'pause'
}

export const PERMISSIONS: PermissionDef[] = [
  ...SECTIONS.flatMap((sec) => sec.subs.map((sub) => ({ key: sub.permission, label: sub.label, groupe: sec.label, section: sec.key }))),
  // Fonctionnalités mises en pause (voir FEATURE_* dans App.tsx) : droits conservés en base.
  { key: 'canViewSeanceLancement', label: 'Séance de lancement achats', groupe: 'En pause', section: 'pause' },
  { key: 'canViewFournisseurs', label: 'Fournisseurs (annuaire)', groupe: 'En pause', section: 'pause' },
]

/** true si le profil peut voir cette sous-section — un admin voit toujours tout. */
export function can(profile: Profile | null, key: PermissionKey): boolean {
  if (!profile) return false
  return isAdminProfile(profile) || profile[key]
}

/** Sous-sections visibles pour ce profil dans une section. */
export function visibleSubs(profile: Profile | null, section: SectionKey): SousSectionDef[] {
  const sec = SECTIONS.find((s) => s.key === section)
  return sec ? sec.subs.filter((sub) => can(profile, sub.permission)) : []
}

/** Une section est visible si au moins une de ses sous-sections l'est. */
export function canViewSection(profile: Profile | null, section: SectionKey): boolean {
  return visibleSubs(profile, section).length > 0
}

// ============ Analyse de la dépense (Journal COFI) ============
//
// Source : export comptable "Journal COFI Compilé" (32 706 lignes, ~2025), une ligne = un
// document (facture ou note de crédit) déjà résolu à la position comptable. Le montant à
// utiliser pour toute analyse de dépense est `montant` (colonne "Montant pos." du fichier
// source), et NON le montant du document brut, qui peut inclure des allocations/regroupements
// ne correspondant pas à la dépense réelle imputée à cette ligne.
//
// Échéance de paiement estimée = Date doc + nombre de jours extrait de la condition de paiement
// (ex. "30 JOURS NET" → 30 jours). C'est une approximation : les conditions avec escompte
// (ex. "30 JOURS 2%") ne précisent pas toujours le délai net réel dans ce fichier, seul le délai
// d'escompte est exploitable. À vérifier avec le service comptable si le taux de retard constaté
// semble anormalement élevé.

export interface DepenseBucketStats {
  montantTotal: number
  nbDocuments: number
  nbFactures: number
  montantFactures: number
  nbNotesCredit: number
  montantNotesCredit: number
  nbPayees: number
  montantPayees?: number
  nbEnAttente: number
  montantEnAttente: number
  nbATemps: number
  montantATemps: number
  nbEnRetard: number
  montantEnRetard: number
  retardMoyenJours: number | null
  nbFournisseurs?: number
}

export interface DepenseChantierStats extends DepenseBucketStats {
  /** Code "SECT Débit" du journal comptable — utilisé comme identifiant de chantier (pas de nom
   * de chantier disponible dans ce fichier, seulement un code de compte). */
  code: string
}

export interface DepensesGlobal {
  global: DepenseBucketStats
  chantier: DepenseBucketStats
  consortium: DepenseBucketStats
  parEntite: Record<string, DepenseBucketStats>
  /** Top 60 chantiers (codes "SECT Débit") par montant, sur ~224 codes distincts au total. */
  parChantier: DepenseChantierStats[]
  nbChantiers: number
  top20Fournisseurs: { nfr: number; nom: string; montant: number }[]
}

export interface DepenseDocument {
  docno: number
  dateDoc: string | null
  datePaiement: string | null
  dateEcheance: string | null
  genre: string
  condition: string | null
  entite: string | null
  /** Code du chantier (colonne "SECT Débit"). */
  chantier: string | null
  aff: 'CHANTIER INDUNI' | 'CONSORTIUM'
  montant: number | null
  ref: string | null
  enRetard: boolean
}

export interface DepenseFournisseur {
  nfr: number
  nom: string
  global: DepenseBucketStats
  chantierMontant: number
  consortiumMontant: number
  parEntite: Record<string, DepenseBucketStats>
  parChantier: Record<string, DepenseBucketStats>
  conditions: string[]
  documents: DepenseDocument[]
}

let globalCache: DepensesGlobal | null = null
let globalPending: Promise<DepensesGlobal> | null = null

export function loadDepensesGlobal(): Promise<DepensesGlobal> {
  if (globalCache) return Promise.resolve(globalCache)
  if (!globalPending) {
    globalPending = import('./depensesGlobal.json').then((mod) => {
      globalCache = mod.default as unknown as DepensesGlobal
      return globalCache
    })
  }
  return globalPending
}

let fournisseursCache: DepenseFournisseur[] | null = null
let fournisseursPending: Promise<DepenseFournisseur[]> | null = null

export function loadDepensesFournisseurs(): Promise<DepenseFournisseur[]> {
  if (fournisseursCache) return Promise.resolve(fournisseursCache)
  if (!fournisseursPending) {
    fournisseursPending = import('./depensesFournisseurs.json').then((mod) => {
      fournisseursCache = mod.default as unknown as DepenseFournisseur[]
      return fournisseursCache
    })
  }
  return fournisseursPending
}

function normNomDepense(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-'.,&()]/g, '')
    .toUpperCase()
}

/** Les noms du journal COFI sont tronqués à ~16-20 caractères (export SAP) — la correspondance
 * avec les noms complets utilisés ailleurs dans le dashboard (évaluations, blacklist) se fait
 * donc par préfixe sur le nom normalisé plutôt que par égalité stricte. */
export function findDepenseFournisseur(fournisseurs: DepenseFournisseur[], nom: string): DepenseFournisseur | null {
  const n = normNomDepense(nom)
  let best: DepenseFournisseur | null = null
  for (const f of fournisseurs) {
    const fn = normNomDepense(f.nom)
    if (fn === n) return f
    if ((fn.length >= 6 && n.startsWith(fn)) || (n.length >= 6 && fn.startsWith(n))) {
      if (!best || f.nom.length > best.nom.length) best = f
    }
  }
  return best
}

export function formatCurrency(v: number | null | undefined): string {
  return v == null ? 'Non disponible' : Math.round(v).toLocaleString('fr-CH') + ' CHF'
}

export function pct(part: number, total: number): number | null {
  if (!total) return null
  return Math.round((part / total) * 1000) / 10
}

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
  /** Code "SECT Débit" du journal comptable — utilisé comme identifiant de chantier. */
  code: string
  /** Nom du chantier, depuis le fichier "Chantiers.xlsx" (colonne B, format "N°-Nom") —
   * null si le code n'a pas été retrouvé dans ce référentiel (157/224 chantiers matchés). */
  nom: string | null
  /** Chantier consortium ou non, depuis la colonne "Chantier consortium" (Q) de ce même
   * fichier — null si non retrouvé. Cet indicateur, au niveau du chantier, ne coïncide pas
   * toujours avec le champ "Aff." du journal COFI (au niveau du document) : ~18% d'écart
   * constaté sur les chantiers retrouvés dans les deux sources. */
  consortium: boolean | null
}

export interface DepensesGlobal {
  global: DepenseBucketStats
  chantier: DepenseBucketStats
  consortium: DepenseBucketStats
  parEntite: Record<string, DepenseBucketStats>
  /** Top 60 chantiers (codes "SECT Débit") par montant, sur ~224 codes distincts au total. */
  parChantier: DepenseChantierStats[]
  nbChantiers: number
  nbChantiersAvecNom: number
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
  chantierNom: string | null
  chantierConsortium: boolean | null
  aff: 'CHANTIER INDUNI' | 'CONSORTIUM'
  montant: number | null
  ref: string | null
  enRetard: boolean
}

export interface DepenseChantierBucket extends DepenseBucketStats {
  nom: string | null
  consortium: boolean | null
}

export interface DepenseFournisseur {
  nfr: number
  nom: string
  global: DepenseBucketStats
  chantierMontant: number
  consortiumMontant: number
  parEntite: Record<string, DepenseBucketStats>
  parChantier: Record<string, DepenseChantierBucket>
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

/** Libellé d'affichage d'un chantier : "N° - Nom" si retrouvé dans Chantiers.xlsx, sinon
 * juste le code brut. */
export function chantierLabel(code: string, nom: string | null): string {
  if (code === 'NON RENSEIGNE') return 'Non renseigné'
  return nom ? `${code} - ${nom}` : code
}

/** Bleu pour les chantiers Induni, vert pour les chantiers consortium — demande explicite,
 * distinct de la palette secteurColor utilisée ailleurs (autre dimension). */
export function chantierColor(consortium: boolean | null): string {
  if (consortium == null) return '#94a3b8'
  return consortium ? '#16a34a' : '#2563eb'
}

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
  /** Technicien référent du chantier, depuis Chantiers.xlsx (colonne "Technicien") — null si
   * non renseigné dans ce référentiel (la valeur littérale "NULL" du fichier source est traitée
   * comme une absence de valeur). */
  technicien: string | null
}

export interface DepenseTranche {
  label: string
  nbFactures: number
  montantFactures: number
  pctNb: number | null
  pctMontant: number | null
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
  /** Répartition des factures par tranche de montant (uniquement genre "Facture", montant
   * connu) — 5 tranches : <2'000, 2'001-5'000, 5'001-10'000, 10'001-50'000, >50'000 CHF. */
  tranches: DepenseTranche[]
  /** Panier moyen = montantFacturesTotal / nbFacturesTotal (factures uniquement, montant connu). */
  panierMoyenFacture: number
  /** Nombre de factures avec un montant connu (légèrement inférieur au nbFactures de `global`,
   * qui inclut aussi les quelques factures sans montant pos. renseigné). */
  nbFacturesTotal: number
  montantFacturesTotal: number
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
  technicien: string | null
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

/** Groupe de fournisseurs validé manuellement (onglet "Groupes potentiels" du fichier de
 * détection de doublons/groupes, colonne Validation = "OK") — voir groupesFournisseurs.json. */
export interface GroupeFournisseur {
  nom: string
  /** Groupe parent (holding) le cas échéant — ex. "Groupe Colas" a pour parent "Groupe Bouygues".
   * Simple hiérarchie à deux niveaux : le parent n'a pas ses propres "membres" ici, seulement un nom. */
  parent?: string
  membres: { nfr: number; nom: string }[]
}

export interface GroupeDetail {
  nom: string
  parent?: string
  montantTotal: number
  entites: { nfr: number; nom: string; montantTotal: number }[]
}

let groupesCache: GroupeFournisseur[] | null = null
let groupesPending: Promise<GroupeFournisseur[]> | null = null

export function loadGroupesFournisseurs(): Promise<GroupeFournisseur[]> {
  if (groupesCache) return Promise.resolve(groupesCache)
  if (!groupesPending) {
    groupesPending = import('./groupesFournisseurs.json').then((mod) => {
      groupesCache = mod.default as unknown as GroupeFournisseur[]
      return groupesCache
    })
  }
  return groupesPending
}

/** Cherche le groupe validé auquel appartient un fournisseur (par N° fr), et calcule le détail
 * du groupe (montant total cumulé, liste des entités) à partir de la liste complète des
 * fournisseurs de dépense. Retourne null si ce fournisseur n'appartient à aucun groupe validé. */
export function findGroupeDetail(
  groupes: GroupeFournisseur[],
  allFournisseurs: DepenseFournisseur[],
  nfr: number,
): GroupeDetail | null {
  const groupe = groupes.find((g) => g.membres.some((m) => m.nfr === nfr))
  if (!groupe) return null
  const entites = groupe.membres
    .map((m) => {
      const f = allFournisseurs.find((af) => af.nfr === m.nfr)
      return { nfr: m.nfr, nom: f?.nom ?? m.nom, montantTotal: f?.global.montantTotal ?? 0 }
    })
    .sort((a, b) => b.montantTotal - a.montantTotal)
  const montantTotal = Math.round(entites.reduce((sum, e) => sum + e.montantTotal, 0) * 100) / 100
  return { nom: groupe.nom, parent: groupe.parent, montantTotal, entites }
}

export interface GroupeTotal {
  nom: string
  parent?: string
  montantTotal: number
  nbEntites: number
}

/** Calcule, pour chaque groupe validé, le montant total cumulé de ses entités membres — sert au
 * classement "Top 20 groupes fournisseurs" (même principe que le Top 20 fournisseurs individuel,
 * mais agrégé par groupe plutôt que par N° fr). */
export function computeGroupesTotals(groupes: GroupeFournisseur[], allFournisseurs: DepenseFournisseur[]): GroupeTotal[] {
  return groupes
    .map((g) => {
      const montantTotal = g.membres.reduce((sum, m) => {
        const f = allFournisseurs.find((af) => af.nfr === m.nfr)
        return sum + (f?.global.montantTotal ?? 0)
      }, 0)
      return { nom: g.nom, parent: g.parent, montantTotal: Math.round(montantTotal * 100) / 100, nbEntites: g.membres.length }
    })
    .sort((a, b) => b.montantTotal - a.montantTotal)
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

/** Bornes des 5 tranches de montant de facture — identiques à celles utilisées côté Python pour
 * `depensesGlobal.json.tranches`, afin que la répartition par fournisseur (calculée ici côté
 * client à partir de `documents`) reste comparable à la répartition globale. */
const TRANCHE_BOUNDS: { label: string; min: number; max: number | null }[] = [
  { label: "< 2'000 CHF", min: 0, max: 2000 },
  { label: "2'001 - 5'000 CHF", min: 2000, max: 5000 },
  { label: "5'001 - 10'000 CHF", min: 5000, max: 10000 },
  { label: "10'001 - 50'000 CHF", min: 10000, max: 50000 },
  { label: "> 50'000 CHF", min: 50000, max: null },
]

/** Calcule la répartition par tranche de montant (et le panier moyen) sur un ensemble de
 * documents fournisseur, en se limitant au genre "Facture" avec un montant connu — même
 * logique que celle appliquée globalement dans `tranches.py`. */
export function computeTranches(documents: DepenseDocument[]): {
  tranches: DepenseTranche[]
  panierMoyen: number | null
  nbFactures: number
  montantFactures: number
} {
  const factures = documents.filter((d) => d.genre === 'Facture' && d.montant != null)
  const nbFactures = factures.length
  const montantFactures = Math.round(factures.reduce((sum, d) => sum + Math.abs(d.montant ?? 0), 0) * 100) / 100
  const tranches = TRANCHE_BOUNDS.map(({ label, min, max }) => {
    const inTranche = factures.filter((d) => {
      const m = Math.abs(d.montant ?? 0)
      return m >= min && (max === null || m < max)
    })
    const montant = Math.round(inTranche.reduce((sum, d) => sum + Math.abs(d.montant ?? 0), 0) * 100) / 100
    return {
      label,
      nbFactures: inTranche.length,
      montantFactures: montant,
      pctNb: pct(inTranche.length, nbFactures),
      pctMontant: pct(montant, montantFactures),
    }
  })
  return {
    tranches,
    panierMoyen: nbFactures ? Math.round((montantFactures / nbFactures) * 100) / 100 : null,
    nbFactures,
    montantFactures,
  }
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

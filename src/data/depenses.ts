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
  /** Dépense par année (année de "Date doc.", clé "AAAA") — permet de distinguer la dépense par
   * campagne d'import (ex. 2023, 2024 Induni, 2024 Consortium…) au lieu d'un seul total cumulé
   * toutes périodes confondues. */
  parAnnee: Record<string, DepenseBucketStats>
  /** Dépense par famille d'achat (FOURNISSEURS/SOUS-TRAITANTS/TRANSPORTEURS/CFC .../"Non classé")
   * — famille reprise de l'historique d'évaluation (EvalRecord.famille) par correspondance de nom,
   * voir DepenseFournisseur.familleAchat. "Non classé" = fournisseur jamais évalué, pas d'erreur. */
  parFamilleAchat: Record<string, DepenseBucketStats>
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
  /** Fournisseurs exclus du reporting car ce ne sont pas de vrais fournisseurs externes
   * (écritures intercompagnie, caisses sociales, etc.) — voir fournisseurExclusionsDepense.json.
   * Sert à documenter au survol ce qui a été retiré du montant "Dépense totale". */
  exclusions?: {
    nbLignes: number
    montantTotal: number
    details: { nfr: number; nom: string; montant: number; motif: string }[]
  }
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
  /** Dépense de ce fournisseur par année (année de "Date doc.", clé "AAAA"). */
  parAnnee: Record<string, DepenseBucketStats>
  /** Famille d'achat (FOURNISSEURS/SOUS-TRAITANTS/TRANSPORTEURS/CFC .../...) reprise de
   * l'historique d'évaluation par correspondance de nom — null si ce fournisseur n'a jamais été
   * évalué (pas de donnée disponible, pas une erreur). Sert au rapprochement CA/fournisseur/famille. */
  familleAchat: string | null
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
  membres: { nfr: number; nom: string; note?: string }[]
}

export interface GroupeDetail {
  nom: string
  parent?: string
  /** Année "dernière année" / année précédente utilisées pour les montants ci-dessous — reprises
   * du fournisseur zoomé (voir `anneesRecentesDepense`), vide si ce fournisseur n'a aucune donnée
   * de dépense. */
  annee: string | null
  anneePrecedente: string | null
  /** Montant total du groupe pour `annee` (et non plus un cumul toutes années confondues). */
  montantTotal: number
  montantTotalPrecedent: number
  /** Montant total du groupe pour chacune des années passées à `findGroupeDetails` (jusqu'à 3,
   * la plus récente en premier) — sert au graphique d'évolution sur 3 ans. */
  montantParAnnee: { annee: string; montant: number }[]
  entites: {
    nfr: number
    nom: string
    montantTotal: number
    montantAnneePrecedente: number
    /** % d'évolution entre les deux années, null si l'année précédente est à 0 ou absente. */
    evolutionPct: number | null
    note?: string
  }[]
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

function evolutionPct(latest: number, prev: number): number | null {
  if (!prev) return null
  return Math.round(((latest - prev) / Math.abs(prev)) * 1000) / 10
}

function buildGroupeDetail(groupe: GroupeFournisseur, allFournisseurs: DepenseFournisseur[], annees: string[]): GroupeDetail {
  const [annee = null, anneePrecedente = null] = annees
  const entites = groupe.membres
    .map((m) => {
      const f = allFournisseurs.find((af) => af.nfr === m.nfr)
      const montantTotal = annee ? f?.parAnnee[annee]?.montantTotal ?? 0 : 0
      const montantAnneePrecedente = anneePrecedente ? f?.parAnnee[anneePrecedente]?.montantTotal ?? 0 : 0
      return {
        nfr: m.nfr,
        nom: f?.nom ?? m.nom,
        montantTotal,
        montantAnneePrecedente,
        evolutionPct: evolutionPct(montantTotal, montantAnneePrecedente),
        note: m.note,
      }
    })
    .sort((a, b) => b.montantTotal - a.montantTotal)
  const montantTotal = Math.round(entites.reduce((sum, e) => sum + e.montantTotal, 0) * 100) / 100
  const montantTotalPrecedent = Math.round(entites.reduce((sum, e) => sum + e.montantAnneePrecedente, 0) * 100) / 100
  const montantParAnnee = annees.map((a) => ({
    annee: a,
    montant:
      Math.round(
        groupe.membres.reduce((sum, m) => sum + (allFournisseurs.find((af) => af.nfr === m.nfr)?.parAnnee[a]?.montantTotal ?? 0), 0) *
          100,
      ) / 100,
  }))
  return {
    nom: groupe.nom,
    parent: groupe.parent,
    annee,
    anneePrecedente,
    montantTotal,
    montantTotalPrecedent,
    montantParAnnee,
    entites,
  }
}

/** Cherche TOUS les groupes validés auxquels appartient un fournisseur (par N° fr) — un
 * fournisseur peut appartenir à plusieurs groupes à la fois (ex. participation croisée entre
 * deux groupes) — et calcule le détail de chacun (montant par année, liste des entités) à partir
 * de la liste complète des fournisseurs de dépense. `annees` = années du fournisseur zoomé
 * (voir `anneesRecentesDepense`, la plus récente en premier), pour que toutes les lignes du
 * groupe se lisent sur les mêmes années. Tableau vide si aucun groupe validé. */
export function findGroupeDetails(
  groupes: GroupeFournisseur[],
  allFournisseurs: DepenseFournisseur[],
  nfr: number,
  annees: string[],
): GroupeDetail[] {
  return groupes.filter((g) => g.membres.some((m) => m.nfr === nfr)).map((g) => buildGroupeDetail(g, allFournisseurs, annees))
}

/** Les 2 (ou `count`) années les plus récentes pour lesquelles ce fournisseur a de la dépense
 * (clés de `parAnnee`, triées décroissant) — même principe que la paire note/année précédente
 * déjà utilisée pour les évaluations (SupplierZoom.notesRecentes) : dynamique par fournisseur,
 * pas une année calendaire figée en dur. */
export function anneesRecentesDepense(fournisseur: DepenseFournisseur | null, count = 3): string[] {
  if (!fournisseur) return []
  return Object.keys(fournisseur.parAnnee)
    .filter((a) => /^\d{4}$/.test(a))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, count)
}

/** Réseau de dirigeants et de liens entre sociétés (administrateurs communs, structures de
 * groupe), issu d'une cartographie externe (registres RC/FOSC, presse) sur le secteur
 * gravier/béton — INFORMATIF uniquement, distinct des "Groupes potentiels" validés
 * manuellement : ceci reflète un réseau de relations (parfois non confirmées publiquement,
 * `confirme: false`), pas une structure d'actionnariat vérifiée. Voir liensDirigeantsDepense.json. */
export interface LiensDirigeantsEntry {
  nfr: number
  dirigeantsCommuns: {
    personne: string
    societes: { nom: string; nfr: number | null; confirme: boolean }[]
  }[]
  liensDirects: { nom: string; nfr: number | null; confirme: boolean }[]
}

let liensDirigeantsCache: LiensDirigeantsEntry[] | null = null
let liensDirigeantsPending: Promise<LiensDirigeantsEntry[]> | null = null

export function loadLiensDirigeants(): Promise<LiensDirigeantsEntry[]> {
  if (liensDirigeantsCache) return Promise.resolve(liensDirigeantsCache)
  if (!liensDirigeantsPending) {
    liensDirigeantsPending = import('./liensDirigeantsDepense.json').then((mod) => {
      liensDirigeantsCache = mod.default as unknown as LiensDirigeantsEntry[]
      return liensDirigeantsCache
    })
  }
  return liensDirigeantsPending
}

export function findLiensDirigeants(liens: LiensDirigeantsEntry[], nfr: number): LiensDirigeantsEntry | null {
  return liens.find((l) => l.nfr === nfr) ?? null
}

export interface GroupeTotal {
  nom: string
  parent?: string
  montantTotal: number
  nbEntites: number
}

/** Calcule, pour chaque groupe validé, le montant total cumulé de ses entités membres — sert au
 * classement "Top 20 groupes fournisseurs" (même principe que le Top 20 fournisseurs individuel,
 * mais agrégé par groupe plutôt que par N° fr). Si `entite` est fourni, ne compte que le montant
 * de chaque membre pour cette entité (`DepenseFournisseur.parEntite`) plutôt que son total global. */
export function computeGroupesTotals(
  groupes: GroupeFournisseur[],
  allFournisseurs: DepenseFournisseur[],
  entite?: string | null,
): GroupeTotal[] {
  return groupes
    .map((g) => {
      const montantTotal = g.membres.reduce((sum, m) => {
        const f = allFournisseurs.find((af) => af.nfr === m.nfr)
        const montant = entite ? f?.parEntite[entite]?.montantTotal : f?.global.montantTotal
        return sum + (montant ?? 0)
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

/** Recalcule un DepenseBucketStats à partir d'une liste de documents bruts — même formule que le
 * pipeline Python qui a produit `depensesGlobal.json`/`depensesFournisseurs.json` (revalidée au
 * centime sur les 1488 fournisseurs déjà en place avant tout nouvel import) : montantTotal/
 * montantPayees/montantEnAttente/montantATemps/montantEnRetard en valeur signée, montantFactures
 * en valeur absolue uniquement quand `absFactures` est vrai (vues par chantier/famille), signée
 * sinon (vues globales/par entité/par année). Ne calcule pas `nbFournisseurs` (les documents
 * bruts ne portent pas le N° fournisseur) — à ajouter par l'appelant si besoin. */
export function computeBucketStats(documents: DepenseDocument[], absFactures = false): DepenseBucketStats {
  const montantTotal = Math.round(documents.reduce((s, d) => s + (d.montant ?? 0), 0) * 100) / 100
  const factures = documents.filter((d) => d.genre === 'Facture')
  const facturesConnues = factures.filter((d) => d.montant != null)
  const montantFactures =
    Math.round(facturesConnues.reduce((s, d) => s + (absFactures ? Math.abs(d.montant!) : d.montant!), 0) * 100) / 100
  const notesCredit = documents.filter((d) => d.genre !== 'Facture')
  const montantNotesCredit = Math.round(notesCredit.reduce((s, d) => s + (d.montant ?? 0), 0) * 100) / 100
  const payees = documents.filter((d) => d.datePaiement != null)
  const montantPayees = Math.round(payees.reduce((s, d) => s + (d.montant ?? 0), 0) * 100) / 100
  const enAttente = documents.filter((d) => d.datePaiement == null)
  const montantEnAttente = Math.round(enAttente.reduce((s, d) => s + (d.montant ?? 0), 0) * 100) / 100
  const avecEcheance = documents.filter((d) => d.dateEcheance != null)
  const aTemps = avecEcheance.filter((d) => d.enRetard === false && d.datePaiement != null)
  const montantATemps = Math.round(aTemps.reduce((s, d) => s + (d.montant ?? 0), 0) * 100) / 100
  const enRetard = avecEcheance.filter((d) => d.enRetard === true)
  const montantEnRetard = Math.round(enRetard.reduce((s, d) => s + (d.montant ?? 0), 0) * 100) / 100
  const retards = enRetard
    .filter((d) => d.dateEcheance)
    .map((d) => {
      const eff = d.datePaiement ?? new Date().toISOString().slice(0, 10)
      return (new Date(eff).getTime() - new Date(d.dateEcheance!).getTime()) / 86400000
    })
  const retardMoyenJours = retards.length ? Math.round((retards.reduce((a, b) => a + b, 0) / retards.length) * 10) / 10 : null
  return {
    montantTotal,
    nbDocuments: documents.length,
    nbFactures: factures.length,
    montantFactures,
    nbNotesCredit: notesCredit.length,
    montantNotesCredit,
    nbPayees: payees.length,
    montantPayees,
    nbEnAttente: enAttente.length,
    montantEnAttente,
    nbATemps: aTemps.length,
    montantATemps,
    nbEnRetard: enRetard.length,
    montantEnRetard,
    retardMoyenJours,
  }
}

/** Années de `parAnnee` à afficher — exclut les années avec un volume négligeable de documents
 * (entrées isolées/placeholder, ex. 2019-2022 avec 1 à 5 documents chacune dans ce jeu de
 * données) pour ne pas polluer les tableaux "par année" avec des lignes non représentatives.
 * Seuil choisi pour couper nettement sous le volume des vraies années (~25 000+ documents). */
const ANNEE_MIN_DOCUMENTS = 50

export function anneesSignificatives(parAnnee: Record<string, DepenseBucketStats>): string[] {
  return Object.keys(parAnnee)
    .filter((a) => /^\d{4}$/.test(a) && parAnnee[a].nbDocuments >= ANNEE_MIN_DOCUMENTS)
    .sort((a, b) => a.localeCompare(b))
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

export interface Dossier {
  id: string
  numeroChantier: string
  adresse: string
  client: string
  fiche: Record<string, string>
  createdAt: string
  updatedAt: string
}

export type NewDossier = Omit<Dossier, 'id' | 'createdAt' | 'updatedAt'>

export interface Lot {
  id: string
  dossierId: string
  position: number
  priorite: string
  cfcCode: string
  familleLot: string
  descriptionTechnique: string
  acheteur: string
  respTravaux: string
  typeAchat: string
  miseEnConcurrence: string
  fournisseurImpose: string
  fournisseursAConsulter: string
  fournisseurChoisi: string
  budgetCtx: number | null
  budgetAchatBe: number | null
  deductionPct: number | null
  montantCommande: number | null
  quantite: number | null
  unite: string
  dateRemiseBesoinCtx: string
  preparationDossier: string
  lancementConsultation: string
  retourOffres: string
  choixFournisseur: string
  dateCommande: string
  premiereLivraison: string
  derniereLivraison: string
  documentsPlansNecessaires: string
  statut: string
  prochaineAction: string
  remarquesLien: string
}

export type NewLot = Omit<Lot, 'id'>

export interface ChecklistItem {
  id: string
  dossierId: string
  position: number
  categorie: string
  document: string
  requis: string
  statut: string
  versionDate: string
  responsable: string
  echeance: string
  lienRemarque: string
}

export type NewChecklistItem = Omit<ChecklistItem, 'id'>

export const EVALUATION_CRITERES = [
  { key: 'critereQualite', label: 'Qualité des produits / prestations' },
  { key: 'critereDelais', label: 'Respect des délais de livraison' },
  { key: 'critereBudget', label: 'Respect du budget / prix' },
  { key: 'critereCommunication', label: 'Réactivité / communication' },
  { key: 'critereDocumentation', label: 'Conformité documentation (fiches, certificats)' },
  { key: 'critereSecurite', label: 'Sécurité / respect des consignes chantier' },
  { key: 'critereSav', label: 'Service après-vente' },
] as const

export type EvaluationCritereKey = (typeof EVALUATION_CRITERES)[number]['key']

export const RECOMMANDATION_OPTIONS = ['À recommander', 'Neutre', 'À éviter'] as const

export const EVALUATION_STATUT_OPTIONS = ['Brouillon', 'Complété'] as const

export interface Evaluation {
  id: string
  dossierId: string
  lotId: string | null
  fournisseurNom: string
  dateEvaluation: string
  evaluateur: string
  critereQualite: number | null
  critereDelais: number | null
  critereBudget: number | null
  critereCommunication: number | null
  critereDocumentation: number | null
  critereSecurite: number | null
  critereSav: number | null
  recommandation: string
  commentaire: string
  statut: string
}

export type NewEvaluation = Omit<Evaluation, 'id'>

export function noteGlobale(evaluation: Evaluation): number | null {
  const notes = EVALUATION_CRITERES.map((c) => evaluation[c.key]).filter((n): n is number => n != null)
  if (notes.length === 0) return null
  return Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 10) / 10
}

export interface LotComputed {
  budgetNetCible: number | null
  ecartBudget: number | null
  joursAvantLivraison: number | null
  delaiAlerte: string
  controle: string
}

export function computeLot(lot: Lot): LotComputed {
  const budgetNetCible =
    lot.budgetAchatBe != null
      ? lot.budgetAchatBe * (1 - (lot.deductionPct ?? 0) / 100)
      : lot.budgetCtx != null
        ? lot.budgetCtx * (1 - (lot.deductionPct ?? 0) / 100)
        : null

  const ecartBudget =
    budgetNetCible != null && lot.montantCommande != null ? budgetNetCible - lot.montantCommande : null

  let joursAvantLivraison: number | null = null
  if (lot.premiereLivraison) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const livraison = new Date(lot.premiereLivraison)
    joursAvantLivraison = Math.round((livraison.getTime() - today.getTime()) / 86400000)
  }

  let delaiAlerte = ''
  if (lot.familleLot) {
    if (['Livré', 'Clos', 'Non applicable'].includes(lot.statut)) {
      delaiAlerte = 'OK'
    } else if (!lot.premiereLivraison) {
      delaiAlerte = 'Date manquante'
    } else if (joursAvantLivraison != null && joursAvantLivraison < 0) {
      delaiAlerte = 'En retard'
    } else if (joursAvantLivraison != null && joursAvantLivraison <= 14) {
      delaiAlerte = '≤ 14 jours'
    } else {
      delaiAlerte = 'OK'
    }
  }

  let controle = ''
  if (lot.familleLot) {
    controle = !lot.acheteur || !lot.respTravaux || !lot.premiereLivraison || !lot.statut ? 'À compléter' : 'OK'
  }

  return { budgetNetCible, ecartBudget, joursAvantLivraison, delaiAlerte, controle }
}

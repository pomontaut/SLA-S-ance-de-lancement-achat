export type Suivi = 'a_faire' | 'en_cours' | 'commande' | 'livre'

export const SUIVI_LABELS: Record<Suivi, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  commande: 'Commandé',
  livre: 'Livré',
}

export interface Acheteur {
  initiales: string
  nom: string
}

export interface Dossier {
  id: string
  numeroChantier: string
  adresse: string
  client: string
  architecte: string
  ingenieur: string
  conducteurTravaux: string
  contremaitre: string
  typologieTravaux: string
  planningDemarrage: string
  planningFin: string
  conditions: string
  garanties: string
  deductionsContractuelles: string
  documentsDisposition: string[]
  particularites: string[]
  acheteurs: Acheteur[]
  createdAt: string
  updatedAt: string
}

export interface Lot {
  id: string
  dossierId: string
  categorie: string
  designation: string
  acheteurInitiales: string
  dateLivraisonEstimative: string
  quantite: string
  budgetPu: string
  budgetTheo: number | null
  remarques: string
  suivi: Suivi
  position: number
}

export type NewDossier = Omit<Dossier, 'id' | 'createdAt' | 'updatedAt'>
export type NewLot = Omit<Lot, 'id'>

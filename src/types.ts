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

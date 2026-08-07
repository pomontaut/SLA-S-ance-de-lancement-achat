export const STATUT_LOT_OPTIONS = [
  'À identifier',
  'À préparer',
  'En attente documents',
  'Consultation à lancer',
  'Consultation lancée',
  'Analyse des offres',
  'Négociation',
  'Choix à valider',
  'Adjugé / commandé',
  'Livré',
  'Clos',
  'Non applicable',
] as const

export const PRIORITE_OPTIONS = ['Critique', 'Haute', 'Normale', 'Basse'] as const

export const TYPE_ACHAT_OPTIONS = [
  'Fourniture',
  'Sous-traitance',
  'Fourniture & pose',
  'Location',
  'Prestation',
  'Commande-cadre',
  'Achat direct',
] as const

export const OUI_NON_OPTIONS = ['Oui', 'Non', 'À confirmer', 'Non applicable'] as const

export const UNITE_OPTIONS = [
  'CHF',
  'm³',
  'm²',
  'ml',
  't',
  'kg',
  'u',
  'forfait',
  'lot',
  'jour',
  'heure',
  'litre',
] as const

export const STATUT_DOCUMENT_OPTIONS = [
  'Disponible',
  'Provisoire',
  'Demandé',
  'En attente',
  'À mettre à jour',
  'Non disponible',
  'Non applicable',
] as const

export const CHECKLIST_DOCUMENTS_STATUT_EN_ATTENTE = ['Demandé', 'En attente', 'À mettre à jour'] as const

export interface ChecklistTemplateItem {
  categorie: string
  document: string
}

export const CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  { categorie: 'Contrat', document: 'Contrat signé / lettre d’adjudication' },
  { categorie: 'Contrat', document: 'Descriptif contractuel et exclusions' },
  { categorie: 'Contrat', document: 'Déductions, garanties, retenues et pénalités' },
  { categorie: 'Contrat', document: 'Conditions de paiement et renchérissement' },
  { categorie: 'Contrat', document: 'Entreprises / fournisseurs imposés' },
  { categorie: 'Budget', document: 'Soumission chiffrée / série de prix' },
  { categorie: 'Budget', document: 'Bilan / sous-détails des prix' },
  { categorie: 'Budget', document: 'Offres fournisseurs de l’étude de prix' },
  { categorie: 'Budget', document: 'Budgets par CFC / lot' },
  { categorie: 'Budget', document: 'Quantités de référence' },
  { categorie: 'Plans', document: 'Plans architecte à jour' },
  { categorie: 'Plans', document: 'Plans ingénieur / coffrage' },
  { categorie: 'Plans', document: 'Plans d’armatures' },
  { categorie: 'Plans', document: 'Plans de préfabrication / escaliers / gradins' },
  { categorie: 'Plans', document: 'Plan d’installation de chantier (PIC)' },
  { categorie: 'Plans', document: 'Plans de géolocalisation / réseaux' },
  { categorie: 'Rapports', document: 'Rapport géotechnique' },
  { categorie: 'Rapports', document: 'Rapport thermique' },
  { categorie: 'Rapports', document: 'Rapport acoustique' },
  { categorie: 'Rapports', document: 'Rapport pollution / analyses des terres' },
  { categorie: 'Rapports', document: 'Concept feu / prescriptions abris PC' },
  { categorie: 'Rapports', document: 'Dossier étanchéité' },
  { categorie: 'Planning', document: 'Planning général et phasage' },
  { categorie: 'Planning', document: 'Dates de besoin / livraisons par lot' },
  { categorie: 'Planning', document: 'Planning de remise des plans' },
  { categorie: 'Logistique', document: 'Adresse et contact de livraison' },
  { categorie: 'Logistique', document: 'Contraintes d’accès et gabarits camions' },
  { categorie: 'Logistique', document: 'Capacité de stockage / zones de dépôt' },
  { categorie: 'Logistique', document: 'Moyens de levage / grue' },
  { categorie: 'Logistique', document: 'Centrale béton / pompage / horaires' },
  { categorie: 'Logistique', document: 'Gestion des bennes et déchets' },
  { categorie: 'Achats', document: 'Liste des lots à acheter' },
  { categorie: 'Achats', document: 'Répartition acheteurs / responsabilités' },
  { categorie: 'Achats', document: 'Fournisseurs à consulter' },
  { categorie: 'Achats', document: 'Variantes / options à chiffrer' },
  { categorie: 'Achats', document: 'Lots hors périmètre / gérés en direct' },
  { categorie: 'Achats', document: 'Urgences et décisions attendues' },
]

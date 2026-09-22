// Formulaire d'évaluation fournisseur — critères par famille, repris tels quels du modèle Excel
// de référence utilisé chaque année par les évaluateurs (ex. "Eval 2025" secteur GC/Bâtiment).
// Les familles "FOURNISSEURS (SANS FACTURATION DIRECTE)" et "MARCHANDS" partagent les mêmes
// critères que "FOURNISSEURS" dans ce modèle — seule leur classification diffère.

export interface FamilleEvaluation {
  famille: string
  criteres: string[]
}

const CRITERES_FOURNISSEURS = [
  'Respect des délais de livraison convenus',
  'Rapport Qualité/Prix',
  'Respect de la qualité convenue',
  'Souplesse et façon de traiter nos réclamations',
  'Compétence / assistance technique',
  'Respect des quantités prévues',
]

export const FAMILLES_EVALUATION: FamilleEvaluation[] = [
  { famille: 'FOURNISSEURS', criteres: CRITERES_FOURNISSEURS },
  { famille: 'FOURNISSEURS (SANS FACTURATION DIRECTE)', criteres: CRITERES_FOURNISSEURS },
  { famille: 'MARCHANDS', criteres: CRITERES_FOURNISSEURS },
  {
    famille: 'SOUS-TRAITANTS',
    criteres: [
      'Respect des délais / Réactivité',
      'Qualité des prestations / Compétence',
      'Rapport qualité / Prix',
      'Gestion des litiges (y.c. levée de réserves)',
      'Respect des règles de sécurité',
      'Tenue des chantiers, ordre, propreté',
    ],
  },
  {
    famille: 'TRANSPORTEURS',
    criteres: [
      'Ponctualité',
      'Rapport qualité / Prix',
      'Souplesse et façon de traiter nos réclamations',
      'Vérité des quantités annoncées',
      'Qualité du matériel roulant',
    ],
  },
  {
    famille: 'LEVAGE / MACHINES /LOCATION',
    criteres: [
      'Respect des délais de livraison convenus',
      'Rapport qualité / Prix',
      'Qualité des machines',
      'Souplesse et façon de traiter nos réclamations',
      'Compétence / assistance technique',
      'Qualité du SAV',
    ],
  },
  {
    famille: 'INTERIMAIRES',
    criteres: ['Qualité du personnel', 'Réactivité commerciale', 'Rapport qualité / prix', 'Equipement du personnel'],
  },
]

export function criteresPourFamille(famille: string): string[] {
  return FAMILLES_EVALUATION.find((f) => f.famille === famille)?.criteres ?? []
}

/** Échelle de notation du modèle de référence : 0 (très mauvais) à 4 (très bon). */
export const NOTE_OPTIONS = [0, 1, 2, 3, 4] as const

export function moyenneCriteres(criteres: Record<string, number | null>): number | null {
  const notes = Object.values(criteres).filter((n): n is number => n != null)
  if (notes.length === 0) return null
  return Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 100) / 100
}

import { loadDepensesFournisseurs } from './depenses'

/** Seuil de dépense sur le chantier au-delà duquel un fournisseur est à évaluer (décision du propriétaire). */
export const SEUIL_EVALUATION_CHF = 10000

export interface FournisseurChantier {
  nfr: number
  nom: string
  familleAchat: string | null
  /** Dépense nette sur le chantier, toutes années (factures moins notes de crédit), en CHF. */
  ca: number
  nbFactures: number
  /** Montant moyen d'une facture (CHF), null s'il n'y a aucune facture. */
  panier: number | null
}

/** Fournisseurs ayant facturé le chantier `code`, triés par dépense décroissante. */
export async function depenseDuChantier(code: string): Promise<FournisseurChantier[]> {
  const fournisseurs = await loadDepensesFournisseurs()
  const out: FournisseurChantier[] = []
  for (const f of fournisseurs) {
    let ca = 0
    let nb = 0
    let brut = 0
    let trouve = false
    for (const d of f.documents) {
      if (d.chantier !== code) continue
      trouve = true
      ca += d.montant ?? 0
      if (d.genre === 'Facture' && d.montant != null) {
        nb++
        brut += Math.abs(d.montant)
      }
    }
    if (trouve) {
      out.push({
        nfr: f.nfr,
        nom: f.nom,
        familleAchat: f.familleAchat,
        ca: Math.round(ca * 100) / 100,
        nbFactures: nb,
        panier: nb ? Math.round(brut / nb) : null,
      })
    }
  }
  return out.sort((a, b) => b.ca - a.ca)
}

/** Famille d'évaluation proposée d'après la famille d'achat du fournisseur (modifiable dans le formulaire). */
export function familleEvaluationProposee(familleAchat: string | null, parDefaut: string): string {
  if (!familleAchat) return parDefaut
  if (['MARCHANDS', 'SOUS-TRAITANTS', 'TRANSPORTEURS', 'INTERIMAIRES'].includes(familleAchat)) return familleAchat
  if (familleAchat === 'Location') return 'LEVAGE / MACHINES /LOCATION'
  if (familleAchat === 'Fournisseur de matériaux') return 'FOURNISSEURS'
  if (familleAchat.startsWith('CFC')) return 'SOUS-TRAITANTS'
  return parDefaut
}

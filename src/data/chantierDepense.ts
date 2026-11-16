import { loadDepensesFournisseurs } from './depenses'

/** Seuil de dépense sur le chantier au-delà duquel un fournisseur est à évaluer (décision du propriétaire). */
export const SEUIL_EVALUATION_CHF = 10000

/** Période d'analyse, de mois à mois inclus, au format « AAAA-MM » (ex. { de: '2026-01', a: '2026-12' }). */
export interface PeriodeAnalyse {
  de: string
  a: string
}

/** Année en cours (par défaut de l'analyse) : janvier à décembre. */
export function periodeAnneeEnCours(annee = new Date().getFullYear()): PeriodeAnalyse {
  return { de: `${annee}-01`, a: `${annee}-12` }
}

export interface FournisseurChantier {
  nfr: number
  nom: string
  familleAchat: string | null
  /** Dépense nette sur le chantier, toutes années (factures moins notes de crédit), en CHF. */
  ca: number
  nbFactures: number
  /** Montant moyen d'une facture (CHF), null s'il n'y a aucune facture. */
  panier: number | null
  /** true si ajouté à la main (ex. consortium) : pas forcément de dépense sur ce chantier dans les données. */
  manuel?: boolean
}

/** Fournisseurs ayant facturé le chantier `code` sur la période, triés par dépense décroissante. */
export async function depenseDuChantier(code: string, periode?: PeriodeAnalyse): Promise<FournisseurChantier[]> {
  const fournisseurs = await loadDepensesFournisseurs()
  const de = periode ? (periode.de <= periode.a ? periode.de : periode.a) : '0000-00'
  const a = periode ? (periode.de <= periode.a ? periode.a : periode.de) : '9999-99'
  const out: FournisseurChantier[] = []
  for (const f of fournisseurs) {
    let ca = 0
    let nb = 0
    let brut = 0
    let trouve = false
    for (const d of f.documents) {
      if (d.chantier !== code) continue
      // Mois de comptabilisation (date COFI, sinon date du document), comme dans les analyses de dépense.
      const mois = (d.dateCofi || d.dateDoc || '').slice(0, 7)
      if (mois < de || mois > a) continue
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

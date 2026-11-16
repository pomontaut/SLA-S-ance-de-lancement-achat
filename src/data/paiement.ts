import type { DepenseDocument, DepenseFournisseur } from './depenses'
import { anneeComptable } from './depenses'
import conditions from './conditionsFournisseurs.json'

// Définitions de paiement communes à l'onglet « Paiement » et au zoom fournisseur (une seule source de vérité) :
//  - retard d'une facture = date de paiement − date d'échéance (positif = retard) ;
//  - taux de paiement à l'échéance = factures payées à temps / (factures payées + impayées échues) ;
//  - date d'arrêt par année = percentile 99 des dates de paiement connues de l'année (les journaux n'ont pas
//    été extraits le même jour) : une facture impayée est jugée à cette date.

export const jours = (a: string, b: string) =>
  Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000)
export const ajouteJours = (iso: string, n: number) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000).toISOString().slice(0, 10)
export const moy = (l: number[]) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : null)
export const mediane = (l: number[]) => {
  if (!l.length) return null
  const s = [...l].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

export const SEUIL_TAUX_PAIEMENT = 90 // objectif du taux de paiement à l'échéance (%)

export interface FacturePaiement {
  nfr: number
  nom: string
  entite: string | null
  annee: string
  ech: string
  pay: string | null
  /** Retard en jours (paiement − échéance) ; null si impayée. */
  retard: number | null
  ht: number
  dispo: string | null
  doc: string | null
  /** Escompte prévu par la condition (« 30 JOURS 2% » : 2 % si payé sous 30 jours). */
  esc: { delai: number; taux: number } | null
  /** Escompte RÉELLEMENT pris, HT : écart facture − montant payé (script/escomptes_reels.py). 0 si aucun. */
  escReel: number
}

let escReelsCache: Record<string, number> | null = null
let escReelsPending: Promise<Record<string, number>> | null = null
/** Escomptes réellement pris par facture (clé « n° fournisseur:n° doc », montant TTC). Vide si le fichier manque. */
export function loadEscomptesReels(): Promise<Record<string, number>> {
  if (escReelsCache) return Promise.resolve(escReelsCache)
  if (!escReelsPending) {
    escReelsPending = fetch(`${import.meta.env.BASE_URL}data/escomptesReels.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, number>>) : {}))
      .catch(() => ({}))
      .then((d) => (escReelsCache = d))
  }
  return escReelsPending
}

export interface DocTtc {
  annee: string
  ttc: number
  pay: string | null
  doc: DepenseDocument
}

const ESCOMPTE = /(\d+)\s*JOURS\s+(\d+(?:[.,]\d+)?)\s*%/i

/** Date d'arrêt des paiements de chaque année (sur l'ensemble des fournisseurs). */
export function arretsParAnnee(fournisseurs: DepenseFournisseur[]): Record<string, string> {
  const m = new Map<string, string[]>()
  for (const f of fournisseurs) {
    for (const d of f.documents) {
      const a = anneeComptable(d)
      if (a && d.datePaiement) (m.get(a) ?? m.set(a, []).get(a)!).push(d.datePaiement)
    }
  }
  const out: Record<string, string> = {}
  for (const [a, l] of m) {
    l.sort()
    out[a] = l[Math.min(l.length - 1, Math.floor(l.length * 0.99))]
  }
  return out
}

/** Factures (avec échéance) et documents TTC des fournisseurs donnés, filtrés par entité ('' = toutes). */
export function facturesPaiement(fournisseurs: DepenseFournisseur[], entite = '', escReels: Record<string, number> = {}): { factures: FacturePaiement[]; docsTtc: DocTtc[] } {
  const factures: FacturePaiement[] = []
  const docsTtc: DocTtc[] = []
  for (const f of fournisseurs) {
    for (const d of f.documents) {
      if (entite && d.entite !== entite) continue
      const a = anneeComptable(d)
      if (!a || !/^\d{4}$/.test(a)) continue
      docsTtc.push({ annee: a, ttc: (d.montant ?? 0) + (d.tva ?? 0), pay: d.datePaiement, doc: d })
      if (d.genre !== 'Facture' || d.montant == null || !d.dateEcheance) continue
      const m = d.condition ? ESCOMPTE.exec(d.condition) : null
      // Conditions réelles communiquées (ex. PRO BETON : 30 j 2 %, net 60 j) prioritaires sur le texte du journal.
      const cond = (conditions as Record<string, { escompteJours?: number; taux?: number; netJours?: number }>)[String(f.nfr)]
      let escTtc = 0
      for (const n of [f.nfr, ...(f.nfrAlias ?? [])]) {
        const v = escReels[`${n}:${d.docno}`]
        if (v) { escTtc = v; break }
      }
      const ttc = d.montant + (d.tva ?? 0)
      factures.push({
        nfr: f.nfr,
        nom: f.nom,
        entite: d.entite,
        annee: a,
        ech: cond?.netJours && d.dateDoc ? ajouteJours(d.dateDoc, cond.netJours) : d.dateEcheance,
        pay: d.datePaiement,
        retard: d.datePaiement ? jours(cond?.netJours && d.dateDoc ? ajouteJours(d.dateDoc, cond.netJours) : d.dateEcheance, d.datePaiement) : null,
        ht: d.montant,
        dispo: d.dateDispo ?? null,
        doc: d.dateDoc,
        esc: cond?.escompteJours && cond.taux ? { delai: cond.escompteJours, taux: cond.taux / 100 } : m && +m[2].replace(',', '.') > 0 ? { delai: +m[1], taux: +m[2].replace(',', '.') / 100 } : null,
        escReel: escTtc && ttc ? escTtc * (d.montant / ttc) : 0,
      })
    }
  }
  return { factures, docsTtc }
}

/** Indicateurs d'un ensemble de factures (chaque facture est jugée à l'arrêt de son année). */
export function indicateursPaiement(l: FacturePaiement[], arret: Record<string, string>) {
  const payees = l.filter((f) => f.pay)
  const impayeesEchues = l.filter((f) => !f.pay && f.ech <= (arret[f.annee] ?? '0000'))
  const aTemps = payees.filter((f) => (f.retard ?? 1) <= 0)
  const enRetard = payees.filter((f) => (f.retard ?? 0) > 0)
  const base = payees.length + impayeesEchues.length
  // Escomptes : « réalisé » = écart réel facture − paiement ; « perdu » = escompte de la condition (taux × HT) des factures
  // où il n'a PAS été pris alors que le délai est dépassé (payée après le délai) ou expiré à la date d'arrêt (impayée).
  const escOb = l.reduce((t, f) => t + f.escReel, 0)
  const escPerdu = l
    .filter((f) => f.esc && f.escReel === 0 && f.doc && (f.pay ? true : ajouteJours(f.doc, f.esc.delai) <= (arret[f.annee] ?? '0000')))
    .reduce((t, f) => t + f.ht * f.esc!.taux, 0)
  const interne = l.filter((f) => f.dispo && f.doc).map((f) => jours(f.doc!, f.dispo!)).filter((v) => v >= 0 && v <= 120)
  return {
    nb: l.length,
    nbPayees: payees.length,
    nbATemps: aTemps.length,
    nbRetard: enRetard.length,
    nbImpayeesEchues: impayeesEchues.length,
    taux: base ? (aTemps.length / base) * 100 : null,
    retardMoyen: moy(enRetard.map((f) => f.retard!)),
    interneMoyen: moy(interne),
    interneMedian: mediane(interne),
    escOb,
    escPerdu,
  }
}

/** DPO = (dettes fournisseurs TTC / achats TTC de l'année) × jours ; dettes = documents de l'année impayés à la clôture. */
export function dpoAnnee(docsTtc: DocTtc[], arret: Record<string, string>, a: string): number | null {
  const l = docsTtc.filter((d) => d.annee === a)
  const achats = l.reduce((t, d) => t + d.ttc, 0)
  if (achats <= 0) return null
  const finAnnee = `${a}-12-31`
  const cloture = (arret[a] ?? finAnnee) < finAnnee ? arret[a] : finAnnee // année en cours : à la date d'arrêt
  const dettes = l.filter((d) => d.ttc > 0 && (!d.pay || d.pay > cloture)).reduce((t, d) => t + d.ttc, 0)
  const nbJours = cloture < finAnnee ? jours(`${a}-01-01`, cloture) + 1 : 365
  return (dettes / achats) * nbJours
}

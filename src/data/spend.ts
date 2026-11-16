import type { DepenseFournisseur } from './depenses'
import { anneeComptable } from './depenses'

// Calculs communs aux onglets « Synthèse direction » et « Fournisseurs (acheteurs) » : lignes de dépense HT,
// comparaison à période égale (cumul à fin septembre 2026 vs cumul à fin septembre 2025…).

export interface LigneSpend {
  nfr: number
  nom: string
  famille: string
  entite: string | null
  chantier: string | null
  chantierNom: string | null
  annee: string
  mois: number // 0-11
  montant: number // HT
  facture: boolean
}

export function lignesSpend(fournisseurs: DepenseFournisseur[]): LigneSpend[] {
  const out: LigneSpend[] = []
  for (const f of fournisseurs) {
    for (const d of f.documents) {
      const a = anneeComptable(d)
      const date = d.dateCofi || d.dateDoc
      if (!a || !/^\d{4}$/.test(a) || !date) continue
      const m = Number(date.slice(5, 7)) - 1
      out.push({
        nfr: f.nfr,
        nom: f.nom,
        famille: f.familleAchat || 'Non classé',
        entite: d.entite,
        chantier: d.chantier,
        chantierNom: d.chantierNom ?? null,
        annee: a,
        mois: m >= 0 && m < 12 ? m : 0,
        montant: d.montant ?? 0,
        facture: d.genre === 'Facture' && d.montant != null,
      })
    }
  }
  return out
}

/** Dernier mois (0-11) avec de la dépense pour l'année `a` : borne du cumul comparable quand l'année est partielle. */
export function dernierMois(lignes: LigneSpend[], a: string): number {
  let m = -1
  for (const l of lignes) if (l.annee === a && l.mois > m && l.montant !== 0) m = l.mois
  return m < 0 ? 11 : m
}

export const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export interface Totaux {
  total: number
  nbFournisseurs: number
  nbFactures: number
  factureMoyenne: number | null
  /** Part des 20 plus gros fournisseurs (%). */
  top20Pct: number | null
  /** Nombre de fournisseurs qui font 80 % de la dépense. */
  n80: number
  /** Fournisseurs de « queue » (< seuil) : nombre et part de la dépense (%). */
  queueNb: number
  queuePct: number | null
}

export const SEUIL_QUEUE_CHF = 10000

export function totaux(l: LigneSpend[]): Totaux {
  const parF = new Map<number, number>()
  let total = 0
  let nbF = 0
  let sommeFactures = 0
  for (const x of l) {
    parF.set(x.nfr, (parF.get(x.nfr) ?? 0) + x.montant)
    total += x.montant
    if (x.facture) {
      nbF++
      sommeFactures += x.montant
    }
  }
  const montants = [...parF.values()].filter((v) => v > 0).sort((a, b) => b - a)
  const base = montants.reduce((s, v) => s + v, 0)
  let cum = 0
  let n80 = 0
  for (const v of montants) {
    cum += v
    n80++
    if (base > 0 && cum / base >= 0.8) break
  }
  const queue = montants.filter((v) => v < SEUIL_QUEUE_CHF)
  return {
    total,
    nbFournisseurs: montants.length,
    nbFactures: nbF,
    factureMoyenne: nbF ? sommeFactures / nbF : null,
    top20Pct: base > 0 ? (montants.slice(0, 20).reduce((s, v) => s + v, 0) / base) * 100 : null,
    n80: base > 0 ? n80 : 0,
    queueNb: queue.length,
    queuePct: base > 0 ? (queue.reduce((s, v) => s + v, 0) / base) * 100 : null,
  }
}

/** Variation en % (cur vs prev) ; null si la référence est nulle. */
export function variation(cur: number, prev: number): number | null {
  return prev > 0 ? (cur / prev - 1) * 100 : null
}

export function sommeParCle<K extends string>(l: LigneSpend[], cle: (x: LigneSpend) => K | null): Map<K, number> {
  const m = new Map<K, number>()
  for (const x of l) {
    const k = cle(x)
    if (k != null) m.set(k, (m.get(k) ?? 0) + x.montant)
  }
  return m
}

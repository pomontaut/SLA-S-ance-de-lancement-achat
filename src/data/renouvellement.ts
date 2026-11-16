import type { LigneSpend } from './spend'
import { dernierMois } from './spend'

export interface LigneRenouvellement {
  annee: string
  partielle: boolean
  moisMax: number
  actifsPrev: number
  actifs: number
  entrants: number
  sortants: number
  /** Taux de renouvellement = (entrants + sortants) ÷ (actifs N-1 + actifs N). */
  taux: number | null
  tauxEntree: number | null // entrants ÷ actifs N-1
  tauxSortie: number | null // sortants ÷ actifs N-1
  facturesEntrants: number
  facturesSortants: number
  montantEntrants: number
  montantSortants: number
  depense: number // dépense HT de la période
  depensePrev: number
}

/**
 * Renouvellement du panel fournisseurs, année par année (la 1re année de l'historique n'a pas de « avant » : elle sert de base).
 * Entrant = dépense sur la période et aucune dépense les années précédentes ; sortant = dépense l'an dernier (même période), aucune cette période.
 * Une année partielle est comparée au même cumul de l'année précédente.
 */
export function renouvellementParAnnee(base: LigneSpend[], toutes: LigneSpend[], annees: string[], partielles: string[]): LigneRenouvellement[] {
  const out: LigneRenouvellement[] = []
  for (const an of annees) {
    const an1 = String(Number(an) - 1)
    if (!annees.includes(an1)) continue
    const partielle = partielles.includes(an)
    const moisMax = partielle ? dernierMois(toutes, an) : 11
    type A = { cur: number; prev: number; avant: number; fCur: number; fPrev: number }
    const m = new Map<number, A>()
    let depense = 0, depensePrev = 0
    for (const l of base) {
      if (l.annee > an) continue
      const cur = l.annee === an && l.mois <= moisMax
      const prev = l.annee === an1 && l.mois <= moisMax
      const avant = l.annee < an
      if (!cur && !prev && !avant) continue
      const e = m.get(l.nfr) ?? { cur: 0, prev: 0, avant: 0, fCur: 0, fPrev: 0 }
      if (cur) { e.cur += l.montant; depense += l.montant; if (l.facture) e.fCur++ }
      if (prev) { e.prev += l.montant; depensePrev += l.montant; if (l.facture) e.fPrev++ }
      if (avant) e.avant += l.montant
      m.set(l.nfr, e)
    }
    let actifs = 0, actifsPrev = 0, entrants = 0, sortants = 0, fE = 0, fS = 0, mE = 0, mS = 0
    for (const e of m.values()) {
      if (e.cur > 0) actifs++
      if (e.prev > 0) actifsPrev++
      if (e.cur > 0 && e.avant <= 0) { entrants++; fE += e.fCur; mE += e.cur }
      if (e.prev > 0 && e.cur <= 0) { sortants++; fS += e.fPrev; mS += e.prev }
    }
    out.push({
      annee: an, partielle, moisMax, actifsPrev, actifs, entrants, sortants,
      taux: actifs + actifsPrev ? ((entrants + sortants) / (actifs + actifsPrev)) * 100 : null,
      tauxEntree: actifsPrev ? (entrants / actifsPrev) * 100 : null,
      tauxSortie: actifsPrev ? (sortants / actifsPrev) * 100 : null,
      facturesEntrants: fE, facturesSortants: fS, montantEntrants: mE, montantSortants: mS, depense, depensePrev,
    })
  }
  return out
}

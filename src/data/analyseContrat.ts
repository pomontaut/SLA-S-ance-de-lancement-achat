import type { LigneSpend } from './spend'
import { CONTRATS, contratDe, sousContrat } from './sousContrat'

// Analyse contrat : couverture contractuelle de la dépense HT, candidats à contractualiser, contrats à surveiller.
// Uniquement des données existantes (journaux COFI + liste des contrats) : aucune estimation de gain.

/** Un fournisseur hors contrat est « candidat » au-delà de ce montant sur la période (CHF HT). */
export const SEUIL_CANDIDAT_CHF = 100000
/** Un contrat est « en baisse » si sa dépense recule d'au moins ce % ET d'au moins ce montant (même règle que les hausses/baisses fournisseurs). */
const SEUIL_BAISSE_PCT = 30
const SEUIL_BAISSE_CHF = 10000

export interface CtxContrat {
  base: LigneSpend[]
  comparer: boolean
  an: string
  dansCur: (l: LigneSpend) => boolean
  dansPrev: (l: LigneSpend) => boolean
}

export type StatutContrat = 'nouveau' | 'actif' | 'baisse' | 'arret' | 'aucune'

export interface LigneContrat {
  contrat: string
  nfr: number[]
  /** Nom du fournisseur tel qu'au journal (pour le zoom) ; null si aucune dépense. */
  nom: string | null
  depuis: number | null
  cur: number
  prev: number
  fac: number
  statut: StatutContrat
}

export interface Candidat {
  nfr: number
  nom: string
  famille: string
  cur: number
  prev: number
  entites: string[]
  nbChantiers: number
  /** Poids dans la dépense de sa famille d'achat (période). */
  partFamille: number
}

export interface FamilleCouverture {
  famille: string
  total: number
  contrat: number
  nbHors: number
  nbCandidats: number
}

export interface PointAnnee {
  annee: string
  total: number
  contrat: number
}

export function calculContrats(c: CtxContrat) {
  const { base, comparer, an, dansCur, dansPrev } = c
  let totCur = 0, totPrev = 0, cCur = 0, cPrev = 0, facCur = 0, cPrevConstant = 0
  const contrats = new Map<string, { nfr: Set<number>; nom: string; cur: number; prev: number; fac: number }>()
  const hors = new Map<number, { nom: string; famille: string; cur: number; prev: number; ent: Set<string>; chant: Set<string> }>()
  const fam = new Map<string, { total: number; contrat: number }>()
  const annees = new Map<string, { total: number; contrat: number }>()

  for (const l of base) {
    const sous = sousContrat(l.nfr, l.annee)
    // Évolution de la couverture : toutes années du périmètre (entité), contrat en vigueur l'année de la dépense.
    const pa = annees.get(l.annee) ?? { total: 0, contrat: 0 }
    pa.total += l.montant
    if (sous) pa.contrat += l.montant
    annees.set(l.annee, pa)

    const cur = dansCur(l), prev = dansPrev(l)
    if (!cur && !prev) continue
    if (cur) {
      totCur += l.montant
      const f = fam.get(l.famille) ?? { total: 0, contrat: 0 }
      f.total += l.montant
      if (sous) f.contrat += l.montant
      fam.set(l.famille, f)
    }
    if (prev) totPrev += l.montant
    // Périmètre constant : N-1 limité aux contrats en vigueur l'année étudiée (exclut l'effet des nouveaux contrats).
    if (prev && comparer && sousContrat(l.nfr, an)) cPrevConstant += l.montant
    if (sous) {
      const k = contratDe(l.nfr)!
      const e = contrats.get(k) ?? { nfr: new Set<number>(), nom: l.nom, cur: 0, prev: 0, fac: 0 }
      e.nfr.add(l.nfr)
      if (cur) { e.cur += l.montant; cCur += l.montant; if (l.facture) { e.fac++; facCur++ } }
      if (prev) { e.prev += l.montant; cPrev += l.montant }
      contrats.set(k, e)
    } else {
      const h = hors.get(l.nfr) ?? { nom: l.nom, famille: l.famille, cur: 0, prev: 0, ent: new Set<string>(), chant: new Set<string>() }
      if (cur) { h.cur += l.montant; if (l.entite) h.ent.add(l.entite); if (l.chantier) h.chant.add(l.chantier) }
      if (prev) h.prev += l.montant
      hors.set(l.nfr, h)
    }
  }

  // Tous les contrats applicables à la période (même ceux sans aucune dépense : c'est justement l'information utile).
  const lignesContrat: LigneContrat[] = CONTRATS.filter((k) => !comparer || !k.depuis || Number(an) >= k.depuis).map((k) => {
    const e = contrats.get(k.contrat)
    const cur = e?.cur ?? 0
    const prev = e?.prev ?? 0
    const nouveau = comparer && k.depuis === Number(an)
    let statut: StatutContrat = 'actif'
    if (nouveau && cur > 0) statut = 'nouveau'
    else if (cur <= 0 && prev > 0 && comparer) statut = 'arret'
    else if (cur <= 0) statut = 'aucune'
    else if (comparer && prev > 0 && cur < prev * (1 - SEUIL_BAISSE_PCT / 100) && prev - cur >= SEUIL_BAISSE_CHF) statut = 'baisse'
    return { contrat: k.contrat, nfr: k.nfr, nom: e?.nom ?? null, depuis: k.depuis ?? null, cur, prev, fac: e?.fac ?? 0, statut }
  })

  const horsListe = [...hors.entries()].filter(([, h]) => h.cur > 0)
  const candidats: Candidat[] = horsListe
    .filter(([, h]) => h.cur >= SEUIL_CANDIDAT_CHF)
    .map(([nfr, h]) => ({ nfr, nom: h.nom, famille: h.famille, cur: h.cur, prev: h.prev, entites: [...h.ent].sort(), nbChantiers: h.chant.size, partFamille: fam.get(h.famille)?.total ? (h.cur / fam.get(h.famille)!.total) * 100 : 0 }))
    .sort((a, b) => b.cur - a.cur)

  const familles: FamilleCouverture[] = [...fam.entries()]
    .map(([famille, v]) => ({
      famille,
      total: v.total,
      contrat: v.contrat,
      nbHors: horsListe.filter(([, h]) => h.famille === famille).length,
      nbCandidats: candidats.filter((x) => x.famille === famille).length,
    }))
    .sort((a, b) => b.total - a.total)

  const parAnnee: PointAnnee[] = [...annees.entries()].map(([annee, v]) => ({ annee, ...v })).sort((a, b) => a.annee.localeCompare(b.annee))
  const horsTotal = totCur - cCur
  return {
    totCur, totPrev, cCur, cPrev, cPrevConstant, facCur,
    taux: totCur > 0 ? (cCur / totCur) * 100 : null,
    tauxPrev: totPrev > 0 ? (cPrev / totPrev) * 100 : null,
    lignesContrat,
    nbContrats: lignesContrat.length,
    nbActifs: lignesContrat.filter((x) => x.cur > 0).length,
    nbActifsPrev: lignesContrat.filter((x) => x.prev > 0).length,
    candidats,
    candidatsMontant: candidats.reduce((s, x) => s + x.cur, 0),
    horsTotal,
    nbHors: horsListe.length,
    familles,
    parAnnee,
  }
}
export type ResultatContrats = ReturnType<typeof calculContrats>

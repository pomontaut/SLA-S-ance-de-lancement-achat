import { useEffect, useMemo, useState } from 'react'
import type { DepenseFournisseur } from './depenses'
import { loadDepensesFournisseurs, loadDepensesGlobal } from './depenses'
import { MOIS_COURTS, dernierMois, lignesSpend } from './spend'
import type { LigneSpend } from './spend'
import { useFiltresSpend } from '../components/FiltresSpend'

/** Données de dépense + période commune (entité/année du périmètre) et période égale N-1. */
export function usePeriodeSpend() {
  const f = useFiltresSpend()
  const [fournisseurs, setFournisseurs] = useState<DepenseFournisseur[] | null>(null)
  const [partielles, setPartielles] = useState<string[]>([])
  useEffect(() => {
    loadDepensesFournisseurs().then(setFournisseurs)
    loadDepensesGlobal().then((g) => setPartielles(Object.keys(g.anneesPartielles ?? {})))
  }, [])
  const toutes = useMemo<LigneSpend[]>(() => (fournisseurs ? lignesSpend(fournisseurs) : []), [fournisseurs])
  const entite = f?.entite ?? ''
  const base = useMemo(() => (entite ? toutes.filter((l) => l.entite === entite) : toutes), [toutes, entite])
  const annees = useMemo(() => [...new Set(toutes.map((l) => l.annee))].sort(), [toutes])
  const comparer = !!f && f.annee !== 'toutes'
  const an = comparer ? f!.annee : ''
  const an1 = comparer ? String(Number(an) - 1) : ''
  const partielle = comparer && partielles.includes(an)
  const moisMax = partielle ? dernierMois(toutes, an) : 11
  const libPeriode = comparer ? (partielle ? `janv.–${MOIS_COURTS[moisMax]} ${an}` : an) : 'Toutes années'
  const libPrev = comparer ? (partielle ? `janv.–${MOIS_COURTS[moisMax]} ${an1}` : an1) : ''
  const dansCur = (l: LigneSpend) => (comparer ? l.annee === an && l.mois <= moisMax : true)
  const dansPrev = (l: LigneSpend) => comparer && l.annee === an1 && l.mois <= moisMax
  return { charge: !!fournisseurs, fournisseurs, base, toutes, annees, entite, comparer, an, an1, moisMax, libPeriode, libPrev, dansCur, dansPrev }
}

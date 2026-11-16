import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { anneesSignificatives, loadDepensesGlobal } from '../data/depenses'
import { entiteLabel } from '../data/palette'

// Périmètre commun (entité + année) de la section « Analyse Dépense » : réglé une fois dans la barre du haut,
// il est suivi par tous les onglets de la section (synthèse, répartition, fournisseurs, chantiers, paiement).
// Année par défaut = année en cours (la plus récente) ; « toutes » = toutes les années.

export interface FiltresSpend {
  /** '' = toutes les entités. */
  entite: string
  setEntite: (v: string) => void
  /** Année effective : une année (« 2026 ») ou « toutes ». */
  annee: string
  setAnnee: (v: string) => void
  /** Années proposées (croissantes) et entités proposées. */
  annees: string[]
  entites: string[]
  anneeEnCours: string
  /** Années incomplètes (ex. 2026 : janv.–sept.). */
  partielles: string[]
}

const Ctx = createContext<FiltresSpend | null>(null)

export function useFiltresSpend(): FiltresSpend | null {
  return useContext(Ctx)
}

export function FiltresSpendProvider({ children }: { children: React.ReactNode }) {
  const [entite, setEntite] = useState('')
  const [choix, setChoix] = useState<string | null>(null) // null = année en cours
  const [annees, setAnnees] = useState<string[]>([])
  const [entites, setEntites] = useState<string[]>([])
  const [partielles, setPartielles] = useState<Record<string, string>>({})

  useEffect(() => {
    loadDepensesGlobal().then((g) => {
      setAnnees(anneesSignificatives(g.parAnnee))
      setEntites(Object.keys(g.parEntite).sort((a, b) => g.parEntite[b].montantTotal - g.parEntite[a].montantTotal))
      setPartielles(g.anneesPartielles ?? {})
    })
  }, [])

  const anneeEnCours = annees[annees.length - 1] ?? ''
  const valeur = useMemo<FiltresSpend>(
    () => ({
      entite,
      setEntite,
      annee: choix ?? anneeEnCours,
      setAnnee: (v: string) => setChoix(v),
      annees,
      entites,
      anneeEnCours,
      partielles: Object.keys(partielles),
    }),
    [entite, choix, annees, entites, anneeEnCours, partielles],
  )
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>
}

/** Barre de périmètre : entité + année, valable pour tous les onglets de la section. */
export function BarreFiltresSpend() {
  const f = useFiltresSpend()
  if (!f) return null
  const chip = (actif: boolean) =>
    actif
      ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: 'white' }
      : { backgroundColor: 'white', borderColor: '#e2e8f0', color: '#475569' }
  return (
    <div className="card !py-3 space-y-2 sticky top-0 z-10 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs uppercase text-slate-500 w-14">Entité</span>
        {['', ...f.entites].map((e) => (
          <button key={e || 'toutes'} className="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors" style={chip(f.entite === e)} onClick={() => f.setEntite(e)}>
            {e ? entiteLabel(e) : 'Toutes'}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs uppercase text-slate-500 w-14">Année</span>
        {[...f.annees, 'toutes'].map((a) => (
          <button key={a} className="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors" style={chip(f.annee === a)} onClick={() => f.setAnnee(a)}>
            {a === 'toutes' ? 'Toutes années' : a}
            {f.partielles.includes(a) ? ' (partielle)' : ''}
          </button>
        ))}
        <span className="text-[11px] text-slate-400 ml-2">Périmètre commun à tous les onglets · montants HT</span>
      </div>
    </div>
  )
}

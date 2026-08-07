export interface EvalRecord {
  nom: string
  type: string
  categorie: string
  secteur: string
  annee: number
  note: number | null
  ca: number | null
  caInduni: number | null
  nbEvaluateurs: number | null
  remarques: string
  famille: string
}

let cache: EvalRecord[] | null = null
let pending: Promise<EvalRecord[]> | null = null

export function loadEvaluationsHistorique(): Promise<EvalRecord[]> {
  if (cache) return Promise.resolve(cache)
  if (!pending) {
    pending = import('./evaluationsHistorique.json').then((mod) => {
      cache = mod.default as unknown as EvalRecord[]
      return cache
    })
  }
  return pending
}

export const SECTEURS = ['GC', 'BAT GE', 'BAT VD', 'EG GE/VD', 'EG VS', 'Général'] as const

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export interface SecteurKpis {
  annee: number
  secteur: string
  fournisseursEvalues: number
  moyenneGlobale: number | null
  moyennePrecedente: number | null
  evolution: number | null
  perimetreEvalue: number | null
  top10Montant: number | null
  top10PctPerimetre: number | null
  top10: EvalRecord[]
  excellents: number
  faibles: number
  tresFaibles: number
  uneEvaluation: number
  nonEvaluesAnneePrecedente: number
  jamaisEvaluesAvant: number
  fournisseursCommuns: number
  moyenneIsoPerimetre: number | null
  moyenneIsoPerimetrePrecedente: number | null
  evolutionIsoPerimetre: number | null
  moyenneNbEvaluateurs: number | null
}

export function computeKpis(all: EvalRecord[], secteur: string, annee: number): SecteurKpis {
  const bySecteur = all.filter((r) => r.secteur === secteur)
  const current = bySecteur.filter((r) => r.annee === annee && r.note != null)
  const previous = bySecteur.filter((r) => r.annee === annee - 1 && r.note != null)

  const moyenneGlobale = avg(current.map((r) => r.note!))
  const moyennePrecedente = previous.length ? avg(previous.map((r) => r.note!)) : null
  const evolution = moyenneGlobale != null && moyennePrecedente != null ? Math.round((moyenneGlobale - moyennePrecedente) * 100) / 100 : null

  const withCa = current.filter((r) => r.ca != null)
  const perimetreEvalue = withCa.length ? sum(withCa.map((r) => r.ca!)) : null
  const top10 = [...withCa].sort((a, b) => b.ca! - a.ca!).slice(0, 10)
  const top10Montant = top10.length ? sum(top10.map((r) => r.ca!)) : null
  const top10PctPerimetre =
    top10Montant != null && perimetreEvalue ? Math.round((top10Montant / perimetreEvalue) * 1000) / 10 : null

  const currentNoms = new Set(current.map((r) => r.nom))
  const previousNoms = new Set(previous.map((r) => r.nom))
  const communsNoms = [...currentNoms].filter((n) => previousNoms.has(n))
  const historiqueNoms = new Set(bySecteur.filter((r) => r.annee < annee && r.note != null).map((r) => r.nom))

  const moyenneIsoPerimetre = avg(current.filter((r) => communsNoms.includes(r.nom)).map((r) => r.note!))
  const moyenneIsoPerimetrePrecedente = avg(previous.filter((r) => communsNoms.includes(r.nom)).map((r) => r.note!))
  const evolutionIsoPerimetre =
    moyenneIsoPerimetre != null && moyenneIsoPerimetrePrecedente != null
      ? Math.round((moyenneIsoPerimetre - moyenneIsoPerimetrePrecedente) * 100) / 100
      : null

  const nbEval = current.map((r) => r.nbEvaluateurs).filter((n): n is number => n != null)

  return {
    annee,
    secteur,
    fournisseursEvalues: currentNoms.size,
    moyenneGlobale,
    moyennePrecedente,
    evolution,
    perimetreEvalue,
    top10Montant,
    top10PctPerimetre,
    top10,
    excellents: current.filter((r) => r.note! >= 3.5).length,
    faibles: current.filter((r) => r.note! < 3).length,
    tresFaibles: current.filter((r) => r.note! < 2).length,
    uneEvaluation: current.filter((r) => r.nbEvaluateurs === 1).length,
    nonEvaluesAnneePrecedente: [...currentNoms].filter((n) => !previousNoms.has(n)).length,
    jamaisEvaluesAvant: [...currentNoms].filter((n) => !historiqueNoms.has(n)).length,
    fournisseursCommuns: communsNoms.length,
    moyenneIsoPerimetre,
    moyenneIsoPerimetrePrecedente,
    evolutionIsoPerimetre,
    moyenneNbEvaluateurs: avg(nbEval),
  }
}

export function anneesDisponibles(all: EvalRecord[], secteur: string): number[] {
  return Array.from(new Set(all.filter((r) => r.secteur === secteur && r.note != null).map((r) => r.annee))).sort(
    (a, b) => b - a,
  )
}

export function trendParAnnee(all: EvalRecord[], secteur: string): { annee: number; moyenne: number }[] {
  const annees = anneesDisponibles(all, secteur).sort((a, b) => a - b)
  return annees
    .map((annee) => {
      const notes = all.filter((r) => r.secteur === secteur && r.annee === annee && r.note != null).map((r) => r.note!)
      const moyenne = avg(notes)
      return moyenne != null ? { annee, moyenne } : null
    })
    .filter((v): v is { annee: number; moyenne: number } => v != null)
}

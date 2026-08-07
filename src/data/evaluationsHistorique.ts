export interface EvalRecord {
  nom: string
  type: string
  categorie: string
  secteur: string
  annee: number
  note: number | null
  ca: number | null
  caInduni: number | null
  pctCa?: number | null
  nbEvaluateurs: number | null
  remarques: string
  famille: string
  criteres?: Record<string, number> | null
}

export interface SecteurStat {
  secteur: string
  annee: number
  nbEvaluateurs: number | null
  moyenneMini: number | null
  moyenneMaxi: number | null
  nbInferieur2: number | null
  nbSuperieur35: number | null
  moyenneGlobale: number | null
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

let statsCache: SecteurStat[] | null = null
let statsPending: Promise<SecteurStat[]> | null = null

export function loadSecteurStats(): Promise<SecteurStat[]> {
  if (statsCache) return Promise.resolve(statsCache)
  if (!statsPending) {
    statsPending = import('./evaluationsSecteurStats.json').then((mod) => {
      statsCache = mod.default as unknown as SecteurStat[]
      return statsCache
    })
  }
  return statsPending
}

export function findSecteurStat(stats: SecteurStat[], secteur: string, annee: number): SecteurStat | null {
  return stats.find((s) => s.secteur === secteur && s.annee === annee) ?? null
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

export interface CritereMoyenne {
  label: string
  moyenne: number
  nbFournisseurs: number
}

export function critereMoyennes(records: EvalRecord[]): CritereMoyenne[] {
  const bucket = new Map<string, number[]>()
  for (const r of records) {
    if (!r.criteres) continue
    for (const [label, note] of Object.entries(r.criteres)) {
      if (!bucket.has(label)) bucket.set(label, [])
      bucket.get(label)!.push(note)
    }
  }
  return Array.from(bucket.entries())
    .map(([label, notes]) => ({ label, moyenne: avg(notes)!, nbFournisseurs: notes.length }))
    .sort((a, b) => a.moyenne - b.moyenne)
}

export interface FamilleBreakdown {
  famille: string
  moyenne: number
  count: number
  ca: number | null
}

export function familleBreakdown(records: EvalRecord[]): FamilleBreakdown[] {
  const bucket = new Map<string, EvalRecord[]>()
  for (const r of records) {
    const key = r.famille || r.type || 'Non catégorisé'
    if (!bucket.has(key)) bucket.set(key, [])
    bucket.get(key)!.push(r)
  }
  return Array.from(bucket.entries())
    .map(([famille, recs]) => {
      const notes = recs.filter((r) => r.note != null).map((r) => r.note!)
      const withCa = recs.filter((r) => r.ca != null)
      return {
        famille,
        moyenne: avg(notes) ?? 0,
        count: recs.length,
        ca: withCa.length ? sum(withCa.map((r) => r.ca!)) : null,
      }
    })
    .filter((f) => f.count > 0)
    .sort((a, b) => a.moyenne - b.moyenne)
}

export interface SecteurComparison {
  a: SecteurKpis
  b: SecteurKpis
  fournisseursCommuns: string[]
  moyenneCommuneA: number | null
  moyenneCommuneB: number | null
  ecartsMax: { nom: string; noteA: number; noteB: number; ecart: number }[]
}

export function compareSecteurs(all: EvalRecord[], secteurA: string, secteurB: string, annee: number): SecteurComparison {
  const kpisA = computeKpis(all, secteurA, annee)
  const kpisB = computeKpis(all, secteurB, annee)

  const currentA = all.filter((r) => r.secteur === secteurA && r.annee === annee && r.note != null)
  const currentB = all.filter((r) => r.secteur === secteurB && r.annee === annee && r.note != null)
  const notesA = new Map(currentA.map((r) => [r.nom, r.note!]))
  const notesB = new Map(currentB.map((r) => [r.nom, r.note!]))
  const communs = [...notesA.keys()].filter((n) => notesB.has(n))

  const ecarts = communs
    .map((nom) => ({ nom, noteA: notesA.get(nom)!, noteB: notesB.get(nom)!, ecart: Math.abs(notesA.get(nom)! - notesB.get(nom)!) }))
    .sort((a, b) => b.ecart - a.ecart)
    .slice(0, 10)

  return {
    a: kpisA,
    b: kpisB,
    fournisseursCommuns: communs,
    moyenneCommuneA: communs.length ? avg(communs.map((n) => notesA.get(n)!)) : null,
    moyenneCommuneB: communs.length ? avg(communs.map((n) => notesB.get(n)!)) : null,
    ecartsMax: ecarts,
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

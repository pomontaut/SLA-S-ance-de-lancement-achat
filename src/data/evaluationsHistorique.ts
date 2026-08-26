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

export const ANNEE_MIN = 2017

let cache: EvalRecord[] | null = null
let pending: Promise<EvalRecord[]> | null = null

export function loadEvaluationsHistorique(): Promise<EvalRecord[]> {
  if (cache) return Promise.resolve(cache)
  if (!pending) {
    pending = import('./evaluationsHistorique.json').then((mod) => {
      cache = (mod.default as unknown as EvalRecord[]).filter((r) => r.annee >= ANNEE_MIN)
      return cache
    })
  }
  return pending
}

let fullCache: EvalRecord[] | null = null
let fullPending: Promise<EvalRecord[]> | null = null

/** Historique complet, sans le filtre ANNEE_MIN — utilisé par le zoom fournisseur pour
 * ne pas perdre les évaluations antérieures à 2017 (notamment le bucket "Général"). */
export function loadEvaluationsHistoriqueFull(): Promise<EvalRecord[]> {
  if (fullCache) return Promise.resolve(fullCache)
  if (!fullPending) {
    fullPending = import('./evaluationsHistorique.json').then((mod) => {
      fullCache = mod.default as unknown as EvalRecord[]
      return fullCache
    })
  }
  return fullPending
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

// Formes canoniques alignées sur normalizeType() (même singulier) pour éviter que
// "Fournisseurs" (via famille) et "Fournisseur" (via type) forment deux barres distinctes.
const FAMILLE_ALIASES: Record<string, string> = {
  FOURNISSEURS: 'Fournisseur',
  'FOURNISSEURS (SANS FACTURATION DIRECTE)': 'Fournisseur',
  'SOUS-TRAITANTS': 'Sous-traitant',
  MANDATAIRES: 'Mandataire',
  MARCHANDS: 'Marchand',
  TRANSPORTEURS: 'Transporteur',
  INTERIMAIRES: 'Intérimaire',
  'LEVAGE / MACHINES /LOCATION': 'Location',
  'TRAITEMENT DECHETS': 'Traitement déchets',
}

/** Le champ "famille" mélange des catégories réelles (FOURNISSEURS, SOUS-TRAITANTS...),
 * des codes CFC de prestation (import EG GE/VD, EG VS — ex. "CFC 27 – ...") et des cases
 * vides selon la source. On unifie les variantes connues et on retombe sur le type
 * (normalisé) pour tout le reste, plutôt que de laisser des dizaines de codes CFC ou
 * une grosse case vide polluer le graphique "Moyenne par famille". */
function normalizeFamille(famille: string, type: string): string {
  const key = famille.trim().toUpperCase()
  if (FAMILLE_ALIASES[key]) return FAMILLE_ALIASES[key]
  if (key === '' || key.startsWith('CFC')) return normalizeType(type)
  return famille.trim()
}

export function familleBreakdown(records: EvalRecord[]): FamilleBreakdown[] {
  const bucket = new Map<string, EvalRecord[]>()
  for (const r of records) {
    const key = normalizeFamille(r.famille ?? '', r.type ?? '') || 'Non catégorisé'
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
  return compareCells(all, { secteur: secteurA, annee }, { secteur: secteurB, annee })
}

/** Généralisation de compareSecteurs : compare deux couples (secteur, année) quelconques —
 * deux secteurs la même année, ou le même secteur sur deux années différentes. */
export function compareCells(
  all: EvalRecord[],
  cellA: { secteur: string; annee: number },
  cellB: { secteur: string; annee: number },
): SecteurComparison {
  const kpisA = computeKpis(all, cellA.secteur, cellA.annee)
  const kpisB = computeKpis(all, cellB.secteur, cellB.annee)

  const currentA = all.filter((r) => r.secteur === cellA.secteur && r.annee === cellA.annee && r.note != null)
  const currentB = all.filter((r) => r.secteur === cellB.secteur && r.annee === cellB.annee && r.note != null)
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

// ============ Filtres globaux (Vue d'ensemble) ============

export interface GlobalFilters {
  secteurs: string[]
  anneeMin: number
  anneeMax: number
  types: string[]
  noteMin: number
  noteMax: number
  search: string
}

export function defaultFilters(all: EvalRecord[]): GlobalFilters {
  const annees = all.map((r) => r.annee)
  return {
    secteurs: [],
    anneeMin: annees.length ? Math.min(...annees) : ANNEE_MIN,
    anneeMax: annees.length ? Math.max(...annees) : new Date().getFullYear(),
    types: [],
    noteMin: 0,
    noteMax: 5,
    search: '',
  }
}

/** Les fichiers sources orthographient le type de façon incohérente (casse, pluriel, espaces) :
 * on les regroupe sous un libellé canonique pour un filtre utilisable. */
export function normalizeType(raw: string): string {
  const t = raw.trim()
  const lower = t.toLowerCase()
  if (lower === 'fournisseur' || lower === 'fournisseurs') return 'Fournisseur'
  if (lower === 'sous-traitant' || lower === 'sous-traitants') return 'Sous-traitant'
  if (lower === 'mandataire' || lower === 'mandataires') return 'Mandataire'
  if (lower === 'transporteur' || lower === 'transporteurs') return 'Transporteur'
  if (lower === 'marchand' || lower === 'marchands') return 'Marchand'
  if (lower === 'location') return 'Location'
  if (lower === 'architecte' || lower === 'architectes') return 'Architecte'
  if (lower === 'fournisseur de mat.' || lower === 'fournisseurs matériaux/matériel') return 'Fournisseur de matériaux'
  if (lower === "fourn.main d'œuvre" || lower === "fournisseur main d'œuvre" || lower === 'fourniss. personnel')
    return "Fournisseur main d'œuvre"
  return t
}

export function applyFilters(all: EvalRecord[], f: GlobalFilters): EvalRecord[] {
  const q = f.search.trim().toLowerCase()
  return all.filter((r) => {
    if (r.note == null) return false
    if (f.secteurs.length > 0 && !f.secteurs.includes(r.secteur)) return false
    if (r.annee < f.anneeMin || r.annee > f.anneeMax) return false
    if (f.types.length > 0 && !f.types.includes(normalizeType(r.type))) return false
    if (r.note < f.noteMin || r.note > f.noteMax) return false
    if (q && !r.nom.toLowerCase().includes(q)) return false
    return true
  })
}

export function distinctTypes(all: EvalRecord[]): string[] {
  return Array.from(new Set(all.map((r) => r.type).filter(Boolean).map(normalizeType))).sort()
}

// ============ Vue d'ensemble : KPIs multi-secteurs ============

export interface GlobalKpis {
  fournisseursEvalues: number
  evaluationsTotal: number
  moyenneGlobale: number | null
  perimetreEvalue: number | null
  secteursCouverts: number
  anneesCouvertes: number
}

export function globalKpis(records: EvalRecord[]): GlobalKpis {
  const notes = records.filter((r) => r.note != null)
  const withCa = notes.filter((r) => r.ca != null)
  return {
    fournisseursEvalues: new Set(notes.map((r) => r.nom)).size,
    evaluationsTotal: notes.length,
    moyenneGlobale: avg(notes.map((r) => r.note!)),
    perimetreEvalue: withCa.length ? sum(withCa.map((r) => r.ca!)) : null,
    secteursCouverts: new Set(notes.map((r) => r.secteur)).size,
    anneesCouvertes: new Set(notes.map((r) => r.annee)).size,
  }
}

export interface SecteurTrendSeries {
  secteur: string
  points: { annee: number; moyenne: number }[]
}

export function multiSecteurTrend(all: EvalRecord[], secteurs: string[]): SecteurTrendSeries[] {
  return secteurs.map((secteur) => ({ secteur, points: trendParAnnee(all, secteur) }))
}

export function noteDistribution(records: EvalRecord[]): { bucket: string; count: number }[] {
  const buckets = [
    { bucket: '< 2', min: -Infinity, max: 2 },
    { bucket: '2 – 2,5', min: 2, max: 2.5 },
    { bucket: '2,5 – 3', min: 2.5, max: 3 },
    { bucket: '3 – 3,5', min: 3, max: 3.5 },
    { bucket: '3,5 – 4', min: 3.5, max: 4 },
    { bucket: '≥ 4', min: 4, max: Infinity },
  ]
  const notes = records.filter((r) => r.note != null).map((r) => r.note!)
  return buckets.map((b) => ({
    bucket: b.bucket,
    count: notes.filter((n) => n >= b.min && n < b.max).length,
  }))
}

export interface RiskEntry {
  nom: string
  secteur: string
  annee: number
  note: number
  ca: number | null
  motif: string
  gravite: 'critical' | 'warning'
}

/** Repère, pour la dernière année disponible de chaque secteur, les fournisseurs à surveiller. */
export function riskWatchlist(all: EvalRecord[], limit = 40): RiskEntry[] {
  const entries: RiskEntry[] = []
  // "Général" est un bucket historique mixte (avant la scission par secteur), pas un secteur
  // opérationnel actuel : l'exclure évite de noyer la watchlist sous des centaines de faux positifs.
  const secteurs = Array.from(new Set(all.map((r) => r.secteur))).filter((s) => s !== 'Général')

  for (const secteur of secteurs) {
    const annees = anneesDisponibles(all, secteur)
    if (annees.length === 0) continue
    const dernier = annees[0]
    const precedent = annees.includes(dernier - 1) ? dernier - 1 : null

    const current = all.filter((r) => r.secteur === secteur && r.annee === dernier && r.note != null)
    const previous = precedent != null ? all.filter((r) => r.secteur === secteur && r.annee === precedent && r.note != null) : []
    const prevByNom = new Map(previous.map((r) => [r.nom, r.note!]))
    const historiqueNoms = new Set(all.filter((r) => r.secteur === secteur && r.annee < dernier && r.note != null).map((r) => r.nom))

    const cas = current.filter((r) => r.ca != null).map((r) => r.ca!)
    const caThreshold = cas.length ? [...cas].sort((a, b) => b - a)[Math.max(0, Math.floor(cas.length * 0.2) - 1)] : null

    for (const r of current) {
      const noteVal = r.note!
      if (noteVal < 2) {
        entries.push({ nom: r.nom, secteur, annee: dernier, note: noteVal, ca: r.ca, motif: 'Note critique (< 2)', gravite: 'critical' })
      }
      const prev = prevByNom.get(r.nom)
      if (prev != null && noteVal - prev <= -0.5) {
        entries.push({
          nom: r.nom,
          secteur,
          annee: dernier,
          note: noteVal,
          ca: r.ca,
          motif: `Forte baisse (${prev} → ${noteVal})`,
          gravite: 'warning',
        })
      }
      if (caThreshold != null && r.ca != null && r.ca >= caThreshold && noteVal < 3) {
        entries.push({
          nom: r.nom,
          secteur,
          annee: dernier,
          note: noteVal,
          ca: r.ca,
          motif: 'Fort volume d\'achat mais note < 3 (top 20% CA)',
          gravite: 'critical',
        })
      }
      if (!historiqueNoms.has(r.nom) && noteVal < 2.5) {
        entries.push({
          nom: r.nom,
          secteur,
          annee: dernier,
          note: noteVal,
          ca: r.ca,
          motif: 'Nouveau fournisseur avec note faible dès la première évaluation',
          gravite: 'warning',
        })
      }
    }
  }

  const seen = new Set<string>()
  const deduped = entries.filter((e) => {
    const key = `${e.nom}|${e.secteur}|${e.motif}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return deduped
    .sort((a, b) => {
      if (a.gravite !== b.gravite) return a.gravite === 'critical' ? -1 : 1
      return (b.ca ?? 0) - (a.ca ?? 0)
    })
    .slice(0, limit)
}

export interface Mover {
  nom: string
  secteur: string
  anneeActuelle: number
  noteActuelle: number
  noteAnterieure: number
  evolution: number
}

export function topMovers(all: EvalRecord[], secteur: string, limit = 10): { hausses: Mover[]; baisses: Mover[] } {
  const annees = anneesDisponibles(all, secteur)
  if (annees.length < 2) return { hausses: [], baisses: [] }
  const dernier = annees[0]
  const precedent = annees.includes(dernier - 1) ? dernier - 1 : annees[1]
  const current = all.filter((r) => r.secteur === secteur && r.annee === dernier && r.note != null)
  const previous = new Map(all.filter((r) => r.secteur === secteur && r.annee === precedent && r.note != null).map((r) => [r.nom, r.note!]))

  const movers: Mover[] = []
  for (const r of current) {
    const prev = previous.get(r.nom)
    if (prev != null) {
      movers.push({ nom: r.nom, secteur, anneeActuelle: dernier, noteActuelle: r.note!, noteAnterieure: prev, evolution: Math.round((r.note! - prev) * 100) / 100 })
    }
  }
  const hausses = [...movers].sort((a, b) => b.evolution - a.evolution).slice(0, limit).filter((m) => m.evolution > 0)
  const baisses = [...movers].sort((a, b) => a.evolution - b.evolution).slice(0, limit).filter((m) => m.evolution < 0)
  return { hausses, baisses }
}

// ============ Zoom fournisseur ============

export interface SupplierSummary {
  nom: string
  secteurs: string[]
  dernierNote: number | null
  dernierAnnee: number | null
  nbEvaluations: number
}

export function listSuppliers(all: EvalRecord[]): SupplierSummary[] {
  const bucket = new Map<string, EvalRecord[]>()
  for (const r of all) {
    if (r.note == null) continue
    if (!bucket.has(r.nom)) bucket.set(r.nom, [])
    bucket.get(r.nom)!.push(r)
  }
  return Array.from(bucket.entries())
    .map(([nom, recs]) => {
      const sorted = [...recs].sort((a, b) => b.annee - a.annee)
      return {
        nom,
        secteurs: Array.from(new Set(recs.map((r) => r.secteur))),
        dernierNote: sorted[0]?.note ?? null,
        dernierAnnee: sorted[0]?.annee ?? null,
        nbEvaluations: recs.length,
      }
    })
    .sort((a, b) => a.nom.localeCompare(b.nom))
}

export function supplierHistory(all: EvalRecord[], nom: string): EvalRecord[] {
  return all
    .filter((r) => r.nom === nom && r.note != null)
    .sort((a, b) => b.annee - a.annee || a.secteur.localeCompare(b.secteur))
}

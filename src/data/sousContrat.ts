import data from './fournisseursSousContrat.json'

// Fournisseurs sous contrat (liste du propriétaire, doublons fusionnés : un contrat peut couvrir plusieurs
// numéros fournisseur — ex. CREABETON, GYGER —, un numéro n'est compté qu'une fois). Liste sans correspondance
// dans les journaux : `SANS_CORRESPONDANCE` (ALIGRO, BAUWERK, CRISTALINE, DIETRICH, MAPEI).
// `depuis` = première année du contrat : CHALLANDE, CREABETON, LEVIAT depuis 2025 ; JURACIME, VIGIER, PRO BETON,
// GRUYERE METAL, VISTONA depuis 2026 (les autres : contrats antérieurs à l'historique). Une dépense n'est « sous
// contrat » qu'à partir de l'année de début du contrat.

interface Contrat {
  contrat: string
  nfr: number[]
  depuis?: number
}
const contrats = data.fournisseurs as Contrat[]
const parNfr = new Map<number, Contrat>()
for (const c of contrats) for (const n of c.nfr) parNfr.set(n, c)

export const CONTRATS: Contrat[] = contrats
export const SANS_CORRESPONDANCE: string[] = data.sansCorrespondance

/** Sous contrat ? Avec `annee` : contrat en vigueur cette année-là ; sans : contrat existant (toutes années). */
export const sousContrat = (nfr: number, annee?: string | number) => {
  const c = parNfr.get(nfr)
  if (!c) return false
  return annee == null || !c.depuis || Number(annee) >= c.depuis
}
export const contratDe = (nfr: number) => parNfr.get(nfr)?.contrat ?? null
export const contratDepuis = (nfr: number) => parNfr.get(nfr)?.depuis ?? null

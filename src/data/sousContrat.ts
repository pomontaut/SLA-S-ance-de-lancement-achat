import data from './fournisseursSousContrat.json'

// Fournisseurs sous contrat (liste du propriétaire, doublons fusionnés : un contrat peut couvrir plusieurs
// numéros fournisseur — ex. CREABETON, GYGER —, un numéro n'est compté qu'une fois). Liste sans correspondance
// dans les journaux : `SANS_CORRESPONDANCE` (ALIGRO, BAUWERK, CRISTALINE, DIETRICH, MAPEI).

const parNfr = new Map<number, string>()
for (const c of data.fournisseurs) for (const n of c.nfr) parNfr.set(n, c.contrat)

export const NFR_SOUS_CONTRAT: ReadonlySet<number> = new Set(parNfr.keys())
export const CONTRATS: { contrat: string; nfr: number[] }[] = data.fournisseurs
export const SANS_CORRESPONDANCE: string[] = data.sansCorrespondance

export const sousContrat = (nfr: number) => parNfr.has(nfr)
export const contratDe = (nfr: number) => parNfr.get(nfr) ?? null

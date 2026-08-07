export interface Fournisseur {
  id: number | null
  nom: string
  adresse: string
  npa: string
  lieu: string
  telephone: string
  email: string
  tva: string
}

let cache: Fournisseur[] | null = null
let pending: Promise<Fournisseur[]> | null = null

export function loadFournisseurs(): Promise<Fournisseur[]> {
  if (cache) return Promise.resolve(cache)
  if (!pending) {
    pending = import('./fournisseurs.json').then((mod) => {
      cache = mod.default as unknown as Fournisseur[]
      return cache
    })
  }
  return pending
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export async function searchFournisseurs(query: string, limit = 50): Promise<Fournisseur[]> {
  const all = await loadFournisseurs()
  const q = normalize(query.trim())
  if (!q) return all.slice(0, limit)
  const terms = q.split(/\s+/)
  const results: Fournisseur[] = []
  for (const f of all) {
    const haystack = normalize(`${f.nom} ${f.adresse} ${f.npa} ${f.lieu}`)
    if (terms.every((t) => haystack.includes(t))) {
      results.push(f)
      if (results.length >= limit) break
    }
  }
  return results
}

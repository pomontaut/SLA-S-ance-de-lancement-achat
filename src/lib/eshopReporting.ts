import { supabase } from './supabase'
import { normNomDepense } from '../data/depenses'

/** Reporting articles des commandes ESHOP-INDUNI (export `GET /api/reporting/sla`, relayé par l'Edge
 * Function "eshop-reporting"). Les prix des fournisseurs à prix confidentiel sont déjà masqués (null). */
export interface EshopArticle {
  supplier: string
  reference: string
  name: string
  famille: string | null
  unite: string | null
  qty: number
  nbOrders: number
  amount: number | null
  avgPrice: number | null
  lastPrice: number | null
  catalogPrice: number | null
  priceVariationPct: number | null
  gain: number | null
  confidential: boolean
}

export interface EshopOrderItem {
  article: string | null
  designation: string | null
  unite: string | null
  qty: number
  unitPrice: number | null
  amount: number | null
}

export interface EshopOrder {
  no: string
  date: string
  supplier: string
  chantier: string | null
  status: string | null
  total: number | null
  extraCharges: number | null
  confidential: boolean
  items: EshopOrderItem[]
}

export interface EshopKpis {
  nbOrders: number
  nbOrdersAll: number
  nbCancelled: number
  nbSuperseded: number
  nbEmailNotSent: number
  nbPendingApproval: number
  nbRefused: number
  nbRelanced: number
  nbReceptionConfirmed: number
  nbInvoiced: number
  nbActiveUsers: number
  nbChantiers: number
  nbArticlesOrdered: number
  nbCatalogArticles: number
  nbCatalogNeverOrdered: number
  gainVsCatalog: number
  nbPricesChanged: number
}

export interface EshopReport {
  kpis: EshopKpis
  articles: EshopArticle[]
  suppliers: { name: string; nbArticles: number; qty: number; nbOrders: number; amount: number | null; confidential: boolean }[]
  months: { month: string; nbOrders: number; amount: number; users: number }[]
  orders: EshopOrder[]
}

let cache: Promise<EshopReport> | null = null

/** Charge (et met en cache pour la session) le reporting e-shop. */
export function loadEshopReport(force = false): Promise<EshopReport> {
  if (!supabase) return Promise.reject(new Error('Supabase non configuré.'))
  if (!cache || force) {
    cache = supabase.functions.invoke('eshop-reporting', { body: {} }).then(({ data, error }) => {
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as EshopReport
    })
    cache.catch(() => {
      cache = null
    })
  }
  return cache
}

/** Les noms e-shop (« HG COMMERCIALE ») et comptables (« HG COMMERCIALE SA ») ne sont pas identiques :
 * rapprochement par préfixe sur le nom normalisé, comme `findDepenseFournisseur`. */
export function sameSupplier(eshopName: string, nom: string): boolean {
  const a = normNomDepense(eshopName)
  const b = normNomDepense(nom)
  if (!a || !b) return false
  return a === b || (a.length >= 6 && b.startsWith(a)) || (b.length >= 6 && a.startsWith(b))
}

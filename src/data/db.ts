import { supabase } from '../lib/supabase'
import type { Acheteur, Dossier, Lot, NewDossier, NewLot, Suivi } from '../types'

function requireClient() {
  if (!supabase) throw new Error('Supabase non configuré (variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes).')
  return supabase
}

interface DossierRow {
  id: string
  numero_chantier: string
  adresse: string
  client: string
  architecte: string
  ingenieur: string
  conducteur_travaux: string
  contremaitre: string
  typologie_travaux: string
  planning_demarrage: string
  planning_fin: string
  conditions: string
  garanties: string
  deductions_contractuelles: string
  documents_disposition: string[]
  particularites: string[]
  acheteurs: Acheteur[]
  created_at: string
  updated_at: string
}

interface LotRow {
  id: string
  dossier_id: string
  categorie: string
  designation: string
  acheteur_initiales: string
  date_livraison_estimative: string
  quantite: string
  budget_pu: string
  budget_theo: number | null
  remarques: string
  suivi: string
  position: number
}

function dossierFromRow(row: DossierRow): Dossier {
  return {
    id: row.id,
    numeroChantier: row.numero_chantier,
    adresse: row.adresse,
    client: row.client,
    architecte: row.architecte,
    ingenieur: row.ingenieur,
    conducteurTravaux: row.conducteur_travaux,
    contremaitre: row.contremaitre,
    typologieTravaux: row.typologie_travaux,
    planningDemarrage: row.planning_demarrage,
    planningFin: row.planning_fin,
    conditions: row.conditions,
    garanties: row.garanties,
    deductionsContractuelles: row.deductions_contractuelles,
    documentsDisposition: row.documents_disposition ?? [],
    particularites: row.particularites ?? [],
    acheteurs: row.acheteurs ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function dossierToRow(d: NewDossier | Dossier) {
  return {
    numero_chantier: d.numeroChantier,
    adresse: d.adresse,
    client: d.client,
    architecte: d.architecte,
    ingenieur: d.ingenieur,
    conducteur_travaux: d.conducteurTravaux,
    contremaitre: d.contremaitre,
    typologie_travaux: d.typologieTravaux,
    planning_demarrage: d.planningDemarrage,
    planning_fin: d.planningFin,
    conditions: d.conditions,
    garanties: d.garanties,
    deductions_contractuelles: d.deductionsContractuelles,
    documents_disposition: d.documentsDisposition,
    particularites: d.particularites,
    acheteurs: d.acheteurs,
    updated_at: new Date().toISOString(),
  }
}

function lotFromRow(row: LotRow): Lot {
  return {
    id: row.id,
    dossierId: row.dossier_id,
    categorie: row.categorie,
    designation: row.designation,
    acheteurInitiales: row.acheteur_initiales,
    dateLivraisonEstimative: row.date_livraison_estimative,
    quantite: row.quantite,
    budgetPu: row.budget_pu,
    budgetTheo: row.budget_theo,
    remarques: row.remarques,
    suivi: row.suivi as Suivi,
    position: row.position,
  }
}

function lotToRow(l: NewLot | Lot) {
  return {
    dossier_id: l.dossierId,
    categorie: l.categorie,
    designation: l.designation,
    acheteur_initiales: l.acheteurInitiales,
    date_livraison_estimative: l.dateLivraisonEstimative,
    quantite: l.quantite,
    budget_pu: l.budgetPu,
    budget_theo: l.budgetTheo,
    remarques: l.remarques,
    suivi: l.suivi,
    position: l.position,
  }
}

export async function listDossiers(): Promise<Dossier[]> {
  const { data, error } = await requireClient()
    .from('dossiers')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as DossierRow[]).map(dossierFromRow)
}

export async function getDossier(id: string): Promise<Dossier> {
  const { data, error } = await requireClient().from('dossiers').select('*').eq('id', id).single()
  if (error) throw error
  return dossierFromRow(data as DossierRow)
}

export async function createDossier(input: NewDossier): Promise<Dossier> {
  const { data, error } = await requireClient().from('dossiers').insert(dossierToRow(input)).select().single()
  if (error) throw error
  return dossierFromRow(data as DossierRow)
}

export async function updateDossier(dossier: Dossier): Promise<Dossier> {
  const { data, error } = await requireClient()
    .from('dossiers')
    .update(dossierToRow(dossier))
    .eq('id', dossier.id)
    .select()
    .single()
  if (error) throw error
  return dossierFromRow(data as DossierRow)
}

export async function deleteDossier(id: string): Promise<void> {
  const { error } = await requireClient().from('dossiers').delete().eq('id', id)
  if (error) throw error
}

export async function listLots(dossierId: string): Promise<Lot[]> {
  const { data, error } = await requireClient()
    .from('lots')
    .select('*')
    .eq('dossier_id', dossierId)
    .order('position', { ascending: true })
  if (error) throw error
  return (data as LotRow[]).map(lotFromRow)
}

export async function createLot(input: NewLot): Promise<Lot> {
  const { data, error } = await requireClient().from('lots').insert(lotToRow(input)).select().single()
  if (error) throw error
  return lotFromRow(data as LotRow)
}

export async function updateLot(lot: Lot): Promise<Lot> {
  const { data, error } = await requireClient().from('lots').update(lotToRow(lot)).eq('id', lot.id).select().single()
  if (error) throw error
  return lotFromRow(data as LotRow)
}

export async function deleteLot(id: string): Promise<void> {
  const { error } = await requireClient().from('lots').delete().eq('id', id)
  if (error) throw error
}

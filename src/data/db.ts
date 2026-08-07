import { supabase } from '../lib/supabase'
import type { ChecklistItem, Dossier, Evaluation, Lot, NewChecklistItem, NewDossier, NewEvaluation, NewLot } from '../types'
import { CHECKLIST_TEMPLATE } from './lists'

function requireClient() {
  if (!supabase) throw new Error('Supabase non configuré (variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes).')
  return supabase
}

interface DossierRow {
  id: string
  numero_chantier: string
  adresse: string
  client: string
  fiche: Record<string, string>
  created_at: string
  updated_at: string
}

function dossierFromRow(row: DossierRow): Dossier {
  return {
    id: row.id,
    numeroChantier: row.numero_chantier,
    adresse: row.adresse,
    client: row.client,
    fiche: row.fiche ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function dossierToRow(d: NewDossier | Dossier) {
  return {
    numero_chantier: d.numeroChantier,
    adresse: d.adresse,
    client: d.client,
    fiche: d.fiche,
    updated_at: new Date().toISOString(),
  }
}

export async function listDossiers(): Promise<Dossier[]> {
  const { data, error } = await requireClient().from('dossiers').select('*').order('updated_at', { ascending: false })
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
  const dossier = dossierFromRow(data as DossierRow)

  const items: NewChecklistItem[] = CHECKLIST_TEMPLATE.map((t, i) => ({
    dossierId: dossier.id,
    position: i,
    categorie: t.categorie,
    document: t.document,
    requis: 'Oui',
    statut: 'À confirmer',
    versionDate: '',
    responsable: '',
    echeance: '',
    lienRemarque: '',
  }))
  const { error: seedError } = await requireClient()
    .from('checklist_items')
    .insert(items.map(checklistItemToRow))
  if (seedError) throw seedError

  return dossier
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

interface LotRow {
  id: string
  dossier_id: string
  position: number
  priorite: string
  cfc_code: string
  famille_lot: string
  description_technique: string
  acheteur: string
  resp_travaux: string
  type_achat: string
  mise_en_concurrence: string
  fournisseur_impose: string
  fournisseurs_a_consulter: string
  fournisseur_choisi: string
  budget_ctx: number | null
  budget_achat_be: number | null
  deduction_pct: number | null
  montant_commande: number | null
  quantite: number | null
  unite: string
  date_remise_besoin_ctx: string | null
  preparation_dossier: string | null
  lancement_consultation: string | null
  retour_offres: string | null
  choix_fournisseur: string | null
  date_commande: string | null
  premiere_livraison: string | null
  derniere_livraison: string | null
  documents_plans_necessaires: string
  statut: string
  prochaine_action: string
  remarques_lien: string
}

function lotFromRow(row: LotRow): Lot {
  return {
    id: row.id,
    dossierId: row.dossier_id,
    position: row.position,
    priorite: row.priorite,
    cfcCode: row.cfc_code,
    familleLot: row.famille_lot,
    descriptionTechnique: row.description_technique,
    acheteur: row.acheteur,
    respTravaux: row.resp_travaux,
    typeAchat: row.type_achat,
    miseEnConcurrence: row.mise_en_concurrence,
    fournisseurImpose: row.fournisseur_impose,
    fournisseursAConsulter: row.fournisseurs_a_consulter,
    fournisseurChoisi: row.fournisseur_choisi,
    budgetCtx: row.budget_ctx,
    budgetAchatBe: row.budget_achat_be,
    deductionPct: row.deduction_pct,
    montantCommande: row.montant_commande,
    quantite: row.quantite,
    unite: row.unite,
    dateRemiseBesoinCtx: row.date_remise_besoin_ctx ?? '',
    preparationDossier: row.preparation_dossier ?? '',
    lancementConsultation: row.lancement_consultation ?? '',
    retourOffres: row.retour_offres ?? '',
    choixFournisseur: row.choix_fournisseur ?? '',
    dateCommande: row.date_commande ?? '',
    premiereLivraison: row.premiere_livraison ?? '',
    derniereLivraison: row.derniere_livraison ?? '',
    documentsPlansNecessaires: row.documents_plans_necessaires,
    statut: row.statut,
    prochaineAction: row.prochaine_action,
    remarquesLien: row.remarques_lien,
  }
}

function orNull(value: string): string | null {
  return value === '' ? null : value
}

function lotToRow(l: NewLot | Lot) {
  return {
    dossier_id: l.dossierId,
    position: l.position,
    priorite: l.priorite,
    cfc_code: l.cfcCode,
    famille_lot: l.familleLot,
    description_technique: l.descriptionTechnique,
    acheteur: l.acheteur,
    resp_travaux: l.respTravaux,
    type_achat: l.typeAchat,
    mise_en_concurrence: l.miseEnConcurrence,
    fournisseur_impose: l.fournisseurImpose,
    fournisseurs_a_consulter: l.fournisseursAConsulter,
    fournisseur_choisi: l.fournisseurChoisi,
    budget_ctx: l.budgetCtx,
    budget_achat_be: l.budgetAchatBe,
    deduction_pct: l.deductionPct,
    montant_commande: l.montantCommande,
    quantite: l.quantite,
    unite: l.unite,
    date_remise_besoin_ctx: orNull(l.dateRemiseBesoinCtx),
    preparation_dossier: orNull(l.preparationDossier),
    lancement_consultation: orNull(l.lancementConsultation),
    retour_offres: orNull(l.retourOffres),
    choix_fournisseur: orNull(l.choixFournisseur),
    date_commande: orNull(l.dateCommande),
    premiere_livraison: orNull(l.premiereLivraison),
    derniere_livraison: orNull(l.derniereLivraison),
    documents_plans_necessaires: l.documentsPlansNecessaires,
    statut: l.statut,
    prochaine_action: l.prochaineAction,
    remarques_lien: l.remarquesLien,
  }
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

interface ChecklistItemRow {
  id: string
  dossier_id: string
  position: number
  categorie: string
  document: string
  requis: string
  statut: string
  version_date: string
  responsable: string
  echeance: string
  lien_remarque: string
}

function checklistItemFromRow(row: ChecklistItemRow): ChecklistItem {
  return {
    id: row.id,
    dossierId: row.dossier_id,
    position: row.position,
    categorie: row.categorie,
    document: row.document,
    requis: row.requis,
    statut: row.statut,
    versionDate: row.version_date,
    responsable: row.responsable,
    echeance: row.echeance,
    lienRemarque: row.lien_remarque,
  }
}

function checklistItemToRow(i: NewChecklistItem | ChecklistItem) {
  return {
    dossier_id: i.dossierId,
    position: i.position,
    categorie: i.categorie,
    document: i.document,
    requis: i.requis,
    statut: i.statut,
    version_date: i.versionDate,
    responsable: i.responsable,
    echeance: i.echeance,
    lien_remarque: i.lienRemarque,
  }
}

export async function listChecklistItems(dossierId: string): Promise<ChecklistItem[]> {
  const { data, error } = await requireClient()
    .from('checklist_items')
    .select('*')
    .eq('dossier_id', dossierId)
    .order('position', { ascending: true })
  if (error) throw error
  return (data as ChecklistItemRow[]).map(checklistItemFromRow)
}

export async function createChecklistItem(input: NewChecklistItem): Promise<ChecklistItem> {
  const { data, error } = await requireClient()
    .from('checklist_items')
    .insert(checklistItemToRow(input))
    .select()
    .single()
  if (error) throw error
  return checklistItemFromRow(data as ChecklistItemRow)
}

export async function updateChecklistItem(item: ChecklistItem): Promise<ChecklistItem> {
  const { data, error } = await requireClient()
    .from('checklist_items')
    .update(checklistItemToRow(item))
    .eq('id', item.id)
    .select()
    .single()
  if (error) throw error
  return checklistItemFromRow(data as ChecklistItemRow)
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const { error } = await requireClient().from('checklist_items').delete().eq('id', id)
  if (error) throw error
}

interface EvaluationRow {
  id: string
  dossier_id: string
  lot_id: string | null
  fournisseur_nom: string
  date_evaluation: string | null
  evaluateur: string
  critere_qualite: number | null
  critere_delais: number | null
  critere_budget: number | null
  critere_communication: number | null
  critere_documentation: number | null
  critere_securite: number | null
  critere_sav: number | null
  recommandation: string
  commentaire: string
  statut: string
}

function evaluationFromRow(row: EvaluationRow): Evaluation {
  return {
    id: row.id,
    dossierId: row.dossier_id,
    lotId: row.lot_id,
    fournisseurNom: row.fournisseur_nom,
    dateEvaluation: row.date_evaluation ?? '',
    evaluateur: row.evaluateur,
    critereQualite: row.critere_qualite,
    critereDelais: row.critere_delais,
    critereBudget: row.critere_budget,
    critereCommunication: row.critere_communication,
    critereDocumentation: row.critere_documentation,
    critereSecurite: row.critere_securite,
    critereSav: row.critere_sav,
    recommandation: row.recommandation,
    commentaire: row.commentaire,
    statut: row.statut,
  }
}

function evaluationToRow(e: NewEvaluation | Evaluation) {
  return {
    dossier_id: e.dossierId,
    lot_id: e.lotId,
    fournisseur_nom: e.fournisseurNom,
    date_evaluation: orNull(e.dateEvaluation),
    evaluateur: e.evaluateur,
    critere_qualite: e.critereQualite,
    critere_delais: e.critereDelais,
    critere_budget: e.critereBudget,
    critere_communication: e.critereCommunication,
    critere_documentation: e.critereDocumentation,
    critere_securite: e.critereSecurite,
    critere_sav: e.critereSav,
    recommandation: e.recommandation,
    commentaire: e.commentaire,
    statut: e.statut,
  }
}

export async function listEvaluations(dossierId: string): Promise<Evaluation[]> {
  const { data, error } = await requireClient().from('evaluations').select('*').eq('dossier_id', dossierId)
  if (error) throw error
  return (data as EvaluationRow[]).map(evaluationFromRow)
}

export interface EvaluationHistoryEntry {
  evaluation: Evaluation
  dossier: { id: string; numeroChantier: string; adresse: string }
}

export async function listEvaluationsForSupplier(fournisseurNom: string, excludeDossierId?: string): Promise<EvaluationHistoryEntry[]> {
  if (!fournisseurNom.trim()) return []
  let query = requireClient()
    .from('evaluations')
    .select('*, dossiers ( id, numero_chantier, adresse )')
    .ilike('fournisseur_nom', fournisseurNom.trim())
    .eq('statut', 'Complété')
  if (excludeDossierId) query = query.neq('dossier_id', excludeDossierId)
  const { data, error } = await query
  if (error) throw error
  return (data as (EvaluationRow & { dossiers: { id: string; numero_chantier: string; adresse: string } | null })[]).map((row) => ({
    evaluation: evaluationFromRow(row),
    dossier: {
      id: row.dossiers?.id ?? '',
      numeroChantier: row.dossiers?.numero_chantier ?? '',
      adresse: row.dossiers?.adresse ?? '',
    },
  }))
}

export async function createEvaluation(input: NewEvaluation): Promise<Evaluation> {
  const { data, error } = await requireClient().from('evaluations').insert(evaluationToRow(input)).select().single()
  if (error) throw error
  return evaluationFromRow(data as EvaluationRow)
}

export async function updateEvaluation(evaluation: Evaluation): Promise<Evaluation> {
  const { data, error } = await requireClient()
    .from('evaluations')
    .update(evaluationToRow(evaluation))
    .eq('id', evaluation.id)
    .select()
    .single()
  if (error) throw error
  return evaluationFromRow(data as EvaluationRow)
}

export async function deleteEvaluation(id: string): Promise<void> {
  const { error } = await requireClient().from('evaluations').delete().eq('id', id)
  if (error) throw error
}

export async function ensureEvaluationForLot(lot: Lot): Promise<Evaluation | null> {
  if (!lot.fournisseurChoisi.trim()) return null
  const { data, error } = await requireClient().from('evaluations').select('*').eq('lot_id', lot.id)
  if (error) throw error
  const existing = (data as EvaluationRow[]).map(evaluationFromRow)
  if (existing.length > 0) return existing[0]
  return createEvaluation({
    dossierId: lot.dossierId,
    lotId: lot.id,
    fournisseurNom: lot.fournisseurChoisi,
    dateEvaluation: '',
    evaluateur: '',
    critereQualite: null,
    critereDelais: null,
    critereBudget: null,
    critereCommunication: null,
    critereDocumentation: null,
    critereSecurite: null,
    critereSav: null,
    recommandation: '',
    commentaire: '',
    statut: 'Brouillon',
  })
}

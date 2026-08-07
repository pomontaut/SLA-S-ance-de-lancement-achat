import { useEffect, useState } from 'react'
import type { Dossier, Lot } from '../types'
import { computeLot } from '../types'
import { createLot, deleteLot, listLots, updateLot } from '../data/db'
import { PRIORITE_OPTIONS, STATUT_LOT_OPTIONS, TYPE_ACHAT_OPTIONS, OUI_NON_OPTIONS, UNITE_OPTIONS } from '../data/lists'
import LotDetailPanel from './LotDetailPanel'

const PRIORITE_COLORS: Record<string, string> = {
  Critique: 'bg-red-100 text-red-700',
  Haute: 'bg-orange-100 text-orange-700',
  Normale: 'bg-slate-100 text-slate-600',
  Basse: 'bg-slate-50 text-slate-400',
}

const DELAI_COLORS: Record<string, string> = {
  'En retard': 'bg-red-100 text-red-700',
  '≤ 14 jours': 'bg-amber-100 text-amber-700',
  'Date manquante': 'bg-slate-100 text-slate-500',
  OK: 'bg-green-100 text-green-700',
}

const CONTROLE_COLORS: Record<string, string> = {
  'À compléter': 'bg-red-100 text-red-700',
  OK: 'bg-green-100 text-green-700',
}

function Badge({ text, colors }: { text: string; colors: Record<string, string> }) {
  if (!text) return <span className="text-slate-300">—</span>
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[text] ?? 'bg-slate-100 text-slate-600'}`}>
      {text}
    </span>
  )
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  return value.toLocaleString('fr-CH', { maximumFractionDigits: 0 }) + ' CHF'
}

function emptyLot(dossierId: string, position: number): Omit<Lot, 'id'> {
  return {
    dossierId,
    position,
    priorite: 'Normale',
    cfcCode: '',
    familleLot: '',
    descriptionTechnique: '',
    acheteur: '',
    respTravaux: '',
    typeAchat: TYPE_ACHAT_OPTIONS[0],
    miseEnConcurrence: OUI_NON_OPTIONS[0],
    fournisseurImpose: '',
    fournisseursAConsulter: '',
    fournisseurChoisi: '',
    budgetCtx: null,
    budgetAchatBe: null,
    deductionPct: null,
    montantCommande: null,
    quantite: null,
    unite: UNITE_OPTIONS[0],
    dateRemiseBesoinCtx: '',
    preparationDossier: '',
    lancementConsultation: '',
    retourOffres: '',
    choixFournisseur: '',
    dateCommande: '',
    premiereLivraison: '',
    derniereLivraison: '',
    documentsPlansNecessaires: '',
    statut: STATUT_LOT_OPTIONS[0],
    prochaineAction: '',
    remarquesLien: '',
  }
}

export default function SuiviHaTab({ dossier }: { dossier: Dossier }) {
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [dossier.id])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      setLots(await listLots(dossier.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    try {
      const created = await createLot(emptyLot(dossier.id, lots.length))
      setLots((prev) => [...prev, created])
      setDetailId(created.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce lot ?')) return
    try {
      await deleteLot(id)
      setLots((prev) => prev.filter((l) => l.id !== id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function handleLotSaved(updated: Lot) {
    setLots((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
  }

  if (loading) return <div className="text-sm text-slate-500">Chargement…</div>

  const detailLot = lots.find((l) => l.id === detailId) ?? null

  return (
    <div className="card">
      {error && <div className="text-sm text-red-600 mb-3">Erreur : {error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Priorité</th>
              <th className="py-2 pr-2">CFC</th>
              <th className="py-2 pr-2">Famille / lot</th>
              <th className="py-2 pr-2">Acheteur</th>
              <th className="py-2 pr-2">Statut</th>
              <th className="py-2 pr-2">Budget net cible</th>
              <th className="py-2 pr-2">Montant commande</th>
              <th className="py-2 pr-2">Écart</th>
              <th className="py-2 pr-2">1re livraison</th>
              <th className="py-2 pr-2">Délai / alerte</th>
              <th className="py-2 pr-2">Contrôle</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot, i) => {
              const c = computeLot(lot)
              return (
                <tr key={lot.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-slate-400">{i + 1}</td>
                  <td className="py-2 pr-2">
                    <Badge text={lot.priorite} colors={PRIORITE_COLORS} />
                  </td>
                  <td className="py-2 pr-2">{lot.cfcCode || '—'}</td>
                  <td className="py-2 pr-2 font-medium">{lot.familleLot || <span className="text-slate-300">Sans nom</span>}</td>
                  <td className="py-2 pr-2">{lot.acheteur || '—'}</td>
                  <td className="py-2 pr-2">{lot.statut || '—'}</td>
                  <td className="py-2 pr-2">{formatCurrency(c.budgetNetCible)}</td>
                  <td className="py-2 pr-2">{formatCurrency(lot.montantCommande)}</td>
                  <td className="py-2 pr-2">{formatCurrency(c.ecartBudget)}</td>
                  <td className="py-2 pr-2">{lot.premiereLivraison || '—'}</td>
                  <td className="py-2 pr-2">
                    <Badge text={c.delaiAlerte} colors={DELAI_COLORS} />
                  </td>
                  <td className="py-2 pr-2">
                    <Badge text={c.controle} colors={CONTROLE_COLORS} />
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <button className="btn-secondary mr-1" onClick={() => setDetailId(lot.id)}>
                      Détails
                    </button>
                    <button className="btn-danger" onClick={() => handleDelete(lot.id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200">
        <button className="btn-primary" onClick={handleAdd}>
          + Ajouter un lot
        </button>
      </div>

      {detailLot && (
        <LotDetailPanel
          lot={detailLot}
          onClose={() => setDetailId(null)}
          onSaved={handleLotSaved}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  )
}

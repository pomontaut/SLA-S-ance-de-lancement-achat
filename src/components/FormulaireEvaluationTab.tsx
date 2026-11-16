import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { EvaluationFormulaire, NewEvaluationFormulaire } from '../types'
import { FAMILLES_EVALUATION, NOTE_OPTIONS, criteresPourFamille, moyenneCriteres } from '../data/formulaireEvaluation'
import { createEvaluationFormulaire, deleteEvaluationFormulaire, listEvaluationsFormulaire, updateEvaluationFormulaire } from '../data/db'
import { loadFournisseurs } from '../data/fournisseurs'
import type { FournisseurChantier, PeriodeAnalyse } from '../data/chantierDepense'
import { SEUIL_EVALUATION_CHF, depenseDuChantier, familleEvaluationProposee, periodeAnneeEnCours } from '../data/chantierDepense'
import { loadDepensesFournisseurs } from '../data/depenses'
import SupplierPicker from './SupplierPicker'
import chantiersJson from '../data/chantiers.json'

// Entités du formulaire : EG est scindée en EG VD et EG GE (le secteur historique « EG GE/VD » des
// comparaisons n'est volontairement pas modifié ici). Les noms « BAT GE TRANSFO RENO » /
// « BAT VD TRANSFO RENO » sont ceux de l'analyse de dépense.
const ENTITES = ['GC', 'BAT GE', 'BAT VD', 'BAT GE TRANSFO RENO', 'BAT VD TRANSFO RENO', 'EG VD', 'EG GE', 'EG VS']

interface Chantier {
  numero: string
  nom: string
  entite: string
}
const CHANTIERS = chantiersJson as Chantier[]
const norm = (v: string) => v.trim().toLowerCase()

/** Chantier dont le numéro est exactement `numero`. */
function chantierParNumero(numero: string): Chantier | undefined {
  const n = numero.trim()
  return n ? CHANTIERS.find((c) => c.numero === n) : undefined
}

/** Chantier dont le nom est exactement `nom` (sans tenir compte de la casse) ; si plusieurs chantiers
 * portent ce nom, on prend celui de l'entité choisie, sinon aucun (pas de choix arbitraire). */
function chantierParNom(nom: string, entite: string): Chantier | undefined {
  const n = norm(nom)
  if (!n) return undefined
  const trouves = CHANTIERS.filter((c) => norm(c.nom) === n)
  if (trouves.length === 1) return trouves[0]
  return trouves.find((c) => c.entite === entite && entite !== '')
}

const EMPTY_FORM: NewEvaluationFormulaire = {
  famille: FAMILLES_EVALUATION[0].famille,
  entite: '',
  fournisseurId: null,
  fournisseurNom: '',
  numeroChantier: '',
  nomChantier: '',
  criteres: {},
  moyenne: null,
  remarques: '',
  evaluateur: '',
}

function NoteSelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <select
      className="input !w-[4.5rem] !py-1 !px-1.5 text-xs"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">—</option>
      {NOTE_OPTIONS.map((n) => (
        <option key={n} value={n}>
          {n} / 4
        </option>
      ))}
    </select>
  )
}

export default function FormulaireEvaluationTab() {
  const [form, setForm] = useState<NewEvaluationFormulaire>(EMPTY_FORM)
  const [editing, setEditing] = useState<EvaluationFormulaire | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evaluations, setEvaluations] = useState<EvaluationFormulaire[] | null>(null)
  // Série d'évaluations par chantier : liste des fournisseurs du chantier (coche auto >= seuil) puis un par un.
  const [depenseChantier, setDepenseChantier] = useState<{ code: string; lignes: FournisseurChantier[] } | 'chargement' | null>(null)
  const [selection, setSelection] = useState<Record<number, boolean>>({})
  // Période d'analyse du CA (année en cours par défaut) et fournisseurs ajoutés à la main (ex. consortium).
  const [periode, setPeriode] = useState<PeriodeAnalyse>(() => periodeAnneeEnCours())
  const [ajouts, setAjouts] = useState<FournisseurChantier[]>([])
  const [pickerAjoutOpen, setPickerAjoutOpen] = useState(false)
  const [nomLibre, setNomLibre] = useState('')
  const [serie, setSerie] = useState<{ liste: FournisseurChantier[]; index: number; termine: boolean; evalues: number } | null>(null)

  useEffect(() => {
    refresh()
  }, [])

  // Dès qu'un chantier connu est saisi, on charge ses fournisseurs (dépense réelle) et on coche ceux à évaluer.
  const serieActive = serie !== null
  const ajoutsRef = useRef<FournisseurChantier[]>([])
  ajoutsRef.current = ajouts
  // Changer de chantier repart d'une liste vierge (les ajouts à la main concernent un chantier précis).
  useEffect(() => {
    setAjouts([])
  }, [form.numeroChantier])
  useEffect(() => {
    const c = chantierParNumero(form.numeroChantier)
    if (serieActive) return
    if (!c || editing) {
      setDepenseChantier(null)
      return
    }
    let annule = false
    setDepenseChantier('chargement')
    depenseDuChantier(c.numero, periode)
      .then((lignes) => {
        if (annule) return
        setDepenseChantier({ code: c.numero, lignes })
        // Coche automatique (>= seuil) sur la période ; les fournisseurs ajoutés à la main restent cochés comme ils étaient.
        setSelection((prev) => ({
          ...Object.fromEntries(lignes.map((l) => [l.nfr, l.ca >= SEUIL_EVALUATION_CHF])),
          ...Object.fromEntries(ajoutsRef.current.map((a) => [a.nfr, prev[a.nfr] ?? true])),
        }))
      })
      .catch(() => !annule && setDepenseChantier(null))
    return () => {
      annule = true
    }
  }, [form.numeroChantier, serieActive, editing, periode])

  /** Lignes de la liste : fournisseurs du chantier sur la période + fournisseurs ajoutés à la main. */
  const lignesListe = useMemo<FournisseurChantier[]>(() => {
    if (!depenseChantier || depenseChantier === 'chargement') return []
    const deja = new Set(depenseChantier.lignes.map((l) => l.nfr))
    return [...depenseChantier.lignes, ...ajouts.filter((a) => !deja.has(a.nfr))]
  }, [depenseChantier, ajouts])

  /** Ajoute un fournisseur à la main (annuaire ou nom libre) ; famille proposée si on le connaît dans les dépenses. */
  async function ajouterFournisseur(nom: string, id: number | null) {
    const propre = nom.trim()
    if (!propre) return
    if (id != null && lignesListe.some((l) => l.nfr === id)) {
      setSelection((sel) => ({ ...sel, [id]: true })) // déjà dans la liste : on le coche simplement
      return
    }
    const connus = id != null ? (await loadDepensesFournisseurs().catch(() => [])).find((f) => f.nfr === id) : undefined
    const nfr = id ?? -(ajouts.length + 1 + Math.floor(Math.random() * 1e6))
    const ligne: FournisseurChantier = { nfr, nom: propre, familleAchat: connus?.familleAchat ?? null, ca: 0, nbFactures: 0, panier: null, manuel: true }
    setAjouts((a) => [...a, ligne])
    setSelection((sel) => ({ ...sel, [nfr]: true }))
    setNomLibre('')
  }

  function appliquerFournisseur(l: FournisseurChantier) {
    setForm((f) => ({
      ...f,
      fournisseurId: l.nfr > 0 ? l.nfr : null,
      fournisseurNom: l.nom,
      famille: familleEvaluationProposee(l.familleAchat, f.famille),
      criteres: {},
      moyenne: null,
      remarques: '',
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function demarrerSerie() {
    if (!depenseChantier || depenseChantier === 'chargement') return
    const liste = lignesListe.filter((l) => selection[l.nfr])
    if (liste.length === 0) {
      setError('Cochez au moins un fournisseur à évaluer.')
      return
    }
    setError(null)
    // Nom du fournisseur tel que dans l'annuaire (comme avec le bouton « Choisir… »), sinon nom de la dépense.
    const noms = new Map((await loadFournisseurs().catch(() => [])).map((a) => [a.id, a.nom]))
    const avecNoms = liste.map((l) => ({ ...l, nom: l.manuel ? l.nom : noms.get(l.nfr) ?? l.nom }))
    setSerie({ liste: avecNoms, index: 0, termine: false, evalues: 0 })
    appliquerFournisseur(avecNoms[0])
  }

  function avancer(evalues: number) {
    if (!serie) return
    const suivant = serie.index + 1
    if (suivant >= serie.liste.length) {
      setSerie({ ...serie, termine: true, evalues })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setSerie({ ...serie, index: suivant, evalues })
      appliquerFournisseur(serie.liste[suivant])
    }
  }

  async function enregistrerEtSuivant() {
    if (!serie) return
    const aDesNotes = Object.values(form.criteres).some((v) => v != null)
    if (!aDesNotes && !confirm('Aucune note saisie pour ce fournisseur. Passer au suivant sans l’enregistrer ?')) return
    setSaving(true)
    setError(null)
    try {
      let evalues = serie.evalues
      if (aDesNotes) {
        const created = await createEvaluationFormulaire(form)
        setEvaluations((prev) => (prev ? [created, ...prev] : [created]))
        evalues++
      }
      avancer(evalues)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  /** Série terminée : on repart sur un autre chantier (entité et évaluateur conservés). */
  function autreChantier() {
    setSerie(null)
    setDepenseChantier(null)
    setForm((f) => ({ ...EMPTY_FORM, entite: f.entite, evaluateur: f.evaluateur }))
  }

  const dejaEvalue = (l: FournisseurChantier, code: string) =>
    !!evaluations?.some((e) => e.numeroChantier === code && (e.fournisseurId === l.nfr || e.fournisseurNom.toLowerCase() === l.nom.toLowerCase()))

  async function refresh() {
    try {
      setEvaluations(await listEvaluationsFormulaire())
    } catch (e) {
      setError((e as Error).message)
      setEvaluations([])
    }
  }

  function set<K extends keyof NewEvaluationFormulaire>(key: K, value: NewEvaluationFormulaire[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setFamille(famille: string) {
    // Les critères dépendent de la famille — on repart d'une grille vierge en changeant de famille.
    setForm((f) => ({ ...f, famille, criteres: {}, moyenne: null }))
  }

  function setCritere(label: string, value: number | null) {
    setForm((f) => {
      const criteres = { ...f.criteres, [label]: value }
      return { ...f, criteres, moyenne: moyenneCriteres(criteres) }
    })
  }

  function resetForm() {
    setForm((f) => ({
      ...EMPTY_FORM,
      entite: f.entite,
      numeroChantier: f.numeroChantier,
      nomChantier: f.nomChantier,
      evaluateur: f.evaluateur,
    }))
    setEditing(null)
  }

  /** Remet tout le formulaire à zéro (y compris entité, chantier et évaluateur). */
  function handleReinitialiser() {
    setSerie(null)
    setDepenseChantier(null)
    setForm(EMPTY_FORM)
    setEditing(null)
    setError(null)
  }

  function setNumeroChantier(valeur: string) {
    const c = chantierParNumero(valeur)
    setForm((f) => ({
      ...f,
      numeroChantier: valeur,
      ...(c ? { nomChantier: c.nom, entite: c.entite && ENTITES.includes(c.entite) ? c.entite : f.entite } : {}),
    }))
  }

  function setNomChantier(valeur: string) {
    setForm((f) => {
      const c = chantierParNom(valeur, f.entite)
      return {
        ...f,
        nomChantier: valeur,
        ...(c ? { numeroChantier: c.numero, entite: c.entite && ENTITES.includes(c.entite) ? c.entite : f.entite } : {}),
      }
    })
  }

  function handleEdit(e: EvaluationFormulaire) {
    setForm({
      famille: e.famille,
      entite: e.entite,
      fournisseurId: e.fournisseurId,
      fournisseurNom: e.fournisseurNom,
      numeroChantier: e.numeroChantier,
      nomChantier: e.nomChantier,
      criteres: e.criteres,
      moyenne: e.moyenne,
      remarques: e.remarques,
      evaluateur: e.evaluateur,
    })
    setEditing(e)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    if (!form.fournisseurNom.trim()) {
      setError('Choisissez un fournisseur avant d’enregistrer.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        const updated = await updateEvaluationFormulaire({ ...editing, ...form })
        setEvaluations((prev) => (prev ? prev.map((e) => (e.id === updated.id ? updated : e)) : prev))
      } else {
        const created = await createEvaluationFormulaire(form)
        setEvaluations((prev) => (prev ? [created, ...prev] : [created]))
      }
      resetForm()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette évaluation ?')) return
    try {
      await deleteEvaluationFormulaire(id)
      setEvaluations((prev) => (prev ? prev.filter((e) => e.id !== id) : prev))
      if (editing?.id === id) resetForm()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const criteres = criteresPourFamille(form.famille)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold">Formulaire d'évaluation</h2>
        <p className="text-sm text-slate-500 mt-1">
          Les critères affichés dépendent de la famille choisie (Fournisseurs, Sous-traitants, Transporteurs…), sur le
          même modèle que l'évaluation annuelle de référence. Vous pouvez enchaîner l'évaluation de plusieurs
          fournisseurs à la suite.
        </p>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {serie?.termine ? (
        <div className="card text-center py-10 space-y-3 border-green-300 bg-green-50">
          <div className="text-3xl">✅</div>
          <p className="text-lg font-semibold text-green-800">Vous avez terminé l’évaluation fournisseur pour ce chantier.</p>
          <p className="text-sm text-slate-600">
            {form.numeroChantier} - {form.nomChantier} : {serie.evalues} évaluation(s) enregistrée(s) sur {serie.liste.length} fournisseur(s) sélectionné(s).
          </p>
          <button className="btn-primary" onClick={autreChantier}>
            Évaluer un autre chantier
          </button>
        </div>
      ) : (
      <div className="card space-y-5">
        {serie && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap text-sm font-semibold">
              <span>
                Évaluation du chantier {form.numeroChantier} - {form.nomChantier}
              </span>
              <span className="text-indigo-700">
                Fournisseur {serie.index + 1} / {serie.liste.length}
              </span>
            </div>
            <div className="h-2 bg-white rounded overflow-hidden">
              <div className="h-full bg-indigo-500" style={{ width: `${(serie.index / serie.liste.length) * 100}%` }} />
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-medium">{serie.liste[serie.index].nom}</span> · dépense {serie.liste[serie.index].ca.toLocaleString('fr-CH', { maximumFractionDigits: 0 })} CHF ·{' '}
              {serie.liste[serie.index].nbFactures} facture(s)
              {serie.liste[serie.index].panier != null && <> · panier moyen {serie.liste[serie.index].panier!.toLocaleString('fr-CH')} CHF</>}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Famille</label>
            <select className="input" value={form.famille} onChange={(e) => setFamille(e.target.value)}>
              {FAMILLES_EVALUATION.map((f) => (
                <option key={f.famille} value={f.famille}>
                  {f.famille}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fournisseur</label>
            <div className="flex gap-2">
              <input className="input bg-slate-50" readOnly value={form.fournisseurNom} placeholder="Aucun fournisseur choisi" />
              {!serie && (
                <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setPickerOpen(true)}>
                  Choisir…
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Entité</label>
            <select className="input" value={form.entite} onChange={(e) => set('entite', e.target.value)}>
              <option value="">— Choisir une entité —</option>
              {ENTITES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">N° chantier</label>
            <input
              className="input"
              list="chantiers-numeros"
              value={form.numeroChantier}
              onChange={(e) => setNumeroChantier(e.target.value)}
              placeholder="Tapez un numéro…"
            />
          </div>
          <div>
            <label className="label">Nom du chantier</label>
            <input
              className="input"
              list="chantiers-noms"
              value={form.nomChantier}
              onChange={(e) => setNomChantier(e.target.value)}
              placeholder="Tapez un nom…"
            />
          </div>
          <datalist id="chantiers-numeros">
            {CHANTIERS.map((c) => (
              <option key={c.numero} value={c.numero} label={c.nom} />
            ))}
          </datalist>
          <datalist id="chantiers-noms">
            {CHANTIERS.map((c) => (
              <option key={c.numero} value={c.nom} label={c.numero} />
            ))}
          </datalist>
        </div>

        {!serie && !editing && depenseChantier === 'chargement' && <p className="text-xs text-slate-500">Chargement des dépenses du chantier…</p>}
        {!serie && !editing && depenseChantier && depenseChantier !== 'chargement' && (
          <div className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">
                Fournisseurs du chantier {depenseChantier.code} - {form.nomChantier}
              </h3>
              <span className="text-xs text-slate-500">
                Dépense totale sur la période : {depenseChantier.lignes.reduce((t, l) => t + l.ca, 0).toLocaleString('fr-CH', { maximumFractionDigits: 0 })} CHF
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs bg-white rounded border border-slate-200 px-2 py-1.5">
              <span className="font-medium text-slate-600">Période d'analyse</span>
              <label className="flex items-center gap-1">
                de <input type="month" className="input !w-auto !py-0.5 text-xs" value={periode.de} onChange={(e) => e.target.value && setPeriode((p) => ({ ...p, de: e.target.value }))} />
              </label>
              <label className="flex items-center gap-1">
                à <input type="month" className="input !w-auto !py-0.5 text-xs" value={periode.a} onChange={(e) => e.target.value && setPeriode((p) => ({ ...p, a: e.target.value }))} />
              </label>
              <button type="button" className="text-indigo-600 hover:underline" onClick={() => setPeriode(periodeAnneeEnCours())}>
                Année en cours
              </button>
              <button type="button" className="text-indigo-600 hover:underline" onClick={() => setPeriode(periodeAnneeEnCours(new Date().getFullYear() - 1))}>
                Année précédente
              </button>
              <button type="button" className="text-indigo-600 hover:underline" onClick={() => setPeriode({ de: '2000-01', a: '2099-12' })}>
                Toutes années
              </button>
            </div>

            {lignesListe.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune dépense enregistrée sur ce chantier pour cette période (vous pouvez ajouter un fournisseur à la main ci-dessous).</p>
            ) : (
              <p className="text-xs text-slate-500">
                Coche automatique : fournisseurs ayant dépensé au moins {SEUIL_EVALUATION_CHF.toLocaleString('fr-CH')} CHF sur ce chantier pendant la période (modifiable).
              </p>
            )}
            {lignesListe.length > 0 && (
              <div className="max-h-80 overflow-auto bg-white rounded border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-1.5 px-2 w-8">À évaluer</th>
                      <th className="py-1.5 px-2">Fournisseur</th>
                      <th className="py-1.5 px-2 text-right">Factures</th>
                      <th className="py-1.5 px-2 text-right">CA (CHF)</th>
                      <th className="py-1.5 px-2 text-right">Panier moyen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesListe.map((l) => (
                      <tr key={l.nfr} className={`border-b border-slate-100 ${selection[l.nfr] ? 'bg-indigo-50/60' : ''}`}>
                        <td className="py-1 px-2 text-center">
                          <input type="checkbox" checked={!!selection[l.nfr]} onChange={(e) => setSelection((sel) => ({ ...sel, [l.nfr]: e.target.checked }))} />
                        </td>
                        <td className="py-1 px-2 font-medium">
                          {l.nom}
                          {l.manuel && <span className="ml-1.5 text-[10px] font-normal text-amber-700 bg-amber-100 rounded px-1">ajouté à la main</span>}
                          {dejaEvalue(l, depenseChantier.code) && <span className="ml-1.5 text-[10px] font-normal text-green-700 bg-green-100 rounded px-1">déjà évalué</span>}
                          {l.manuel && (
                            <button
                              type="button"
                              className="ml-1.5 text-[10px] text-red-600 hover:underline"
                              onClick={() => {
                                setAjouts((a) => a.filter((x) => x.nfr !== l.nfr))
                                setSelection((sel) => {
                                  const { [l.nfr]: _retire, ...reste } = sel
                                  return reste
                                })
                              }}
                            >
                              retirer
                            </button>
                          )}
                        </td>
                        <td className="py-1 px-2 text-right tabular-nums">{l.nbFactures.toLocaleString('fr-CH')}</td>
                        <td className="py-1 px-2 text-right tabular-nums">{l.manuel && l.ca === 0 ? '—' : l.ca.toLocaleString('fr-CH', { maximumFractionDigits: 0 })}</td>
                        <td className="py-1 px-2 text-right tabular-nums">{l.panier != null ? l.panier.toLocaleString('fr-CH') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs bg-white rounded border border-dashed border-slate-300 px-2 py-1.5">
              <span className="font-medium text-slate-600">Ajouter un fournisseur à la main</span>
              <button type="button" className="btn-secondary !py-0.5 text-xs" onClick={() => setPickerAjoutOpen(true)}>
                Choisir dans l'annuaire…
              </button>
              <span className="text-slate-400">ou nom libre</span>
              <input className="input !w-48 !py-0.5 text-xs" placeholder="Nom du fournisseur" value={nomLibre} onChange={(e) => setNomLibre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ajouterFournisseur(nomLibre, null)} />
              <button type="button" className="btn-secondary !py-0.5 text-xs" disabled={!nomLibre.trim()} onClick={() => ajouterFournisseur(nomLibre, null)}>
                Ajouter
              </button>
              <span className="text-slate-400">(ex. consortium, dépense non rattachée à ce chantier)</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" className="btn-primary" onClick={demarrerSerie}>
                Valider la sélection ({lignesListe.filter((l) => selection[l.nfr]).length} fournisseur(s)) →
              </button>
              <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => setSelection(Object.fromEntries(lignesListe.map((l) => [l.nfr, true])))}>
                Tout cocher
              </button>
              <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => setSelection({})}>
                Tout décocher
              </button>
              <button
                type="button"
                className="text-xs text-indigo-600 hover:underline"
                onClick={() => setSelection(Object.fromEntries(lignesListe.map((l) => [l.nfr, l.manuel || l.ca >= SEUIL_EVALUATION_CHF])))}
              >
                Remettre la coche automatique
              </button>
            </div>
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-3 text-sm uppercase text-slate-500">
            Critères — {form.famille}
            {form.famille !== 'FOURNISSEURS' &&
              (form.famille === 'FOURNISSEURS (SANS FACTURATION DIRECTE)' || form.famille === 'MARCHANDS') && (
                <span className="normal-case font-normal text-slate-400"> (mêmes critères que Fournisseurs)</span>
              )}
          </h3>
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-x-3 gap-y-1.5 items-center">
            {criteres.map((label) => (
              <Fragment key={label}>
                <span className="text-sm truncate" title={label}>
                  {label}
                </span>
                <NoteSelect value={form.criteres[label] ?? null} onChange={(v) => setCritere(label, v)} />
              </Fragment>
            ))}
          </div>
          <div className="mt-3 text-sm font-medium">Moyenne : {form.moyenne != null ? `${form.moyenne} / 4` : '—'}</div>
        </div>

        <div>
          <label className="label">Remarques</label>
          <textarea className="input min-h-[80px]" value={form.remarques} onChange={(e) => set('remarques', e.target.value)} />
        </div>

        <div>
          <label className="label">Évaluateur</label>
          <input className="input" value={form.evaluateur} onChange={(e) => set('evaluateur', e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
          {serie ? (
            <>
              <button className="btn-primary" disabled={saving} onClick={enregistrerEtSuivant}>
                {saving ? 'Enregistrement…' : serie.index + 1 >= serie.liste.length ? 'Enregistrer et terminer ✓' : 'Enregistrer et suivant →'}
              </button>
              <button className="btn-secondary" disabled={saving} onClick={() => avancer(serie.evalues)}>
                Passer ce fournisseur
              </button>
              <button className="btn-secondary" disabled={saving} onClick={() => setSerie(null)}>
                Arrêter la série
              </button>
            </>
          ) : (
            <>
              <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
                {saving ? 'Enregistrement…' : editing ? 'Mettre à jour cette évaluation' : 'Enregistrer et évaluer un autre fournisseur'}
              </button>
              {editing && (
                <button className="btn-secondary" disabled={saving} onClick={resetForm}>
                  Annuler la modification
                </button>
              )}
            </>
          )}
          <button className="btn-secondary" disabled={saving} onClick={handleReinitialiser}>
            Réinitialiser
          </button>
        </div>
      </div>
      )}

      <div className="card">
        <h3 className="font-semibold mb-3">Évaluations enregistrées{evaluations ? ` (${evaluations.length})` : ''}</h3>
        {!evaluations ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : evaluations.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune évaluation enregistrée pour l'instant.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {evaluations.map((e) => (
              <div key={e.id} className="py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-sm">
                    {e.fournisseurNom}{' '}
                    <span className="text-xs text-slate-400 font-normal">
                      — {e.famille}
                      {e.entite ? ` · ${e.entite}` : ''}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {[e.numeroChantier, e.nomChantier].filter(Boolean).join(' — ') || 'Chantier non renseigné'}
                    {e.moyenne != null ? ` · Moyenne ${e.moyenne} / 4` : ''}
                    {e.evaluateur ? ` · ${e.evaluateur}` : ''}
                  </div>
                  {e.remarques && <div className="text-xs text-slate-400 mt-1">{e.remarques}</div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="text-xs text-indigo-600 hover:underline" onClick={() => handleEdit(e)}>
                    Modifier
                  </button>
                  <button className="text-xs text-red-600 hover:underline" onClick={() => handleDelete(e.id)}>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pickerAjoutOpen && (
        <SupplierPicker
          onSelect={(f) => {
            ajouterFournisseur(f.nom, f.id)
            setPickerAjoutOpen(false)
          }}
          onClose={() => setPickerAjoutOpen(false)}
        />
      )}

      {pickerOpen && (
        <SupplierPicker
          onSelect={(f) => {
            set('fournisseurId', f.id)
            set('fournisseurNom', f.nom)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

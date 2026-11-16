"""Port Python de computeBucketStats / computeTranches (src/data/depenses.ts) — même formule que le
pipeline qui a produit depensesGlobal.json / depensesFournisseurs.json."""
from datetime import date


def r2(x):
    return round(x * 100) / 100


def annee_comptable(d):
    if d.get("dateCofi"):
        return d["dateCofi"][:4]
    if d.get("anneeAttribution"):
        return d["anneeAttribution"]
    return (d.get("dateDoc") or "")[:4] or None


def bucket(docs, abs_factures=False, today=None):
    today = today or date.today().isoformat()
    m = lambda d: d.get("montant") or 0
    total = r2(sum(m(d) for d in docs))
    fact = [d for d in docs if d["genre"] == "Facture" or d.get("correctionDeFacture")]
    fact_connues = [d for d in fact if d.get("montant") is not None]
    montant_factures = r2(sum(abs(d["montant"]) if abs_factures else d["montant"] for d in fact_connues))
    nc = [d for d in docs if d["genre"] != "Facture" and not d.get("correctionDeFacture")]
    payees = [d for d in docs if d.get("datePaiement") is not None]
    attente = [d for d in docs if d.get("datePaiement") is None]
    avec_ech = [d for d in docs if d.get("dateEcheance") is not None]
    a_temps = [d for d in avec_ech if d.get("enRetard") is False and d.get("datePaiement") is not None]
    en_retard = [d for d in avec_ech if d.get("enRetard") is True]
    retards = []
    for d in en_retard:
        eff = d.get("datePaiement") or today
        retards.append((date.fromisoformat(eff[:10]) - date.fromisoformat(d["dateEcheance"][:10])).days)
    return {
        "montantTotal": total,
        "nbDocuments": len(docs),
        "nbFactures": len(fact),
        "montantFactures": montant_factures,
        "nbNotesCredit": len(nc),
        "montantNotesCredit": r2(sum(m(d) for d in nc)),
        "nbPayees": len(payees),
        "montantPayees": r2(sum(m(d) for d in payees)),
        "nbEnAttente": len(attente),
        "montantEnAttente": r2(sum(m(d) for d in attente)),
        "nbATemps": len(a_temps),
        "montantATemps": r2(sum(m(d) for d in a_temps)),
        "nbEnRetard": len(en_retard),
        "montantEnRetard": r2(sum(m(d) for d in en_retard)),
        "retardMoyenJours": round(sum(retards) / len(retards) * 10) / 10 if retards else None,
    }

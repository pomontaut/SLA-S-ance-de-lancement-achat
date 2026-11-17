#!/usr/bin/env python3
"""Ajoute aux JSON de dépense les documents des journaux bruts ABSENTS des données (ex. factures en EUR :
l'extraction d'origine ne contenait que du CHF — PREFA DU LEMAN 2023…), SANS retoucher les documents déjà présents.

  python3 script/importer_manquants_depense.py [--a-blanc] --aff INDUNI brut_induni.xlsx --aff CONSORTIUM brut_consortium.xlsx

Mêmes règles que appliquer_plan_comptable_depense.py (charges classes 3/4 hors 400, immobilisations 15x = DEPOT,
exclusions et alias fournisseurs, montants HT = montant + ligne d'impôt préalable). Les journaux bruts ne donnent PAS
de contre-valeur CHF pour les documents en EUR : conversion au cours EUR/CHF hebdomadaire de script/eurchf_rates.json
(cours indicatif ; à remplacer par le cours ABACUS dès qu'un export avec le montant en CHF est disponible).
Le montant d'origine reste dans `montantDevise` / `devise` / `tauxChf` du document."""
import json, os, sys
from datetime import date, timedelta
HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
import appliquer_plan_comptable_depense as AP
import depense_agregats as A
import depense_import as I
from parse_brut import parse as parse_brut

RATES = json.load(open(os.path.join(HERE, "eurchf_rates.json")))


def taux_eur_chf(iso_date):
    """Cours de la semaine contenant la date (points hebdomadaires datés du lundi) ; sinon le plus proche."""
    d = date.fromisoformat(iso_date)
    best, gap = None, None
    for ds, v in zip(RATES["dates"], RATES["values"]):
        delta = (d - date.fromisoformat(ds)).days
        if 0 <= delta <= 6:
            return v
        g = abs(delta)
        if gap is None or g < gap:
            best, gap = v, g
    return best


def main(argv):
    a_blanc = "--a-blanc" in argv
    argv = [a for a in argv if a != "--a-blanc"]
    docs, aff, k = [], None, 0
    while k < len(argv):
        if argv[k] == "--aff":
            aff = AP.AFF[argv[k + 1]]; k += 2; continue
        d, _ = parse_brut(argv[k], aff); docs += d; k += 1
    F = json.load(open(AP.FOURN))
    G = json.load(open(os.path.join(AP.ROOT, "depensesGlobal.json")))
    deja = {(d["aff"], d["docno"]) for f in F for d in f["documents"]}
    faux = set(json.load(open(os.path.join(HERE, "consortium_divisions_exclues.json")))["divisions"])  # faux consortiums
    avant = {a: v["montantTotal"] for a, v in G["parAnnee"].items()}
    nouveaux, classes = [], {}
    for d in docs:
        if (d["aff"], d["docno"]) in deja:
            continue
        if d["aff"] == "CONSORTIUM" and str(d.get("gb")) in faux:
            continue
        cl = AP.classer([p["debit"] for p in d["pos"]])
        if not cl:
            continue
        d["tva"] = round(d["tva"], 2)
        if d["devise"] == "EUR":
            ref = d["dateDoc"] or d["cofi"]
            t = taux_eur_chf(ref)
            d["_eur"] = (d["montantDoc"], d["tva"], t)
            d["montantDoc"] = round(d["montantDoc"] * t, 2)
            d["tva"] = round(d["tva"] * t, 2)
        elif d["devise"] != "CHF":
            sys.exit(f"devise inconnue {d['devise']} (doc {d['docno']})")
        classes[(d["aff"], d["docno"])] = (cl, d)
        nouveaux.append(d)
    print(len(nouveaux), "documents absents à ajouter ;", sum(1 for d in nouveaux if d["devise"] == "EUR"), "en EUR")
    AP.importer(F, G, nouveaux)
    ajoutes = 0
    for f in F:
        for doc in f["documents"]:
            c = classes.get((doc["aff"], doc["docno"]))
            if not c or (doc["aff"], doc["docno"]) in deja:
                continue
            cl, d = c
            ajoutes += 1
            if doc.get("montant") is not None:  # HT = montant + ligne d'impôt préalable (négative sur une facture)
                doc["montant"] = round(doc["montant"] + d["tva"], 2)
                if abs(d["tva"]) >= 0.005:
                    doc["tva"] = round(-d["tva"], 2)
            if cl == "depot":
                doc["entite"] = "DEPOT"
            if d.get("dispo"):
                doc["dateDispo"] = d["dispo"]
            if "_eur" in d:
                m, _, t = d["_eur"]
                doc.update({"devise": "EUR", "montantDevise": m, "tauxChf": t, "tauxSource": "EUR/CHF hebdomadaire (indicatif)"})
    print(ajoutes, "documents ajoutés aux fiches")
    if a_blanc:
        return
    for f in F:
        if f.get("conditions") is None:
            f["conditions"] = []
        A.recalcule_fournisseur(f)
    F = [f for f in F if f["documents"]]
    A.recalcule_global(F, G)
    json.dump(F, open(AP.FOURN, "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(G, open(os.path.join(AP.ROOT, "depensesGlobal.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    for a in sorted(set(avant) | set(G["parAnnee"])):
        print(f"  {a}: {avant.get(a, 0)/1e6:8.2f} M → {G['parAnnee'].get(a, {}).get('montantTotal', 0)/1e6:8.2f} M")


if __name__ == "__main__":
    main(sys.argv[1:])

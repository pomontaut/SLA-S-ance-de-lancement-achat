#!/usr/bin/env python3
"""Applique le plan comptable à l'analyse de dépense : ne garde que les CHARGES d'achat.

Règle (plan comptable Induni) — compte débit du document (journal COFI) :
  * classes 3 (matériel d'exploitation) et 4 (charges d'exploitation) : GARDÉES ;
  * 400xxx (salaires) et 52xxx (prestations internes) : retirées ;
  * classes 1 (actifs), 2 (passifs : créanciers, impôt à la source, prévoyance, AVS…), 5, 6, 7, 9 : retirées.
Les documents sans compte retrouvé (journal manquant) sont CONSERVÉS et comptés dans le rapport.

Usage :
  python3 script/appliquer_plan_comptable_depense.py JOURNAL.xlsx [JOURNAL.xlsx ...]   # applique
  ... --a-blanc    # n'écrit rien, affiche le rapport seulement
Les journaux sont reconnus automatiquement : « Journal COFI Compilé » (1 ligne = 1 document) ou
export brut ABACUS « kred_16 » (Induni ou consortium : colonne « Aff. » absente → fournir
--aff INDUNI|CONSORTIUM avant chaque fichier brut : `--aff INDUNI brut.xlsx --aff CONSORTIUM brut2.xlsx`).
Idempotent : relancer avec davantage de journaux (ex. 2023) complète sans rien casser.
"""
import collections, json, os, sys
import openpyxl
sys.path.insert(0, os.path.dirname(__file__))
import depense_agregats as A

ROOT = os.path.join(os.path.dirname(__file__), "..", "src", "data")
AFF = {"INDUNI": "CHANTIER INDUNI", "CHANTIER INDUNI": "CHANTIER INDUNI", "CONSORTIUM": "CONSORTIUM"}


def est_charge(cpt):
    c = str(cpt)
    if c[:3] == "400" or c[:2] == "52":
        return False
    return c[:1] in ("3", "4")


def lire_compile(path, comptes):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    it = ws.iter_rows(values_only=True)
    h = next(it)
    i = {n: k for k, n in enumerate(h)}
    for r in it:
        if r[i["N° doc"]] is None:
            continue
        comptes[(AFF[r[i["Aff."]]], int(r[i["N° doc"]]))] = [str(r[i["Cpt Débit"]])]


def lire_brut(path, aff, comptes):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    cur = None
    for n, r in enumerate(ws.iter_rows(values_only=True)):
        if n < 5:
            continue
        r = list(r) + [None] * (15 - len(r))
        g = str(r[12] or "")
        if r[0] is None and isinstance(r[1], int) and g.startswith(("Facture", "Note de cr")):
            cur = (AFF[aff], r[1])
            comptes[cur] = []
        elif r[0] == "P" and cur is not None:
            comptes[cur].append(str(r[2]))


def main(argv):
    a_blanc = "--a-blanc" in argv
    argv = [a for a in argv if a != "--a-blanc"]
    comptes, aff, k = {}, None, 0
    while k < len(argv):
        if argv[k] == "--aff":
            aff = argv[k + 1]; k += 2; continue
        p = argv[k]; k += 1
        ws = openpyxl.load_workbook(p, read_only=True, data_only=True).worksheets[0]
        entete = next(ws.iter_rows(values_only=True, max_row=1))
        print("lecture", os.path.basename(p), "...", flush=True)
        if entete and entete[0] == "Fournisseur":
            lire_compile(p, comptes)
        else:
            if not aff:
                sys.exit("export brut : précisez --aff INDUNI ou --aff CONSORTIUM avant le fichier")
            lire_brut(p, aff, comptes)
    print(len(comptes), "documents avec compte")

    F = json.load(open(os.path.join(ROOT, "depensesFournisseurs.json")))
    G = json.load(open(os.path.join(ROOT, "depensesGlobal.json")))
    plan = json.load(open(os.path.join(os.path.dirname(__file__), "plan_comptable.json")))

    rapport = collections.defaultdict(lambda: [0, 0.0])
    retires = collections.defaultdict(lambda: [0, 0.0, set()])
    inconnus = collections.defaultdict(lambda: [0, 0.0])
    for f in F:
        garde = []
        for d in f["documents"]:
            cs = comptes.get((d["aff"], d["docno"]))
            an = A.annee_comptable(d) or "?"
            if not cs:
                inconnus[an][0] += 1; inconnus[an][1] += d.get("montant") or 0
                garde.append(d); continue
            # plusieurs positions : le document est retiré seulement si AUCUNE n'est une charge
            if any(est_charge(c) for c in cs):
                garde.append(d); continue
            cle = (an, cs[0][:3])
            retires[cle][0] += 1; retires[cle][1] += d.get("montant") or 0; retires[cle][2].add(f["nom"])
        f["_retires"] = len(f["documents"]) - len(garde)
        f["documents"] = garde

    print("\n=== Retiré (non-charges), par année et compte (3 chiffres) ===")
    par_an = collections.defaultdict(lambda: [0, 0.0])
    for (an, c), (n, m, _) in sorted(retires.items(), key=lambda x: (x[0][0], -abs(x[1][1]))):
        par_an[an][0] += n; par_an[an][1] += m
        if abs(m) > 50000:
            print(f"{an}  {c}  {plan.get(c + '000', plan.get(c, '?')):45s} {n:6d} doc  {m/1e6:8.2f} M")
    for an, (n, m) in sorted(par_an.items()):
        print(f"TOTAL retiré {an}: {n} documents, {m/1e6:.2f} M CHF")
    print("\n=== Conservés SANS compte connu (journal manquant) ===")
    for an, (n, m) in sorted(inconnus.items()):
        print(f"{an}: {n} documents, {m/1e6:.2f} M CHF")
    if a_blanc:
        return

    avant = {a: G["parAnnee"][a]["montantTotal"] for a in G["parAnnee"]}
    exclusions_compte = {"nbLignes": sum(v[0] for v in par_an.values()),
                         "montantTotal": round(sum(v[1] for v in par_an.values()), 2),
                         "parAnnee": {a: {"nbLignes": v[0], "montantTotal": round(v[1], 2)} for a, v in sorted(par_an.items())},
                         "details": [{"compte": c, "libelle": plan.get(c + "000", plan.get(c, "")), "annee": an,
                                      "nbLignes": n, "montant": round(m, 2)}
                                     for (an, c), (n, m, _) in sorted(retires.items(), key=lambda x: -abs(x[1][1])) if abs(m) > 0][:40],
                         "regle": "Seuls les comptes de charges d'achat (classes 3 et 4 du plan comptable, hors 400 salaires et 52 prestations internes) comptent comme dépense."}
    for f in F:
        f.pop("_retires", None)
        if f["documents"]:
            A.recalcule_fournisseur(f)
    F = [f for f in F if f["documents"]]
    A.recalcule_global(F, G)
    G["exclusionsCompte"] = exclusions_compte
    json.dump(F, open(os.path.join(ROOT, "depensesFournisseurs.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(G, open(os.path.join(ROOT, "depensesGlobal.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print("\nAvant → après (dépense par année) :")
    for a in sorted(avant):
        print(f"  {a}: {avant[a]/1e6:8.2f} M → {G['parAnnee'].get(a, {}).get('montantTotal', 0)/1e6:8.2f} M")


if __name__ == "__main__":
    main(sys.argv[1:])

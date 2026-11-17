#!/usr/bin/env python3
"""Retire de la dépense les documents CONSORTIUM sans chantier dont la division (GB) est un « faux consortium »
(consortium_divisions_exclues.json) et les reporte dans depensesGlobal.exclusions.
  python3 script/exclure_divisions_consortium.py [--a-blanc] journal_consortium_2023.xlsx journal_consortium_2024.xlsx ..."""
import json, os, sys, collections
HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
import appliquer_plan_comptable_depense as AP
import depense_agregats as A
from parse_brut import parse as parse_brut

CFG = json.load(open(os.path.join(HERE, "consortium_divisions_exclues.json")))
DIV = set(CFG["divisions"])


def main(argv):
    a_blanc = "--a-blanc" in argv
    gb = {}
    for p in [a for a in argv if a != "--a-blanc"]:
        for d in parse_brut(p, "CONSORTIUM")[0]:
            gb[d["docno"]] = str(d["gb"])
    F = json.load(open(AP.FOURN))
    G = json.load(open(os.path.join(AP.ROOT, "depensesGlobal.json")))
    par = collections.defaultdict(lambda: [0, 0.0])
    for f in F:
        garde = []
        for d in f["documents"]:
            if d["aff"] == "CONSORTIUM" and not d.get("chantier") and gb.get(d["docno"]) in DIV:
                k = (gb[d["docno"]], A.annee_comptable(d)); par[k][0] += 1; par[k][1] += d.get("montant") or 0
            else:
                garde.append(d)
        f["documents"] = garde
    for (div, an), (n, m) in sorted(par.items()):
        print(f"division {div} {an} : {n} documents, {m:,.2f} CHF HT retirés")
    if a_blanc:
        return
    ex = G.setdefault("exclusions", {"nbLignes": 0, "montantTotal": 0.0, "details": []})
    ex["details"] = [e for e in ex["details"] if not str(e.get("nom", "")).startswith("Faux consortium")]
    for div in sorted(DIV):
        n = sum(v[0] for (d, _), v in par.items() if d == div); m = sum(v[1] for (d, _), v in par.items() if d == div)
        if n:
            ex["details"].append({"nfr": 0, "nom": f"Faux consortium — division {div}", "montant": round(m, 2), "motif": CFG["motif"]})
    for f in F:
        if f["documents"]:
            A.recalcule_fournisseur(f)
    F = [f for f in F if f["documents"]]
    A.recalcule_global(F, G)
    json.dump(F, open(AP.FOURN, "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(G, open(os.path.join(AP.ROOT, "depensesGlobal.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    for a in sorted(G["parAnnee"]):
        print(f"  {a}: {G['parAnnee'][a]['montantTotal']/1e6:8.2f} M")


if __name__ == "__main__":
    main(sys.argv[1:])

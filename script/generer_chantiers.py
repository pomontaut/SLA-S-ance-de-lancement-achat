#!/usr/bin/env python3
"""Génère src/data/chantiers.json (liste des chantiers du formulaire d'évaluation) :
référentiel officiel (script/chantiers_references.json) + chantiers nommés vus dans la dépense."""
import collections, json, os
HERE = os.path.dirname(__file__)
ref = json.load(open(os.path.join(HERE, "chantiers_references.json")))["entites"]
out = {c: {"numero": c, "nom": n, "entite": e} for e, ch in ref.items() for c, n in ch.items()}
F = json.load(open(os.path.join(HERE, "..", "public", "data", "depensesFournisseurs.json")))
nom, ent = {}, collections.defaultdict(collections.Counter)
for f in F:
    for d in f["documents"]:
        c = d.get("chantier")
        if c and d.get("chantierNom"):
            nom[c] = d["chantierNom"]
            if d.get("entite"):
                ent[c][d["entite"]] += 1
for c, n in nom.items():
    if c not in out:
        e = ent[c].most_common(1)[0][0] if ent[c] else ""
        out[c] = {"numero": c, "nom": n.strip(), "entite": e}
rows = sorted(out.values(), key=lambda r: r["numero"])
json.dump(rows, open(os.path.join(HERE, "..", "src", "data", "chantiers.json"), "w"), ensure_ascii=False, indent=0)
print(len(rows), "chantiers", collections.Counter(r["entite"] for r in rows))

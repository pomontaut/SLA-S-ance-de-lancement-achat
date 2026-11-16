"""Construit des DepenseDocument (src/data/depenses.ts) à partir d'un export brut kred_16.

Règles reconstituées et validées sur les 26 800 documents 2024 déjà en place :
montant = « Montant doc. » (toujours égal à la somme des positions de charge) ; chantier = SECT de la
1re position hors 200000 ; échéance = date doc + jours de la condition ; enRetard = paiement (ou date
de référence si impayé) > échéance ; entité = entité majoritaire du chantier dans les documents déjà
en place, sinon division « GB » (100 DG, 110 BAT GE, 120 DEPOT, 130 GC, 140 EG VD, 150 EG GE,
160 BAT VD, 170 EG VS)."""
import collections, json, os, re
from datetime import date, timedelta
import depense_agregats as A

CONSORTIUM = json.load(open(os.path.join(os.path.dirname(__file__), "chantiers_consortium.json")))
_REF = json.load(open(os.path.join(os.path.dirname(__file__), "chantiers_references.json")))["entites"]
NOMS_GC = {c: n for ch in _REF.values() for c, n in ch.items()}  # code chantier -> nom officiel (toutes entités)
ENTITE_REF = {c: e for e, ch in _REF.items() for c in ch}        # code chantier -> entité
GB_ENTITE = {100: "DG", 110: "BAT GE", 120: "DEPOT", 130: "GC", 140: "EG VD", 150: "EG GE", 160: "BAT VD", 170: "EG VS"}


def contexte(F):
    ent, nom, cons = collections.defaultdict(collections.Counter), {}, {}
    for f in F:
        for d in f["documents"]:
            c = d.get("chantier")
            if c is None:
                continue
            if d.get("entite"):
                ent[c][d["entite"]] += 1
            if d.get("chantierNom"):
                nom[c] = d["chantierNom"]
            if d.get("chantierConsortium") is not None:
                cons[c] = d["chantierConsortium"]
    return {"entite": {k: v.most_common(1)[0][0] for k, v in ent.items()}, "nom": nom, "consortium": cons}


def consortium_par_division(div):
    """(chantier, entité, nom) d'un document consortium d'après sa division ; inconnue = (None, "AUTRES", None)."""
    d = CONSORTIUM["divisions"].get(str(div))
    if not d:
        return None, "AUTRES", None
    ch = d["chantier"]
    return ch, d["entite"] or "AUTRES", (NOMS_GC.get(ch) or (CONSORTIUM["chantiers"].get(ch) or {}).get("nom")) if ch else None


def _condition(details):
    seg = (details or "").split("|")[-1]
    return seg.split(" ", 1)[1].strip() if "|" in (details or "") and " " in seg else None


def _echeance(date_doc, cond):
    m = re.search(r"(\d+)\s*JOURS", cond or "")
    if not (m and date_doc):
        return None
    return (date.fromisoformat(date_doc) + timedelta(days=int(m.group(1)))).isoformat()


def construire(d, ctx):
    pos = [p for p in d["pos"] if p["debit"] != "200000"]
    sect = str(pos[0]["sect"]) if pos and pos[0]["sect"] is not None else None
    pay = d.get("pay")
    if not pay:
        o = d.get("payo") or {}
        pay = next((o[t] for t in ("G", "g", "z", "X", "S") if o.get(t)), None)
    cond = _condition(d.get("details"))
    ech = _echeance(d["dateDoc"], cond)
    if ech is None:
        en_retard = False
    else:
        en_retard = (pay > ech) if pay else (A.TODAY_REF > ech)
    nom_ch = ctx["nom"].get(sect)
    if d["aff"] == "CONSORTIUM" and sect is None:
        sect, entite, nom_ch = consortium_par_division(d.get("gb"))
    else:
        entite = ctx["entite"].get(sect) or GB_ENTITE.get(d.get("gb"))
    return {
        "docno": d["docno"], "dateDoc": d["dateDoc"], "datePaiement": pay, "dateEcheance": ech,
        "genre": "Facture" if d["genre"] == "Facture" else d["genre"],
        "condition": cond, "entite": entite, "chantier": sect,
        "chantierNom": NOMS_GC.get(sect) or nom_ch or ctx["nom"].get(sect), "chantierConsortium": ctx["consortium"].get(sect, True if d["aff"] == "CONSORTIUM" and sect else None),
        "aff": d["aff"], "montant": d.get("montantDoc"),
        "ref": (d.get("details") or "").split("|")[0] or None,
        "enRetard": en_retard, **({"dateCofi": d["cofi"]} if d.get("cofi") else {}),
    }

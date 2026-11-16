#!/usr/bin/env python3
"""Analyse de dépense : plan comptable + import de nouveaux journaux.

Règle (plan comptable Induni) — compte débit des positions du document (journal COFI) :
  * classes 3 (matériel d'exploitation) et 4 (charges d'exploitation) : GARDÉES ;
  * 15x (immobilisations du dépôt : machines, agencement, bâtiment) : GARDÉES, rattachées à l'entité DEPOT
    (ce sont des actifs mais de vraies dépenses d'achat) ;
  * 400xxx (salaires) et 52xxx (prestations internes) : retirées ;
  * autres classes 1 (transitoires…), 2 (créanciers, impôt à la source, prévoyance, AVS…), 5, 6, 7, 9 : retirées.
Les documents sans compte retrouvé (journal manquant) sont CONSERVÉS et comptés dans le rapport.

Usage (repartir des JSON d'origine pour un résultat reproductible, voir README) :
  python3 script/appliquer_plan_comptable_depense.py  JOURNAL_COMPILE.xlsx \\
      --aff INDUNI brut_induni.xlsx --aff CONSORTIUM brut_consortium.xlsx \\
      --nouveaux --aff INDUNI brut2026_induni.xlsx --aff CONSORTIUM brut2026_consortium.xlsx
  --a-blanc   n'écrit rien, affiche le rapport seulement
  --nouveaux  les fichiers bruts qui SUIVENT sont aussi importés comme nouveaux documents (déjà présents = ignorés).
"""
import collections, json, os, sys
import openpyxl
sys.path.insert(0, os.path.dirname(__file__))
import depense_agregats as A
import depense_import as I
from parse_brut import parse as parse_brut

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, "..", "src", "data")
FOURN = os.path.join(HERE, "..", "public", "data", "depensesFournisseurs.json")  # gros fichier : servi par fetch, jamais compilé
AFF = {"INDUNI": "CHANTIER INDUNI", "CHANTIER INDUNI": "CHANTIER INDUNI", "CONSORTIUM": "CONSORTIUM"}


def classer(cpts):
    """'charge' | 'depot' (immobilisation 15x, gardée) | None (retirée)."""
    if any(c[:1] in ("3", "4") and c[:3] != "400" for c in cpts):
        return "charge"
    if any(c[:2] == "15" for c in cpts):
        return "depot"
    if any(c[:1] in ("3", "4") for c in cpts):  # seulement des salaires (400)
        return None
    return None


def lire_compile(path, comptes, taux):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    it = ws.iter_rows(values_only=True)
    i = {n: k for k, n in enumerate(next(it))}
    for r in it:
        if r[i["N° doc"]] is not None:
            cle = (AFF[r[i["Aff."]]], int(r[i["N° doc"]]))
            comptes[cle] = [str(r[i["Cpt Débit"]])]
            try:
                taux[cle] = float(r[i["%TVA"]] or 0)
            except (TypeError, ValueError):
                taux[cle] = 0.0


def fusionner_alias(F):
    """Regroupe sous le fournisseur canonique les fiches existantes portant un numéro « alias »
    (fournisseurAliasesDepense.json, groupes marqués "fusionner": true) — ex. HGC HANDEL AG → HG COMMERCIALE."""
    par_nfr = {f["nfr"]: f for f in F}
    n = 0
    for g in json.load(open(os.path.join(ROOT, "fournisseurAliasesDepense.json"))):
        if not g.get("fusionner"):  # seuls les groupes marqués "fusionner": true (validés par le propriétaire)
            continue
        canon = par_nfr.get(g["canonicalNfr"])
        for a in g["aliasNfrs"]:
            src = par_nfr.get(a)
            if src is None or src is canon:
                continue
            if canon is None:
                src["nfr"], src["nom"] = g["canonicalNfr"], g["canonicalNom"]
                par_nfr[g["canonicalNfr"]] = canon = src
            else:
                canon["documents"] += src["documents"]
                canon["conditions"] = list(dict.fromkeys((canon.get("conditions") or []) + (src.get("conditions") or [])))
                F.remove(src)
            canon["nfrAlias"] = sorted(set(canon.get("nfrAlias", [])) | {a})
            par_nfr.pop(a, None)
            n += 1
    print(f"{n} fiche(s) fournisseur fusionnée(s) par alias")


def convertir_ht(F, tva_docs, taux):
    """Passe tous les montants de TTC en HT (hors TVA). TVA réelle du document quand l'export brut est
    disponible (HT = montant + ligne d'impôt préalable), sinon taux du journal compilé
    (HT = TTC / (1 + taux)). Le montant de TVA est gardé dans `tva` (positif sur une facture)."""
    n = collections.Counter()
    tot_ttc = tot_ht = 0.0
    introuvables = [0, 0.0]
    for f in F:
        for d in f["documents"]:
            m = d.get("montant")
            if m is None:
                continue
            k = (d["aff"], d["docno"])
            if k in tva_docs:
                delta, src = tva_docs[k], "journal brut"
            elif k in taux:
                if not taux[k]:
                    n["TVA nulle (0 %)"] += 1
                    continue
                delta, src = -round(m * taux[k] / (100 + taux[k]), 2), "taux du journal compilé"
            else:
                n["INTROUVABLE dans les journaux (gardé tel quel)"] += 1
                introuvables[0] += 1; introuvables[1] += m
                continue
            d["montant"] = round(m + delta, 2)
            if abs(delta) >= 0.005:
                d["tva"] = round(-delta, 2)
            n[src] += 1
            tot_ttc += m; tot_ht += d["montant"]
    print(f"Documents introuvables dans les journaux (montant laissé tel quel) : {introuvables[0]}, {introuvables[1]/1e6:.2f} M CHF")
    print(f"\n=== Passage en HT : {dict(n)} ; TTC {tot_ttc/1e6:.1f} M → HT {tot_ht/1e6:.1f} M (TVA {(tot_ttc-tot_ht)/1e6:.1f} M, {100*(tot_ttc-tot_ht)/tot_ttc:.1f} %)")


def appliquer_exclusions(F, G):
    """Retire des données existantes les fournisseurs de fournisseurExclusionsDepense.json (organismes à ne pas
    compter comme fournisseurs) et le reporte dans G["exclusions"]."""
    excl = {e["nfr"]: e for e in json.load(open(os.path.join(ROOT, "fournisseurExclusionsDepense.json")))}
    ex = G.setdefault("exclusions", {"nbLignes": 0, "montantTotal": 0.0, "details": []})
    n = 0
    for f in list(F):
        if f["nfr"] not in excl:
            continue
        m = sum(d.get("montant") or 0 for d in f["documents"])
        ex["nbLignes"] += len(f["documents"]); ex["montantTotal"] = round(ex["montantTotal"] + m, 2)
        det = next((e for e in ex["details"] if e["nfr"] == f["nfr"]), None)
        if det:
            det["montant"] = round(det["montant"] + m, 2)
        else:
            ex["details"].append({"nfr": f["nfr"], "nom": f["nom"], "montant": round(m, 2), "motif": excl[f["nfr"]]["motif"]})
        F.remove(f); n += 1
    print(f"{n} fiche(s) exclue(s) retirée(s) des données existantes")


def importer(F, G, docs_bruts):
    ctx = I.contexte(F)
    excl = {e["nfr"]: e for e in json.load(open(os.path.join(ROOT, "fournisseurExclusionsDepense.json")))}
    alias = {}
    for g in json.load(open(os.path.join(ROOT, "fournisseurAliasesDepense.json"))):
        for n in g["aliasNfrs"]:
            alias[n] = (g["canonicalNfr"], g["canonicalNom"])
    par_nfr = {f["nfr"]: f for f in F}
    deja = {(d["aff"], d["docno"]) for f in F for d in f["documents"]}
    ajoutes = collections.Counter(); exclus = collections.defaultdict(float); nouveaux_f = set(); sans_chantier = set()
    for d in docs_bruts:
        if (d["aff"], d["docno"]) in deja:
            continue
        nfr, nom = alias.get(d["nfr"], (d["nfr"], d["nom"]))
        if nfr in excl or d["nfr"] in excl:
            exclus[nfr] += (d.get("montantDoc") or 0) + (d.get("tva") or 0); ajoutes["exclus"] += 1; continue
        doc = I.construire(d, ctx)
        if doc["chantier"] and doc["chantier"] not in ctx["entite"]:
            sans_chantier.add(doc["chantier"])
        f = par_nfr.get(nfr)
        if f is None:
            f = {"nfr": nfr, "nom": nom, "conditions": [], "documents": [], "familleAchat": None}
            F.append(f); par_nfr[nfr] = f; nouveaux_f.add(nfr)
        f["documents"].append(doc)
        if d["nfr"] != nfr:  # numéro alias : on le garde en mémoire sur la fiche canonique
            f["nfrAlias"] = sorted(set(f.get("nfrAlias", [])) | {d["nfr"]})
        if doc["condition"] and doc["condition"] not in f["conditions"]:
            f["conditions"].append(doc["condition"])
        ajoutes[A.annee_comptable(doc) or "?"] += 1
    ex = G.get("exclusions")
    if ex and exclus:
        for nfr, m in exclus.items():
            for e in ex["details"]:
                if e["nfr"] == nfr:
                    e["montant"] = round(e["montant"] + m, 2)
        ex["nbLignes"] += ajoutes["exclus"]; ex["montantTotal"] = round(ex["montantTotal"] + sum(exclus.values()), 2)
    print(f"\n=== Import : documents ajoutés par année : {dict(ajoutes)} ; nouveaux fournisseurs : {len(nouveaux_f)} ; "
          f"chantiers inconnus (entité par division) : {len(sans_chantier)}")


def main(argv):
    a_blanc = "--a-blanc" in argv
    argv = [a for a in argv if a != "--a-blanc"]
    comptes, docs_bruts, aff, nouveaux, k = {}, [], None, False, 0
    taux, tva_docs = {}, {}  # TVA : taux par document (journal compilé) ou montant réel (exports bruts)
    divisions = {}
    while k < len(argv):
        t = argv[k]
        if t == "--aff":
            aff = argv[k + 1]; k += 2; continue
        if t == "--nouveaux":
            nouveaux = True; k += 1; continue
        k += 1
        ws = openpyxl.load_workbook(t, read_only=True, data_only=True).worksheets[0]
        entete = next(ws.iter_rows(values_only=True, max_row=1))
        print("lecture", os.path.basename(t), "...", flush=True)
        if entete and entete[0] == "Fournisseur":
            lire_compile(t, comptes, taux)
        else:
            if not aff:
                sys.exit("export brut : précisez --aff INDUNI ou --aff CONSORTIUM avant le fichier")
            docs, _ = parse_brut(t, AFF[aff])
            for d in docs:
                comptes[(d["aff"], d["docno"])] = [p["debit"] for p in d["pos"]]
                tva_docs[(d["aff"], d["docno"])] = round(d["tva"], 2)
                if d["aff"] == "CONSORTIUM":
                    divisions[(d["aff"], d["docno"])] = d.get("gb")
            if nouveaux:
                docs_bruts += docs
    print(len(comptes), "documents avec compte")

    F = json.load(open(FOURN))
    G = json.load(open(os.path.join(ROOT, "depensesGlobal.json")))
    plan = json.load(open(os.path.join(HERE, "plan_comptable.json")))
    avant = {a: v["montantTotal"] for a, v in G["parAnnee"].items()}
    fusionner_alias(F)
    appliquer_exclusions(F, G)
    if docs_bruts:
        importer(F, G, docs_bruts)

    # Documents consortium anciens sans chantier ni entité : rattachés par leur division (fichier consortium).
    rattaches = 0
    for f in F:
        for d in f["documents"]:
            if d["aff"] == "CONSORTIUM" and d.get("chantier") is None and d.get("entite") is None \
                    and (d["aff"], d["docno"]) in divisions:
                ch, ent, nom = I.consortium_par_division(divisions[(d["aff"], d["docno"])])
                d["chantier"], d["entite"], d["chantierNom"] = ch, ent, nom
                d["chantierConsortium"] = True if ch else None
                rattaches += 1
    print(f"\n{rattaches} documents consortium rattachés à un chantier/une entité par leur division")

    # Référentiel des chantiers (dossiers virtuels GC / BAT GE / BAT VD) : nom officiel + entité.
    gc_noms, gc_ent = I.NOMS_GC, I.ENTITE_REF
    gc_maj = collections.Counter()
    for f in F:
        for d in f["documents"]:
            c = d.get("chantier")
            if c in gc_noms:
                e = gc_ent[c]
                if d.get("chantierNom") != gc_noms[c]:
                    gc_maj[(e, "noms")] += 1
                if d.get("entite") != e:
                    gc_maj[(e, "entite")] += 1
                d["chantierNom"], d["entite"] = gc_noms[c], e
    for e in sorted({k[0] for k in gc_maj}):
        print(f"Chantiers {e} : {gc_maj[(e, 'noms')]} documents renommés, {gc_maj[(e, 'entite')]} rattachés à l'entité {e}")

    convertir_ht(F, tva_docs, taux)

    retires = collections.defaultdict(lambda: [0, 0.0])
    depot = collections.defaultdict(lambda: [0, 0.0])
    inconnus = collections.defaultdict(lambda: [0, 0.0])
    for f in F:
        garde = []
        for d in f["documents"]:
            cs = comptes.get((d["aff"], d["docno"]))
            an = A.annee_comptable(d) or "?"
            if not cs:
                inconnus[an][0] += 1; inconnus[an][1] += d.get("montant") or 0
                garde.append(d); continue
            cl = classer(cs)
            if cl == "charge":
                garde.append(d)
            elif cl == "depot":
                d["entite"] = "DEPOT"
                depot[an][0] += 1; depot[an][1] += d.get("montant") or 0
                garde.append(d)
            else:
                retires[(an, cs[0][:3])][0] += 1; retires[(an, cs[0][:3])][1] += d.get("montant") or 0
        f["documents"] = garde

    print("\n=== Retiré (non-charges), par année et compte (3 chiffres) ===")
    par_an = collections.defaultdict(lambda: [0, 0.0])
    for (an, c), (n, m) in sorted(retires.items(), key=lambda x: (x[0][0], -abs(x[1][1]))):
        par_an[an][0] += n; par_an[an][1] += m
        if abs(m) > 50000:
            print(f"{an}  {c}  {plan.get(c + '000', plan.get(c, '?')):45s} {n:6d} doc  {m/1e6:8.2f} M")
    for an, (n, m) in sorted(par_an.items()):
        print(f"TOTAL retiré {an}: {n} documents, {m/1e6:.2f} M CHF")
    print("\n=== Immobilisations du dépôt (15x) gardées, entité DEPOT ===")
    for an, (n, m) in sorted(depot.items()):
        print(f"{an}: {n} documents, {m/1e6:.2f} M CHF")
    print("\n=== Conservés SANS compte connu (journal manquant) ===")
    for an, (n, m) in sorted(inconnus.items()):
        print(f"{an}: {n} documents, {m/1e6:.2f} M CHF")
    if a_blanc:
        return

    mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
    cofi_max = {}
    for f in F:
        for d in f["documents"]:
            if d.get("dateCofi"):
                cofi_max[d["dateCofi"][:4]] = max(cofi_max.get(d["dateCofi"][:4], ""), d["dateCofi"])
    G["anneesPartielles"] = {a: f"janv.–{mois[int(m[5:7]) - 1]} {a}" for a, m in cofi_max.items() if m[5:7] != "12"}
    G["exclusionsCompte"] = {
        "nbLignes": sum(v[0] for v in par_an.values()),
        "montantTotal": round(sum(v[1] for v in par_an.values()), 2),
        "parAnnee": {a: {"nbLignes": v[0], "montantTotal": round(v[1], 2)} for a, v in sorted(par_an.items())},
        "details": [{"compte": c, "libelle": plan.get(c + "000", plan.get(c, "")), "annee": an, "nbLignes": n, "montant": round(m, 2)}
                    for (an, c), (n, m) in sorted(retires.items(), key=lambda x: -abs(x[1][1])) if abs(m) > 0][:60],
        "regle": "Seuls les comptes de charges d'achat (classes 3 et 4 du plan comptable, hors 400 salaires et 52 prestations "
                 "internes) comptent comme dépense ; les immobilisations du dépôt (15x) sont gardées sous l'entité DEPOT.",
    }
    for f in F:
        if f["documents"]:
            if f.get("conditions") is None:
                f["conditions"] = []
            A.recalcule_fournisseur(f)
    F = [f for f in F if f["documents"]]
    A.recalcule_global(F, G)
    json.dump(F, open(FOURN, "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(G, open(os.path.join(ROOT, "depensesGlobal.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print("\nAvant → après (dépense par année) :")
    for a in sorted(set(avant) | set(G["parAnnee"])):
        print(f"  {a}: {avant.get(a, 0)/1e6:8.2f} M → {G['parAnnee'].get(a, {}).get('montantTotal', 0)/1e6:8.2f} M")


if __name__ == "__main__":
    main(sys.argv[1:])

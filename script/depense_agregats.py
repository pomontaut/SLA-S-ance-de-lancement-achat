"""Recalcule les agrégats de depensesGlobal.json / depensesFournisseurs.json à partir des documents
(même formule que le pipeline d'origine, validée par `--valider` de appliquer_plan_comptable_depense.py)."""
import collections
from depense_stats import bucket, annee_comptable, r2

TODAY_REF = "2026-10-12"  # date de génération des JSON d'origine (retards des factures impayées)
TRANCHES = [("< 2'000 CHF", 0, 2000), ("2'001 - 5'000 CHF", 2000, 5000), ("5'001 - 10'000 CHF", 5000, 10000),
            ("10'001 - 50'000 CHF", 10000, 50000), ("> 50'000 CHF", 50000, None)]


def pct(a, b):
    return round(a / b * 1000) / 10 if b else None


def B(docs, absf=False):
    return bucket(docs, absf, TODAY_REF)


def groupby(docs, key):
    g = collections.defaultdict(list)
    for d in docs:
        k = key(d)
        if k is not None:
            g[k].append(d)
    return g


def recalcule_fournisseur(f):
    d = f["documents"]
    f["global"] = {**B(d), "nbFournisseurs": 1}
    f["chantierMontant"] = r2(sum(x.get("montant") or 0 for x in d if x["aff"] == "CHANTIER INDUNI"))
    f["consortiumMontant"] = r2(sum(x.get("montant") or 0 for x in d if x["aff"] == "CONSORTIUM"))
    f["parEntite"] = {k: {**B(v), "nbFournisseurs": 1} for k, v in groupby(d, lambda x: x["entite"]).items()}
    old = f.get("parChantier", {})
    pc = {}
    for k, v in groupby(d, lambda x: x["chantier"]).items():
        o = old.get(k, {})
        pc[k] = {**B(v, True), "nbFournisseurs": 1, "nom": v[0].get("chantierNom"),
                 "consortium": v[0].get("chantierConsortium"), "technicien": o.get("technicien")}
    f["parChantier"] = pc
    f["parAnnee"] = {k: {**B(v), "nbFournisseurs": 1} for k, v in groupby(d, annee_comptable).items()}


def nb_fourn(docs_by_nfr_pairs):
    return len({n for n, _ in docs_by_nfr_pairs})


def recalcule_global(F, G):
    pairs = [(f["nfr"], x, f.get("familleAchat")) for f in F for x in f["documents"]]
    docs = [x for _, x, _ in pairs]
    def bk(sel, absf=False):
        sub = [p for p in pairs if sel(p)]
        return {**B([x for _, x, _ in sub], absf), "nbFournisseurs": len({n for n, _, _ in sub})}
    G["global"] = bk(lambda p: True)
    G["chantier"] = bk(lambda p: p[1]["aff"] == "CHANTIER INDUNI")
    G["consortium"] = bk(lambda p: p[1]["aff"] == "CONSORTIUM")
    G["parEntite"] = {e: bk(lambda p, e=e: p[1]["entite"] == e) for e in {p[1]["entite"] for p in pairs if p[1]["entite"]}}
    G["parAnnee"] = {a: bk(lambda p, a=a: annee_comptable(p[1]) == a) for a in {annee_comptable(x) for x in docs} if a}
    G["parFamilleAchat"] = {fa: bk(lambda p, fa=fa: (p[2] or "Non classé") == fa, True) for fa in {p[2] or "Non classé" for p in pairs}}
    ch = collections.defaultdict(list)
    for p in pairs:
        if p[1]["chantier"] is not None:
            ch[p[1]["chantier"]].append(p)
    G["nbChantiers"] = len(ch)
    G["nbChantiersAvecNom"] = sum(1 for v in ch.values() if v[0][1].get("chantierNom"))
    top = sorted(ch.items(), key=lambda kv: -sum(x.get("montant") or 0 for _, x, _ in kv[1]))[:60]
    old = {c["code"]: c for c in G.get("parChantier", [])}
    G["parChantier"] = [{"code": k, "nom": v[0][1].get("chantierNom"), "consortium": v[0][1].get("chantierConsortium"),
                         "technicien": old.get(k, {}).get("technicien"),
                         **B([x for _, x, _ in v], True), "nbFournisseurs": len({n for n, _, _ in v})} for k, v in top]
    G["top20Fournisseurs"] = [{"nfr": f["nfr"], "nom": f["nom"], "montant": f["global"]["montantTotal"]}
                              for f in sorted(F, key=lambda f: -f["global"]["montantTotal"])[:20]]
    fact = [x for x in docs if x["genre"] == "Facture" and x.get("montant") is not None]
    G["nbFacturesTotal"] = len(fact)
    G["montantFacturesTotal"] = r2(sum(abs(x["montant"]) for x in fact))
    G["panierMoyenFacture"] = r2(G["montantFacturesTotal"] / len(fact)) if fact else 0
    tr = []
    for label, lo, hi in TRANCHES:
        s = [x for x in fact if abs(x["montant"]) >= lo and (hi is None or abs(x["montant"]) < hi)]
        m = r2(sum(abs(x["montant"]) for x in s))
        tr.append({"label": label, "nbFactures": len(s), "montantFactures": m,
                   "pctNb": pct(len(s), len(fact)), "pctMontant": pct(m, G["montantFacturesTotal"])})
    G["tranches"] = tr

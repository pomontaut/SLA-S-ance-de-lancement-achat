#!/usr/bin/env python3
"""Nettoie les conditions de paiement des JSON de dépense : l'extraction d'origine a laissé « <n° facture>|<code> <condition> »
(ex. « 1000069103|4 30 JOURS NET ») au lieu de « 30 JOURS NET ». Même méthode que depense_import._condition :
texte après le DERNIER « | », puis on retire le code numérique de tête (« 4 », « 3 », « 7 », « 102 »…).
N'altère ni les dates d'échéance ni les montants (écarts signalés à titre de contrôle)."""
import json, os, re, sys
HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
import depense_import as I

FOURN = os.path.join(HERE, "..", "public", "data", "depensesFournisseurs.json")


COMPTANT = re.compile(r"^((Frist:\s*)?0 T, 0 T 0%, 0 T 0%, 0 T 0%|0 jours)$", re.I)  # libellé ABACUS « 0 jour » = paiement au comptant


def propre(c):
    if c and COMPTANT.match(c.strip()):
        return "Comptant"
    if c and re.fullmatch(r"\d{3} 0 jours", c):  # code 102 resté sans le n° de facture
        return c.split(None, 1)[1]
    if not c or "|" not in c:
        return c
    seg = c.split("|")[-1].strip()
    if re.match(r"^\d+\s+\S", seg):
        seg = seg.split(None, 1)[1]
    return seg.strip() or None


def main():
    F = json.load(open(FOURN))
    n = ech = 0
    for f in F:
        for d in f["documents"]:
            nv = propre(d.get("condition"))
            if nv != d.get("condition"):
                if I._echeance(d.get("dateDoc"), nv) != d.get("dateEcheance"):
                    ech += 1
                d["condition"] = nv; n += 1
        f["conditions"] = list(dict.fromkeys(propre(c) for c in (f.get("conditions") or []) if propre(c)))
    print(n, "conditions nettoyées ;", ech, "dont l'échéance recalculée diffère de celle stockée (non modifiée)")
    json.dump(F, open(FOURN, "w"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()

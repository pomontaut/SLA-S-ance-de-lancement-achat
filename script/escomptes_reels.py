"""Escomptes réellement pris : écart entre le montant de la facture (TTC) et le montant payé.

Lit les journaux fournisseurs bruts ABACUS (kred_16 : lignes « Z » = paiement, colonne « Montant du paiement »)
et le journal compilé 2025 (colonnes « Montant doc » / « Montant paiement ») et écrit
public/data/escomptesReels.json : { "<n° fournisseur>:<n° doc>": escompte TTC pris (CHF) }.
Un écart n'est retenu comme escompte que s'il est > 0 et ≤ 6 % de la facture (un paiement partiel n'est pas un escompte).
Usage : python3 script/escomptes_reels.py <dossier des journaux> [sortie.json]
"""
import glob, json, os, sys
import openpyxl

SEUIL = 0.06


def lire_brut(path):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    out, cur = {}, None
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i < 5:
            continue
        r = list(r) + [None] * (15 - len(r))
        g = str(r[12] or '')
        if r[0] is None and isinstance(r[1], int) and (g == 'Facture' or g.startswith('Note de cr')):
            cur = dict(nfr=r[2], genre=g, doc=r[14], pay=None)
            out[(str(r[2]), r[1])] = cur
            continue
        if cur is not None and r[0] == 'Z' and isinstance(r[14], (int, float)):
            cur['pay'] = (cur['pay'] or 0) + r[14]
    return out


def lire_compile(path):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True)['Journal COFI Compilé']
    rows = ws.iter_rows(values_only=True)
    h = next(rows)
    ix = {k: i for i, k in enumerate(h)}
    out = {}
    for r in rows:
        k = (str(r[ix['N° fr']]), r[ix['N° doc']])
        if r[ix['N° doc']] is None or k in out:
            continue
        out[k] = dict(nfr=r[ix['N° fr']], genre=str(r[ix['Genre']] or ''), doc=r[ix['Montant doc']], pay=r[ix['Montant paiement']])
    return out


def main(dossier, sortie):
    docs = {}
    for f in sorted(glob.glob(os.path.join(dossier, '*.xlsx'))):
        wb = openpyxl.load_workbook(f, read_only=True)
        noms = wb.sheetnames
        wb.close()
        if 'Journal COFI Compilé' in noms:
            docs.update(lire_compile(f))
        elif noms and noms[0].startswith('kred'):
            docs.update(lire_brut(f))
    res = {}
    for (nfr, docno), d in docs.items():
        if d['genre'] != 'Facture' or not isinstance(d['doc'], (int, float)) or not isinstance(d['pay'], (int, float)):
            continue
        if d['doc'] <= 0 or d['pay'] <= 0:
            continue
        ecart = d['doc'] - d['pay']
        if 0.005 < ecart <= SEUIL * d['doc']:
            res[f'{nfr}:{docno}'] = round(ecart, 2)
    json.dump(res, open(sortie, 'w'), separators=(',', ':'))
    print(len(docs), 'documents,', len(res), 'escomptes, total TTC', round(sum(res.values())))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'public/data/escomptesReels.json')

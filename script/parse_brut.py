"""Lecture d'un export brut ABACUS « kred_16 » (documents fournisseurs + positions comptables)."""
import openpyxl
def iso(x): return x.strftime('%Y-%m-%d') if hasattr(x,'strftime') else None
def parse(path,aff):
    ws=openpyxl.load_workbook(path,read_only=True,data_only=True).worksheets[0]
    docs=[];cur=None;nxt=False;tags={}
    for i,r in enumerate(ws.iter_rows(values_only=True)):
        if i<5: continue
        r=list(r)+[None]*(15-len(r)); g=str(r[12] or '')
        if r[0] is None and isinstance(r[1],int) and (g=='Facture' or g.startswith('Note de cr')):
            cur=dict(docno=r[1],nfr=r[2],nom=r[3],dateDoc=iso(r[5]),genre=g,montantDoc=r[14],aff=aff,gb=r[11],pos=[],pay=None,payG=None,details=None,dispo=None,cofi=None,visa=None)
            docs.append(cur); nxt=True; continue
        if cur is None: continue
        if nxt:
            nxt=False
            if r[0] is None:
                cur['dispo']=iso(r[3]); cur['cofi']=iso(r[5]); cur['details']=r[12]; continue
        t=r[0]
        if t: tags[t]=tags.get(t,0)+1
        if t=='P':
            cur['pos'].append(dict(debit=str(r[2]),sect=r[4],montant=r[14],texte=r[12]))
        elif t=='Z': cur['pay']=iso(r[10])
        elif t in ('G','g','z','X','S'): cur.setdefault('payo',{})[t]=iso(r[10])
        elif t=='Visé': cur['visa']=r[3] or cur['visa']
    return docs,tags

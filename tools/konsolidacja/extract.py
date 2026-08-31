# -*- coding: utf-8 -*-
"""Ekstrakcja tresci z oryginalow: docx (struktura), pdf/html/xlsx/pptx (z .txt)."""
import os, re, json, sys
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

def iter_block_items(parent):
    body = parent.element.body
    for child in body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)

def heading_level(p):
    try:
        s = (p.style.name or '')
    except Exception:
        s = ''
    m = re.match(r'Heading (\d)', s) or re.match(r'Nag.?.?wek (\d)', s)
    if m: return int(m.group(1))
    if s in ('Title','Tytu\u0142'): return 0
    # dokumenty bez stylow: poziom z rozmiaru czcionki
    sizes=[r.font.size.pt for r in p.runs if r.font.size and r.text.strip()]
    if not sizes: return None
    mx=max(sizes)
    txt=p.text.strip()
    if len(txt)>200: return None
    if mx>=24: return 0
    if mx>=16: return 1
    if mx>=14: return 2
    if mx>=11.5: return 3
    return None

def read_docx(path):
    """-> list of blocks: ('h',lvl,text) ('p',None,text) ('t',None,rows)"""
    d = Document(path)
    out=[]
    for b in iter_block_items(d):
        if isinstance(b, Paragraph):
            t = b.text.strip()
            if not t: continue
            lvl = heading_level(b)
            out.append(('h',lvl,t) if lvl is not None else ('p',None,t))
        else:
            rows=[]
            for r in b.rows:
                cells=[c.text.strip().replace('\n',' ') for c in r.cells]
                # scal duplikaty z merge
                ded=[]
                for c in cells:
                    if not ded or ded[-1]!=c: ded.append(c)
                if any(ded): rows.append(ded)
            if rows: out.append(('t',None,rows))
    return out

def read_txt(path):
    """Sklejanie lamanych linii w akapity + rozpoznanie markdown/tabel."""
    raw = open(path, encoding='utf-8', errors='replace').read()
    raw = raw.replace('\r\n', '\n')
    out = []; buf = []
    def flush():
        if buf:
            t = ' '.join(x.strip() for x in buf).strip()
            t = re.sub(r'\s+', ' ', t)
            if t: out.append(('p', None, t))
            buf.clear()
    for ln in raw.split('\n'):
        t = ln.rstrip()
        s_ = t.strip()
        if not s_:
            flush(); continue
        m = re.match(r'^(#{1,6})\s+(.*)$', s_)
        if m:
            flush(); out.append(('h', min(len(m.group(1)), 4), m.group(2).strip())); continue
        if s_.startswith('|') and s_.count('|') >= 2:
            flush()
            if re.match(r'^\|[\s:\-\|]+\|?$', s_): continue
            cells = [c.strip() for c in s_.strip('|').split('|')]
            if out and out[-1][0] == 't':
                out[-1][2].append(cells)
            else:
                out.append(('t', None, [cells]))
            continue
        if re.match(r'^([-*\u2022\u2013]|\d+[.)])\s+', s_):
            flush(); out.append(('p', None, s_)); continue
        if re.match(r'^(=|-){3,}$', s_):
            flush(); continue
        buf.append(s_)
        # akapit konczy sie kropka + krotka linia = koniec bloku
        if len(' '.join(buf)) > 4000:
            flush()
    flush()
    return out

def read_any(orig, txt):
    if orig and orig.lower().endswith('.docx'):
        try: return read_docx(orig)
        except Exception as e: sys.stderr.write('docx fail %s: %s\n'%(orig,e))
    return read_txt(txt)

if __name__=='__main__':
    inv=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','INVENTORY.json')))
    byidx={r['idx']:r for r in inv}
    for i in [int(x) for x in sys.argv[1:]]:
        r=byidx[i]; b=read_any(r['orig'], r['txt'])
        from collections import Counter
        c=Counter(k for k,_,_ in b)
        hs=[t for k,l,t in b if k=='h'][:12]
        print('#%d %s -> blokow %d %s'%(i, r['name'][:52], len(b), dict(c)))
        for h in hs: print('    H:', h[:88])

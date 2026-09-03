#!/usr/bin/env python3
"""Rozbija paczki .md (konwersje zipow) na pojedyncze pliki zrodlowe."""
import os
import json, os, re, hashlib, unicodedata

BASE = os.environ.get("KONSOLIDACJA_BASE", os.path.dirname(os.path.abspath(__file__)))
SRC, PARTS = f"{BASE}/src", f"{BASE}/parts"

DOC_EXT = r"(?:docx|doc|pdf|xlsx|xls|pptx|ppt|md|html|htm|txt|csv|json|rtf)"
FILE_HDR = re.compile(rf"^##\s+(.+\.{DOC_EXT})\s*(?:\(\d+\))?\s*$", re.I)

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", s).strip("_")
    return s[:90] or "plik"

def clean_pptx(lines):
    """Z rozpakowanego XML pptx zostawia wylacznie tekst slajdow."""
    NOISE = {"Microsoft Office PowerPoint", "On-screen Show (16:9)", "PptxGenJS",
             "true", "false", "0", "1"}
    out = []
    for ln in lines:
        s = ln.strip()
        if not s or s.startswith("|") or s.startswith("#"):
            continue
        if s in NOISE or len(s) < 3:
            continue
        if re.fullmatch(r"[\d\s.,:%+/-]+", s):
            continue
        out.append(s)
    ded, seen = [], set()
    for s in out:                       # slajdy powtarzaja naglowki layoutu
        if s not in seen:
            seen.add(s); ded.append(s)
    return ded

records = []
for bundle in sorted(os.listdir(SRC)):
    if not bundle.endswith(".md"):
        continue
    lines = open(f"{SRC}/{bundle}", encoding="utf-8", errors="replace").read().split("\n")
    hdrs = [(i, m.group(1).strip()) for i, ln in enumerate(lines) if (m := FILE_HDR.match(ln))]
    # granice: naglowek pliku -> nastepny naglowek pliku
    for k, (start, name) in enumerate(hdrs):
        end = hdrs[k + 1][0] if k + 1 < len(hdrs) else len(lines)
        body = lines[start + 1:end]
        ext = name.rsplit(".", 1)[-1].lower()
        if ext in ("pptx", "ppt"):
            body = clean_pptx(body)
        # usun powtorzony tytul jako H1 na starcie
        while body and (not body[0].strip() or body[0].strip().lstrip("# ").strip() == name):
            body.pop(0)
        text = "\n".join(body).strip()
        if not text:
            continue
        idx = len(records) + 1
        fn = f"{idx:03d}__{slug(name)}.md"
        open(f"{PARTS}/{fn}", "w", encoding="utf-8").write(text)
        records.append({
            "id": idx, "part_file": fn, "source_name": name, "ext": ext,
            "bundle": bundle, "chars": len(text), "words": len(text.split()),
            "lines": text.count("\n") + 1,
            "sha256": hashlib.sha256(text.encode()).hexdigest(),
        })

json.dump(records, open(f"{BASE}/work/index.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print(f"plikow zrodlowych: {len(records)}")
print(f"slow lacznie:      {sum(r['words'] for r in records):,}")
print(f"znakow lacznie:    {sum(r['chars'] for r in records):,}")
from collections import Counter
print("wg typu:", dict(Counter(r["ext"] for r in records)))
print("wg paczki:", dict(Counter(r["bundle"] for r in records)))

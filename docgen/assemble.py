"""/ASSEMBLE — złożenie dokumentu, Karta wiarygodności, konwersja do .docx (§10)."""

import re
import shutil
import subprocess
from pathlib import Path

from . import budget as B
from . import markers as M
from .manifest import natkey, DONE, DRAFT

RE_BRAK = re.compile(r"\[BRAK[^\]]*\]")
RE_USTAL = re.compile(r"\[DO USTALENIA[^\]]*\]")


def build_markdown(man) -> str:
    written = [s for s in man.sections if s.text]
    written.sort(key=lambda s: natkey(s.id))
    k = M.karta(written)

    total_words = sum(s.words for s in written)
    out = [f"# {man.document}", ""]

    # Metryka
    out += [
        "## Metryka dokumentu", "",
        "| Pole | Wartość |", "|---|---|",
        f"| Tryb | {man.mode} |",
        f"| Objętość | {total_words} sł. ≈ {B.pages(total_words)} str. "
        f"(cel {man.target_pages} str.) |",
        f"| Sekcje gotowe | {sum(1 for s in written if s.status == DONE)} "
        f"/ {len(man.sections)} |",
        f"| Próg wiarygodności | {man.threshold}% |",
        "",
    ]

    if k["status"] == "SZKIELETOWY" or man.threshold >= 20:
        out += [
            "> **WARIANT SZKIELETOWY** — "
            f"{100 - k['pokrycie_zewnetrzne_pct']:.0f}% treści oparte na założeniach. "
            "Nie stanowi podstawy decyzyjnej przed podstawieniem danych.",
            "",
        ]

    out += [M.karta_markdown(k), "", "---", ""]

    # Spis treści
    out += ["## Spis treści", ""]
    for s in written:
        mark = "" if s.status == DONE else f"  _({s.status})_"
        out.append(f"- **{s.id}** {s.title}{mark}")
    out += ["", "---", ""]

    # Treść
    for s in written:
        out.append(s.text.strip())
        out.append("")

    # Listy kontrolne
    braki, ustal = [], []
    for s in written:
        for m in RE_BRAK.findall(s.text):
            braki.append((s.id, m))
        for m in RE_USTAL.findall(s.text):
            ustal.append((s.id, m))

    out += ["---", "", "## Lista kontrolna przed publikacją", ""]
    out.append(f"**Luki [BRAK]: {len(braki)}**  _(znaczniki nie są usuwane — §8 W5)_")
    out += [f"- {sid} — {txt}" for sid, txt in braki] or ["- brak"]
    out.append("")
    out.append(f"**[DO USTALENIA]: {len(ustal)}**")
    out += [f"- {sid} — {txt}" for sid, txt in ustal] or ["- brak"]
    out.append("")

    if man.assumptions:
        out += ["**Rejestr założeń**", ""]
        out += [f"- {kk}: {vv}" for kk, vv in sorted(man.assumptions.items())]
        out.append("")
    if man.decisions:
        out += ["**Rejestr decyzji (do zatwierdzenia)**", ""]
        out += [f"- {kk}: {vv}" for kk, vv in sorted(man.decisions.items())]
        out.append("")

    pending = [s for s in man.sections if s.status in (DRAFT, "DO_PRZEGLADU")]
    if pending:
        out += ["**Sekcje wymagające przepisania lub przeglądu**", ""]
        out += [f"- {s.id} {s.title} — {s.status}" for s in pending]
        out.append("")

    return "\n".join(out)


def to_docx(md_path, docx_path, reference=None):
    """Konwersja przez pandoc. reference: opcjonalny reference.docx ze stylami."""
    if not shutil.which("pandoc"):
        return None, "pandoc niedostępny — plik .md gotowy do ręcznej konwersji"
    cmd = ["pandoc", str(md_path), "-o", str(docx_path),
           "--toc", "--toc-depth=2", "-f", "markdown+pipe_tables"]
    if reference and Path(reference).exists():
        cmd += [f"--reference-doc={reference}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return None, r.stderr.strip()
    return docx_path, "ok"


def assemble(man, outdir=".", reference=None):
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^\w]+", "_", man.document)[:60].strip("_") or "dokument"
    md_path = outdir / f"{slug}.md"
    md_path.write_text(build_markdown(man), encoding="utf-8")
    docx_path, msg = to_docx(md_path, outdir / f"{slug}.docx", reference)
    return md_path, docx_path, msg

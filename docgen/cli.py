"""CLI generatora — odpowiedniki komend /OUTLINE /STATUS /GEN /QA /KARTA /ASSEMBLE."""

import argparse
import json
import sys
from pathlib import Path

from . import assemble as A
from . import budget as Bg
from . import markers as M
from . import protocol as P
from . import prompts as Pr
from .manifest import Manifest, DONE
from .templates import TEMPLATES

DEFAULT = "manifest.json"


def _load(path):
    if not Path(path).exists():
        sys.exit(f"Brak manifestu: {path}. Uruchom najpierw `docgen init`.")
    return Manifest.load(path)


def cmd_init(a):
    man = Manifest.from_template(a.title, a.mode, a.pages, a.profile or "", a.language)
    man.threshold = a.threshold
    if a.seed:
        man.seed_id = a.seed
    man.save(a.manifest)
    print(man.outline())
    print()
    if man.threshold > 60:
        print(P.blokada("dokument", f"próg wiarygodności {man.threshold}% > 60%",
                        ["dane do pola B (PROFIL PODMIOTU)"],
                        "(a) uzupełnij profil (b) sama struktura (c) profil stubowy"))
    else:
        print(f"Zapisano {a.manifest}. Następny krok: docgen blocks")


def cmd_outline(a):
    print(_load(a.manifest).outline())


def cmd_blocks(a):
    man = _load(a.manifest)
    print(f"KOLEJKA PRODUKCYJNA — {len(man.blocks())} bloków\n")
    for nr, ids, total in man.blocks():
        flag = "" if Bg.BLOCK_MIN <= total <= Bg.BLOCK_MAX else "  ⚠ poza pasmem"
        print(f"B{nr:<3} {total:>5} sł.  {', '.join(ids)}{flag}")


def cmd_status(a):
    man = _load(a.manifest)
    done = sum(1 for s in man.sections if s.status == DONE)
    print(f"{man.document} | tryb {man.mode}")
    print(f"Sekcje: {done}/{len(man.sections)} GOTOWE")
    print(f"Słowa: {man.written_words()}/{man.total_budget()} ({man.progress()}%)")
    print(f"Strony: {Bg.pages(man.written_words())} / cel {man.target_pages}")
    nxt = man.next_section()
    print(f"Następna: {nxt.id} {nxt.title}" if nxt else "Następna: — (kolejka pusta)")
    blocked = [s for s in man.sections
               if s.status != DONE and man.unmet_deps(s.id)]
    if blocked:
        print("\nZablokowane zależnościami:")
        for s in blocked[:10]:
            print(f"  {s.id} ← czeka na {', '.join(man.unmet_deps(s.id))}")


def cmd_prompt(a):
    man = _load(a.manifest)
    ids = list(a.ids)
    if not ids:
        blocks = man.blocks()
        if not blocks:
            sys.exit("Kolejka pusta.")
        ids = blocks[0][1]
    missing = [i for i in ids if man.get(i) is None]
    if missing:
        sys.exit(f"Nieznane ID: {', '.join(missing)}")
    ok, msg = P.faza0(man, ids[0])
    if not ok:
        print(msg)
        return
    if msg != "FAZA 0: OK":
        print(f"# {msg}\n", file=sys.stderr)
    prompt, ctx_words = Pr.section_prompt(man, ids)
    if a.out:
        Path(a.out).write_text(prompt, encoding="utf-8")
        print(f"Zapisano prompt do {a.out} (okno kontekstowe: {ctx_words} sł.)")
    else:
        print(prompt)


def cmd_ingest(a):
    man = _load(a.manifest)
    text = Path(a.file).read_text(encoding="utf-8")
    report = P.ingest(man, a.id, text)
    man.save(a.manifest)
    print(f"Wchłonięto {report['id']}: {report['slowa']} sł. "
          f"(budżet {report['budzet']}, odchylenie {report['odchylenie_pct']:+.1f}%) "
          f"→ {report['status']}")
    if report["otwarte"] and report["otwarte"].lower() != "brak":
        print(f"OTWARTE: {report['otwarte']}")
    if report["kontrola"]:
        print("\nKontrola sekcji:")
        for rank, problem, fix in report["kontrola"]:
            print(f"  [{rank}] {problem} → {fix}")


def cmd_source(a):
    man = _load(a.manifest)
    if a.canon:
        man.canon.append(a.canon)
        print(f"KANON += {a.canon}")
    if a.file:
        sid = a.id or f"ŹR{len(man.sources) + 1}"
        man.sources.append({"id": sid, "file": a.file,
                            "role": a.role, "date": a.date or "—"})
        print(f"REJESTR ŹRÓDEŁ += {sid} | {a.file} | {a.role} | {a.date or '—'}")
    man.save(a.manifest)
    for s in man.sources:
        print(f"  {s['id']} | {s['file']} | {s['role']} | {s['date']}")


def cmd_qa(a):
    print(P.qa_report(_load(a.manifest), a.ids))


def cmd_karta(a):
    man = _load(a.manifest)
    written = [s for s in man.sections if s.text]
    if not written:
        sys.exit("Brak wchłoniętych sekcji.")
    k = M.karta(written)
    print(M.karta_markdown(k) if not a.json else
          json.dumps(k, ensure_ascii=False, indent=2))


def cmd_revise(a):
    man = _load(a.manifest)
    s = man.get(a.id)
    if not s:
        sys.exit(f"Brak sekcji {a.id}")
    s.status = "TODO"
    s.text, s.words, s.summary = "", 0, ""
    touched = man.mark_review(a.id)
    man.save(a.manifest)
    print(f"{a.id} → TODO. Do przeglądu: {', '.join(touched) or 'brak'}")


def cmd_assemble(a):
    man = _load(a.manifest)
    md, docx, msg = A.assemble(man, a.outdir, a.reference)
    print(f"Markdown: {md}")
    print(f"DOCX: {docx or '—'} ({msg})")


def main(argv=None):
    p = argparse.ArgumentParser("docgen", description="Generator dokumentów długich v3.0")
    p.add_argument("-m", "--manifest", default=DEFAULT)
    sub = p.add_subparsers(dest="cmd", required=True)

    i = sub.add_parser("init", help="/OUTLINE — zbuduj manifest z szablonu")
    i.add_argument("title")
    i.add_argument("--mode", choices=list(TEMPLATES), required=True)
    i.add_argument("--pages", type=int, default=60)
    i.add_argument("--profile", default="")
    i.add_argument("--threshold", type=int, default=0)
    i.add_argument("--language", default="polski")
    i.add_argument("--seed", default="")
    i.set_defaults(func=cmd_init)

    sub.add_parser("outline").set_defaults(func=cmd_outline)
    sub.add_parser("blocks").set_defaults(func=cmd_blocks)
    sub.add_parser("status").set_defaults(func=cmd_status)

    pr = sub.add_parser("prompt", help="/GEN — zbuduj prompt sekcji")
    pr.add_argument("ids", nargs="*")
    pr.add_argument("--out", default="")
    pr.set_defaults(func=cmd_prompt)

    ing = sub.add_parser("ingest", help="wchłoń odpowiedź modelu")
    ing.add_argument("id")
    ing.add_argument("file")
    ing.set_defaults(func=cmd_ingest)

    sc = sub.add_parser("source", help="REJESTR ŹRÓDEŁ / KANON")
    sc.add_argument("--file", default="")
    sc.add_argument("--id", default="")
    sc.add_argument("--role", default="ŹRÓDŁO ZEW.",
                    choices=["WZORZEC", "KANON", "DANE", "ŹRÓDŁO ZEW.", "REJESTR"])
    sc.add_argument("--date", default="")
    sc.add_argument("--canon", default="")
    sc.set_defaults(func=cmd_source)

    q = sub.add_parser("qa")
    q.add_argument("ids", nargs="*")
    q.set_defaults(func=cmd_qa)

    ka = sub.add_parser("karta")
    ka.add_argument("--json", action="store_true")
    ka.set_defaults(func=cmd_karta)

    rv = sub.add_parser("revise")
    rv.add_argument("id")
    rv.set_defaults(func=cmd_revise)

    asm = sub.add_parser("assemble")
    asm.add_argument("--outdir", default=".")
    asm.add_argument("--reference", default="")
    asm.set_defaults(func=cmd_assemble)

    a = p.parse_args(argv)
    a.func(a)


if __name__ == "__main__":
    main()

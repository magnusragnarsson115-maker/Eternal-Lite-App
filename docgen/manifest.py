"""Manifest — jedyny nośnik stanu (§4 GENERATOR v3.0)."""

import json
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path

from . import budget as B
from .templates import TEMPLATES

TODO, DRAFT, DONE, REVIEW = "TODO", "SZKIC", "GOTOWE", "DO_PRZEGLADU"


def natkey(sid: str):
    """Sortowanie naturalne ID: A.2 < A.10, 2.2 < 2.10."""
    parts = re.split(r"[.\s]", sid)
    out = []
    for p in parts:
        m = re.match(r"^(\d+)([a-z]?)$", p)
        if m:
            out.append((1, int(m.group(1)), m.group(2)))
        else:
            out.append((0, 0, p))
    return out


@dataclass
class Section:
    id: str
    title: str
    budget: int
    depends_on: list = field(default_factory=list)
    status: str = TODO
    summary: str = ""
    words: int = 0
    text: str = ""
    fixed: bool = False


@dataclass
class Manifest:
    document: str = ""
    mode: str = "biznesowy"
    target_pages: int = 60
    threshold: int = 0
    language: str = "polski"
    profile: str = ""
    sources: list = field(default_factory=list)     # {"id","file","role","date"}
    terms: dict = field(default_factory=dict)
    canon: list = field(default_factory=list)
    assumptions: dict = field(default_factory=dict)  # Z1 -> tresc
    decisions: dict = field(default_factory=dict)    # D1 -> tresc
    sections: list = field(default_factory=list)
    seed_id: str = ""

    # ---------- budowa ----------

    @classmethod
    def from_template(cls, document, mode, target_pages=60, profile="", language="polski"):
        if mode not in TEMPLATES:
            raise ValueError(f"nieznany tryb: {mode}; dostępne: {list(TEMPLATES)}")
        m = cls(document=document, mode=mode, target_pages=target_pages,
                profile=profile, language=language)
        remap = {}
        for spec in TEMPLATES[mode]:
            w = B.scale(spec["base"], target_pages, spec["fixed"])
            parts = B.split_oversize(spec["id"], w)
            if len(parts) > 1:
                # odesłania do rozbitej sekcji kierujemy na jej ostatnią część
                remap[spec["id"]] = parts[-1][0]
            for sid, sw in parts:
                deps = list(spec["depends_on"])
                if sid != spec["id"] and sid[-1] != "a":
                    deps.append(spec["id"] + chr(ord(sid[-1]) - 1))
                m.sections.append(Section(id=sid, title=spec["title"], budget=sw,
                                          depends_on=deps, fixed=spec["fixed"]))
        if remap:
            for s in m.sections:
                s.depends_on = [remap.get(d, d) for d in s.depends_on
                                if remap.get(d, d) != s.id]
        m.sections.sort(key=lambda s: natkey(s.id))
        return m

    # ---------- dostep ----------

    def get(self, sid):
        for s in self.sections:
            if s.id == sid:
                return s
        return None

    def done_ids(self):
        return {s.id for s in self.sections if s.status == DONE}

    def unmet_deps(self, sid):
        s = self.get(sid)
        if not s:
            return []
        done = self.done_ids()
        return [d for d in s.depends_on if d not in done and self.get(d) is not None]

    def ready(self):
        """Sekcje TODO, których zależności są spełnione — w kolejności naturalnej."""
        return [s for s in self.sections
                if s.status == TODO and not self.unmet_deps(s.id)]

    def next_section(self):
        r = self.ready()
        return r[0] if r else None

    def queue(self):
        """Symuluje pełną kolejność produkcji respektującą zależności."""
        done = set(self.done_ids())
        remaining = [s for s in self.sections if s.status != DONE]
        order = []
        guard = 0
        while remaining and guard < 10000:
            guard += 1
            progressed = False
            for s in list(remaining):
                if all(d in done or self.get(d) is None for d in s.depends_on):
                    order.append(s)
                    done.add(s.id)
                    remaining.remove(s)
                    progressed = True
            if not progressed:  # cykl zależności
                order.extend(remaining)
                break
        return order

    def blocks(self):
        return B.plan_blocks([(s.id, s.budget) for s in self.queue()])

    # ---------- statystyki ----------

    def total_budget(self):
        return sum(s.budget for s in self.sections)

    def written_words(self):
        return sum(s.words for s in self.sections)

    def progress(self):
        t = self.total_budget()
        return round(self.written_words() / t * 100, 1) if t else 0.0

    # ---------- rewizja ----------

    def mark_review(self, sid):
        """§4 /REWIZJA — sekcje zależne od zmienionej idą do przeglądu."""
        touched = []
        for s in self.sections:
            if sid in s.depends_on and s.status == DONE:
                s.status = REVIEW
                touched.append(s.id)
        return touched

    # ---------- IO ----------

    def to_dict(self):
        d = asdict(self)
        return d

    @classmethod
    def from_dict(cls, d):
        secs = [Section(**s) for s in d.pop("sections", [])]
        m = cls(**d)
        m.sections = secs
        return m

    def save(self, path="manifest.json"):
        Path(path).write_text(json.dumps(self.to_dict(), ensure_ascii=False, indent=2),
                              encoding="utf-8")
        return path

    @classmethod
    def load(cls, path="manifest.json"):
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))

    # ---------- prezentacja ----------

    def outline(self):
        lines = [
            f"DOKUMENT: {self.document}",
            f"TRYB: {self.mode} | CEL: {self.target_pages} str. / "
            f"{B.words_for_pages(self.target_pages)} sł. | PRÓG: {self.threshold}%",
            f"PROFIL: {self.profile or '[BRAK: profil podmiotu | pole B briefu]'}",
            "",
            f"{'ID':<7}{'Sekcja':<52}{'Sł.':>6}{'Str.':>6}  {'Zależy od':<18}{'Status'}",
            "-" * 104,
        ]
        for s in self.sections:
            dep = ",".join(s.depends_on)[:17] or "—"
            lines.append(f"{s.id:<7}{s.title[:51]:<52}{s.budget:>6}"
                         f"{B.pages(s.budget):>6}  {dep:<18}{s.status}")
        total = self.total_budget()
        target = B.words_for_pages(self.target_pages)
        lines += [
            "-" * 104,
            f"SUMA: {total} sł. ≈ {B.pages(total)} str. | "
            f"cel {target} sł. | odchylenie {B.deviation(total, target):+.1f}%",
            f"BLOKI PRODUKCYJNE: {len(self.blocks())} (po 1200–1800 sł.)",
        ]
        return "\n".join(lines)

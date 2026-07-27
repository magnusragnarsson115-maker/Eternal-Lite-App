"""Wiarygodność — §8 GENERATOR v3.0. Parsowanie znaczników, Karta, detekcja ryzyk."""

import re
from collections import Counter

COVERAGE = ["ŹRÓDŁO", "WEB", "SZACUNEK", "WNIOSEK", "ZAŁOŻENIE", "DECYZJA", "BRAK"]

RE_COV = re.compile(r"\[(" + "|".join(COVERAGE) + r")\b([^\]]*)\]")
RE_CERT = re.compile(r"\{(W|Ś|N)(\*?)\}")
RE_BRAK_OK = re.compile(r"\[BRAK:\s*[^|\]]{4,}\|\s*[^\]]{4,}\]")
RE_BRAK_ANY = re.compile(r"\[BRAK[^\]]*\]")
RE_BLOCK_BASIS = re.compile(r">\s*PODSTAWA SEKCJI:")

# §8 W6 — formaty podwyższonego ryzyka
RISKY = {
    "publikator Dz.U./M.P.": re.compile(r"\b(Dz\.\s?U\.|M\.\s?P\.)"),
    "pozycja aktu":          re.compile(r"\bpoz\.\s*\d+"),
    "sygnatura orzeczenia":  re.compile(r"\b(sygn\.|[IVX]+ [A-Z]{2,4} \d+/\d+|C-\d+/\d+)"),
    "norma ISO/IEC/EN/PN":   re.compile(r"\b(ISO(/IEC)?|IEC|EN|PN)[\s-]?\d{3,}"),
    "DOI/ISBN":              re.compile(r"\b(doi:|DOI|ISBN)\b", re.I),
    "nazwisko + rok":        re.compile(r"\b[A-ZŁŚŻŹĆÓĘĄŃ][a-złśżźćóęąń]{2,}\s*\(\d{4}\)"),
    "CAGR / udział rynku":   re.compile(r"\b(CAGR|udział rynk\w+|wielkość rynku)\b", re.I),
    "kwota kary / próg":     re.compile(r"\b(kara|kary|próg)\w*\s+(do\s+)?\d"),
}

# zwroty maskujące brak (§8 W5)
SMOOTHED = [
    "według dostępnych szacunków", "przyjmuje się, że", "szacuje się, że",
    "zwykle wynosi", "typowo wynosi", "rzędu", "w granicach",
]

BANNED_PHRASES = {
    "biznesowy": ["rewolucyjn", "przełomow", "unikaln", "ogromny potencjał",
                  "game changer", "synergi", "holistyczn", "w dzisiejszych czasach"],
    "prawny": ["powinien", "warto ", "zaleca się", "w miarę możliwości"],
    "naukowy": [],
    "sf4a": [],
}

FILLER = ["warto podkreślić", "należy zauważyć", "poniżej przedstawiono",
          "jak wspomniano wcześniej", "w niniejszej sekcji omówimy"]


def scan(text: str) -> dict:
    """Zlicza znaczniki pokrycia, pewności i luk w tekście sekcji."""
    cov = Counter(m.group(1) for m in RE_COV.finditer(text))
    cert = Counter()
    crit = Counter()
    for m in RE_CERT.finditer(text):
        cert[m.group(1)] += 1
        if m.group(2) == "*":
            crit[m.group(1)] += 1
    return {
        "coverage": dict(cov),
        "certainty": dict(cert),
        "critical": dict(crit),
        "brak": len(RE_BRAK_ANY.findall(text)),
        "brak_malformed": len(RE_BRAK_ANY.findall(text)) - len(RE_BRAK_OK.findall(text)),
        "block_basis": bool(RE_BLOCK_BASIS.search(text)),
        "words": len(text.split()),
    }


ABBR = ["Dz", "U", "M", "P", "poz", "art", "ust", "pkt", "lit", "r", "s", "nr",
        "tj", "tzn", "np", "mln", "mld", "tys", "ok", "zob", "por", "im", "in"]
RE_SENT = re.compile(
    r"(?<=[.!?])\s+(?=[A-ZŁŚŻŹĆÓĘĄŃ\[])"
)


def sentences(text: str):
    """Dzieli na zdania, nie łamiąc polskich skrótów (Dz.U., poz., art., mln)."""
    protected = text
    for a in ABBR:
        protected = re.sub(rf"\b{a}\.", f"{a}\u0001", protected)
    return [s.replace("\u0001", ".") for s in RE_SENT.split(protected) if s.strip()]


def risky_claims(text: str) -> list:
    """Zwraca fragmenty w formatach podwyższonego ryzyka bez znacznika pokrycia w zdaniu."""
    findings = []
    for sentence in sentences(text):
        has_cov = bool(RE_COV.search(sentence))
        for name, rx in RISKY.items():
            if rx.search(sentence) and not has_cov:
                findings.append((name, sentence.strip()[:140]))
    return findings


def smoothed_gaps(text: str) -> list:
    out = []
    low = text.lower()
    for phrase in SMOOTHED:
        for m in re.finditer(re.escape(phrase), low):
            frag = text[max(0, m.start() - 40): m.start() + 90].replace("\n", " ")
            if not RE_COV.search(frag):
                out.append((phrase, frag.strip()))
    return out


def style_violations(text: str, mode: str) -> list:
    out = []
    low = text.lower()
    for p in FILLER:
        if p in low:
            out.append(("wypełniacz", p))
    for p in BANNED_PHRASES.get(mode, []):
        if p in low:
            out.append((f"zakazane w trybie {mode}", p))
    return out


def weakest_link(levels: list) -> str:
    """§8 W2 — pewność twierdzenia złożonego = pewność najsłabszego składnika."""
    order = {"W": 3, "Ś": 2, "N": 1}
    if not levels:
        return "N"
    return min(levels, key=lambda x: order.get(x, 1))


def karta(sections) -> dict:
    """Karta wiarygodności (§8 W7) na podstawie listy obiektów Section z .text."""
    cov, cert, crit = Counter(), Counter(), Counter()
    braki, malformed, risky = 0, 0, 0
    for s in sections:
        if not s.text:
            continue
        r = scan(s.text)
        cov.update(r["coverage"])
        cert.update(r["certainty"])
        crit.update(r["critical"])
        braki += r["brak"]
        malformed += max(0, r["brak_malformed"])
        risky += len(risky_claims(s.text))

    external = cov.get("ŹRÓDŁO", 0) + cov.get("WEB", 0)
    own = cov.get("SZACUNEK", 0) + cov.get("WNIOSEK", 0)
    assumed = cov.get("ZAŁOŻENIE", 0) + cov.get("DECYZJA", 0)
    total_cov = external + own + assumed
    total_cert = sum(cert.values())

    pct = lambda a, b: round(a / b * 100, 1) if b else 0.0
    ws = pct(cert.get("W", 0) + cert.get("Ś", 0), total_cert)
    ext_share = pct(external, total_cov)
    crit_n = crit.get("N", 0)

    if braki == 0 and ws >= 80 and crit_n == 0 and risky == 0:
        status = "GOTOWY"
    elif ext_share < 40:
        status = "SZKIELETOWY"
    elif ws >= 60 and risky == 0:
        status = "GOTOWY WARUNKOWO"
    else:
        status = "ROBOCZY"

    return {
        "twierdzen_z_pokryciem": total_cov,
        "pokrycie_zewnetrzne": external, "pokrycie_zewnetrzne_pct": ext_share,
        "szacunki_wnioski": own, "szacunki_wnioski_pct": pct(own, total_cov),
        "zalozenia_decyzje": assumed, "zalozenia_decyzje_pct": pct(assumed, total_cov),
        "W": cert.get("W", 0), "W_pct": pct(cert.get("W", 0), total_cert),
        "S": cert.get("Ś", 0), "S_pct": pct(cert.get("Ś", 0), total_cert),
        "N": cert.get("N", 0), "N_pct": pct(cert.get("N", 0), total_cert),
        "krytyczne": sum(crit.values()), "krytyczne_N": crit_n,
        "luki": braki, "luki_zle_sformatowane": malformed,
        "ryzyko_konfabulacji": risky,
        "status": status,
    }


def karta_markdown(k: dict) -> str:
    return "\n".join([
        "## KARTA WIARYGODNOŚCI",
        "",
        "| Miara | Wartość |",
        "|---|---|",
        f"| Twierdzeń z pokryciem | {k['twierdzen_z_pokryciem']} |",
        f"| Pokrycie zewnętrzne (ŹRÓDŁO/WEB) | {k['pokrycie_zewnetrzne']} ({k['pokrycie_zewnetrzne_pct']}%) |",
        f"| Szacunki i wnioski własne | {k['szacunki_wnioski']} ({k['szacunki_wnioski_pct']}%) |",
        f"| Założenia i decyzje autorskie | {k['zalozenia_decyzje']} ({k['zalozenia_decyzje_pct']}%) |",
        f"| Pewność wysoka {{W}} | {k['W']} ({k['W_pct']}%) |",
        f"| Pewność średnia {{Ś}} | {k['S']} ({k['S_pct']}%) |",
        f"| Pewność niska {{N}} | {k['N']} ({k['N_pct']}%) |",
        f"| Twierdzenia krytyczne | {k['krytyczne']}, w tym {{N*}}: {k['krytyczne_N']} |",
        f"| Luki [BRAK] | {k['luki']} (źle sformatowanych: {k['luki_zle_sformatowane']}) |",
        f"| Ryzyko konfabulacji (formaty W6 bez pokrycia) | {k['ryzyko_konfabulacji']} |",
        "",
        f"**STATUS DOKUMENTU: {k['status']}**",
        "",
        "_Status wynika z liczb, nie z oceny uznaniowej (§8 W7)._",
    ])

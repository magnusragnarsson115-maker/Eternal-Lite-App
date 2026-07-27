"""Budowa promptu sekcji — FAZA 1 okno kontekstowe (§6).

Zasada: model dostaje manifest + streszczenia sekcji GOTOWYCH + jeden wzorzec
stylu. Nigdy pełnej treści sekcji gotowych ani treści sekcji TODO.
"""

from . import budget as B
from .templates import MODE_RULES
from .manifest import DONE


def context_window(man, section_id):
    """Zwraca (tekst_kontekstu, licznik_slow) — mierzalny koszt okna."""
    s = man.get(section_id)
    parts = [
        "=== MANIFEST ===",
        f"DOKUMENT: {man.document}",
        f"TRYB: {man.mode} | CEL: {man.target_pages} str. | JĘZYK: {man.language}",
        f"PROFIL: {man.profile or '[BRAK: profil podmiotu | pole B briefu]'}",
    ]
    if man.sources:
        parts.append("REJESTR ŹRÓDEŁ:")
        for src in man.sources:
            parts.append(f"  {src.get('id')} | {src.get('file')} | "
                         f"{src.get('role')} | {src.get('date','—')}")
    if man.terms:
        parts.append("TERMINY (wiążące): " +
                     "; ".join(f"{k}={v}" for k, v in man.terms.items()))
    if man.canon:
        parts.append("KANON (wiążący): " + "; ".join(man.canon))
    if man.assumptions:
        parts.append("ZAŁOŻENIA: " +
                     "; ".join(f"{k}: {v}" for k, v in man.assumptions.items()))
    if man.decisions:
        parts.append("DECYZJE: " +
                     "; ".join(f"{k}: {v}" for k, v in man.decisions.items()))

    done = [x for x in man.sections if x.status == DONE and x.summary]
    if done:
        parts.append("")
        parts.append("=== STRESZCZENIA SEKCJI GOTOWYCH (nie powtarzaj ich treści) ===")
        for x in done:
            parts.append(f"{x.id} {x.title}: {x.summary}")

    if man.seed_id and man.seed_id != section_id:
        seed = man.get(man.seed_id)
        if seed and seed.text:
            parts.append("")
            parts.append(f"=== WZORZEC STYLU (sekcja {seed.id}) — kopiuj parametry, "
                         "nigdy treści ani konstrukcji zdań otwierających ===")
            parts.append(seed.text[:1800])

    txt = "\n".join(parts)
    return txt, len(txt.split())


def section_prompt(man, section_ids):
    """Prompt gotowy do wysłania do modelu dla jednego bloku (1-n sekcji)."""
    if isinstance(section_ids, str):
        section_ids = [section_ids]
    rules = MODE_RULES.get(man.mode, {})
    ctx, ctx_words = context_window(man, section_ids[0])

    spec_lines = []
    total = 0
    for sid in section_ids:
        s = man.get(sid)
        unmet = man.unmet_deps(sid)
        flag = f"  [SZKIC — zależności niespełnione: {', '.join(unmet)}]" if unmet else ""
        spec_lines.append(f"  {sid} — {s.title} — budżet {s.budget} sł. "
                          f"(±15%){flag}")
        total += s.budget

    prompt = f"""{ctx}

=== TRYB: {man.mode.upper()} ===
MANDAT: {rules.get('mandat','')}
ZDANIE: {rules.get('zdanie','')} | FORMALNOŚĆ: {rules.get('formalnosc','')}
JEDNOSTKA GENEROWANIA: {rules.get('jednostka','')}
CYTACJE: {rules.get('cytacje','')}
ZAKAZANE: {rules.get('zakazy','')}
{rules.get('test','')}
OBJAWY WYCIEKU TRYBU (sprawdź przed wysłaniem): {rules.get('wyciek','')}

=== ZADANIE ===
Wygeneruj sekcje:
{chr(10).join(spec_lines)}
Łączny budżet bloku: {total} sł. (limit odpowiedzi 1200–1800 sł.)

=== POKRYCIE I PEWNOŚĆ ===
POKRYCIE: [ŹRÓDŁO: ŹRn, lokalizacja] [WEB: domena, data] [SZACUNEK: metoda, ±zakres]
          [WNIOSEK: z <ID>] [ZAŁOŻENIE Zn] [DECYZJA Dn] [BRAK: co | gdzie sprawdzić]
PEWNOŚĆ:  {{W}} źródło pierwotne w okresie ważności · {{Ś}} jedno źródło lub szacunek
          metodą jawną · {{N}} źródło wtórne, analogia, ekstrapolacja, założenie własne
Twierdzenie niosące rekomendację lub wniosek → gwiazdka {{W*}}{{Ś*}}{{N*}}.
Ogniwo najsłabsze: pewność twierdzenia złożonego ≤ pewności najsłabszego składnika.
≥60% sekcji na jednej podstawie → "> PODSTAWA SEKCJI: [znacznik] {{poziom}}",
wewnątrz oznaczaj tylko odstępstwa. Ten sam znacznik maks. 3× w sekcji.

TEST PRZYPOMNIENIA przed każdą liczbą i nazwą własną: (a) jest w kontekście,
(b) stabilna wiedza powszechna, (c) wyliczyłem i podam działanie.
"Brzmi poprawnie" NIE JEST WIEDZĄ → [BRAK] albo [SZACUNEK] z metodą.

=== FORMAT ODPOWIEDZI ===
Nic przed, nic po. Dla każdej sekcji:

[opc.] > PODSTAWA SEKCJI: [znacznik] {{poziom}}
### <ID> <Tytuł dokładnie jak wyżej>
<treść>
<STAN>
ID: <id> | SŁOWA: ok. <n> (±10%)
STRESZCZENIE: <2 zdania — ustalenie główne + konsekwencja>
ŹRÓDŁA: <wykaz lub brak>
PEWNOŚĆ: {{W}} n | {{Ś}} n | {{N}} n | [BRAK] n | krytyczne {{N*}} n
NOWE TERMINY: <termin=definicja; ... | brak>
NOWE ZAŁOŻENIA: <Zn: treść | brak>
NOWE DECYZJE: <Dn: treść | brak>
OTWARTE: <luki, sprzeczności, decyzje dla użytkownika | brak>
</STAN>

Pierwsze zdanie sekcji nie powiela, nie streszcza i nie zapowiada — wnosi treść.
Za mało materiału → pisz krócej i zgłoś w OTWARTE. Nie dobijaj objętości watą.
"""
    return prompt, ctx_words

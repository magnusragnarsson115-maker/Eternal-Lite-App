# Generator Dokumentów Długich v3.0 — Claude Code

Projekt Claude Code produkujący dokumenty 50+ stron. Silnik `docgen` trzyma stan
i egzekwuje reguły policzalne; subagenty piszą i audytują w izolowanych kontekstach.

## Uruchomienie

```bash
unzip docgen-claude-code.zip && cd docgen-claude-code
claude
```

Sprawdź, czy subagenty się wczytały: `/agents`. Jeżeli ich nie ma — zrestartuj
sesję (katalog `.claude/agents/` jest skanowany przy starcie).

## Pierwszy dokument

```
/nowy Strategia transformacji cyfrowej 2026-2030, biznesowy, 50 stron
/blok
/stan
/blok
...
/audyt
/zloz
```

## Bez Claude Code — sam silnik

```bash
python3 -m docgen init "Tytuł" --mode biznesowy --pages 50 \
    --profile "NOVA Sp. z o.o., 340 FTE, 180 mln PLN" --threshold 15
python3 -m docgen source --file audyt.pdf --role DANE --date 2025-11
python3 -m docgen blocks
python3 -m docgen prompt --out blok.txt     # → wklej do modelu
python3 -m docgen ingest 2.1 odpowiedz.md
python3 -m docgen qa
python3 -m docgen karta
python3 -m docgen assemble --outdir out
```

## Co jest gdzie

| Plik | Rola |
|---|---|
| `CLAUDE.md` | instrukcja orkiestratora — reguły wiążące sesji głównej |
| `.claude/agents/architekt-dokumentu.md` | brief, próg wiarygodności, aktualność podstawy |
| `.claude/agents/redaktor-sekcji.md` | pisze sekcję, kontekst = tylko prompt |
| `.claude/agents/audytor-sekcji.md` | audyt bez skrzywienia autora |
| `.claude/agents/weryfikator-zrodel.md` | weryfikacja w sieci, okresy ważności |
| `.claude/commands/` | `/nowy` `/blok` `/audyt` `/stan` `/zloz` |
| `.claude/settings.json` | uprawnienia — docgen i pandoc bez pytania |
| `docgen/` | silnik (biblioteka standardowa, bez zależności) |

## Dlaczego audytor jest osobnym subagentem

Model, który właśnie napisał sekcję, pamięta powody swoich wyborów i prawie
zawsze je uzna. Audytor dostaje tekst bez tej pamięci — <b>to jedyna
konfiguracja, w której audyt jest realny</b>. W jednym oknie czatu nie da się
tego osiągnąć.

## Wymagania

Python 3.10+ (biblioteka standardowa), `pandoc` do konwersji `.docx`.

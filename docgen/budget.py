"""Budżety objętości — §5 GENERATOR v3.0."""

WORDS_PER_PAGE = 320
TABLE_ROW = 45
TABLE_HEADER = 40
CHART = 130
LIST_WORDS_PER_PAGE = 260

BLOCK_MIN = 1200
BLOCK_MAX = 1800
SECTION_MAX = 1200

TEMPLATE_BASE_PAGES = 60


def pages(words: int, table_rows: int = 0, tables: int = 0, charts: int = 0) -> float:
    """Szacunek stron wg przelicznika §5."""
    equivalent = words
    equivalent += table_rows * TABLE_ROW + tables * TABLE_HEADER
    equivalent += charts * CHART
    return round(equivalent / WORDS_PER_PAGE, 1)


def words_for_pages(target_pages: int) -> int:
    return int(target_pages * WORDS_PER_PAGE)


def scale(base_words: int, target_pages: int, fixed: bool = False) -> int:
    """Skalowanie budżetu sekcji. Pozycje [STAŁA] nie skalują się."""
    if fixed:
        return base_words
    factor = target_pages / TEMPLATE_BASE_PAGES
    return int(round(base_words * factor / 10.0) * 10)


def split_oversize(section_id: str, budget: int):
    """Sekcja > BLOCK_MAX → rozbicie na <ID>a/b/c po <= SECTION_MAX (§6 FAZA 2)."""
    if budget <= BLOCK_MAX:
        return [(section_id, budget)]
    parts = -(-budget // SECTION_MAX)  # ceil
    per = int(round(budget / parts / 10.0) * 10)
    out = []
    for i in range(parts):
        suffix = chr(ord("a") + i)
        w = per if i < parts - 1 else budget - per * (parts - 1)
        out.append((f"{section_id}{suffix}", w))
    return out


def plan_blocks(sections):
    """Grupuje sekcje w bloki 1200-1800 sł. na odpowiedź.

    sections: iterable (id, budget) w kolejności produkcji.
    Zwraca listę bloków: [(nr, [ids], suma_slow), ...]
    """
    blocks, current, total, nr = [], [], 0, 1
    for sid, budget in sections:
        if current and total + budget > BLOCK_MAX:
            blocks.append((nr, current, total))
            nr += 1
            current, total = [], 0
        current.append(sid)
        total += budget
    if current:
        blocks.append((nr, current, total))
    return blocks


def deviation(actual: int, target: int) -> float:
    if target == 0:
        return 0.0
    return round((actual - target) / target * 100, 1)

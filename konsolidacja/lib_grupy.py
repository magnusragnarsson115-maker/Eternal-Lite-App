# -*- coding: utf-8 -*-
"""Klasyfikacja 149 plikow zrodlowych na grupy tematyczne. Pierwsza regula wygrywa."""
import re

GRUPY = {
 "G1": "Specyfikacje produktu",
 "G2": "Rejestry funkcji i modulow",
 "G3": "Biznes, monetyzacja, koszty",
 "G4": "Prawo, certyfikacja, regulacje",
 "G5": "Architektura i technologia",
 "G6": "Strategia, ekosystem, roadmapa",
 "G7": "Pytania, odpowiedzi, konwersacje",
 "G8": "Analizy, audyty, weryfikacja",
 "G9": "Materialy prezentacyjne",
}

REGULY = [
 ("G9", r"pitch|prezentacj"),
 ("G1", r"specyfikacja_master|app_specyfikacja|specyfikacja_scalona|specyfikacja_i_architektura|dokumentacja_kompletna|specyfikacja_master"),
 ("G7", r"^chat ?gpt|pytania|same pytania|odpowiedzi|rejestr_pytan|model_odpowiedzi|piec_odpowiedzi|piec_rozstrzygniec|piec_punktow|konwersacj"),
 ("G8", r"audyt|weryfikacj|analiza|zweryfikowane|braki_specyfikacji|wykonalnosc|punkty_wspolne|punktow_wspolnych|analiza_relacyjna|zestawienia|profil_agenci|ocena"),
 ("G4", r"mdr|certyfikacja|licencj|statut|fundacj|podmiot_zgody|normy|ikp|ezdrowie|panstwo|projekt_publiczny|rodo|regulac|zgodnosc|nadzor"),
 ("G2", r"rejestr|modul|funkcj|taksonomia|115|185|299|309|160"),
 ("G5", r"architektura|komponent|api|gateway|urzadzen|sprzet|warstwow|software|bci|capsule|dostawc|agregacj|klasy_"),
 ("G3", r"biznesplan|monetyzacj|przychod|rentownosc|koszt|freemium|karty_produktowe|produkty|korporacyjn|podsumowanie wykonawcze|alternatywy|marketing|model_monetyzacji"),
 ("G6", r"macierz|roadmap|projekt|punkt|wizja|hub|forge|orkiestrator|marketplace|sekwencj|plan|skala|dekompozycj|warianty|zbudowac|konkurencja|wyroznia|werdykt|strukturaln|dwie_powierzchnie|struktura|ewolucja|podprojekt|mapowanie"),
]

def grupa(nazwa: str) -> str:
    n = nazwa.lower()
    for gid, pat in REGULY:
        if re.search(pat, n):
            return gid
    return "G6"

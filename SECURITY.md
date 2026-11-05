# Bezpieczeństwo — zgłaszanie podatności

Podatności w Eternal (`app/`) zgłaszaj na adres podany w `/.well-known/security.txt` instancji
(zmienna `SECURITY_CONTACT`), a w sprawie tego repozytorium — prywatnie przez **GitHub → Security → Report a vulnerability**.

- Potwierdzamy otrzymanie w ciągu 3 dni roboczych, ocenę i plan naprawy przekazujemy w ciągu 10 dni roboczych.
- Nie testuj na danych prawdziwych pacjentów i nie pobieraj danych innych osób — użyj trybu demonstracyjnego
  (`DEMO_MODE=true`, `npm run seed:demo`, wszystkie dane fikcyjne).
- Nie podejmujemy kroków prawnych wobec osób działających w dobrej wierze w tych granicach.

Wykaz składników oprogramowania (CycloneDX): `cd app && npm run sbom`. Zależności aktualizuje Dependabot,
cotygodniowy skan Trivy i `npm audit` uruchamia `.github/workflows/security.yml`.

## Reporting vulnerabilities (EN)

Report to the address in the instance's `/.well-known/security.txt` or privately via GitHub Security Advisories.
We acknowledge within 3 business days and share an assessment within 10 business days. Do not test on real
patient data — use demo mode with fictional data.

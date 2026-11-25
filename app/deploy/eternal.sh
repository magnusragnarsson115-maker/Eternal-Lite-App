#!/usr/bin/env bash
# Eternal — instalacja i obsługa na serwerze (Docker Compose: aplikacja + Caddy z HTTPS).
# Instrukcja krok po kroku: docs/WDROZENIE_SERWER.md
#
#   ./deploy/eternal.sh install            pierwsza instalacja (pyta o domenę i tryb)
#   ./deploy/eternal.sh status | check     stan kontenerów | co jest podłączone (dostawcy, klucze)
#   ./deploy/eternal.sh restart            zastosowanie zmian w .env (np. po wpisaniu klucza dostawcy)
#   ./deploy/eternal.sh backup | restore   kopia zapasowa danych | odtworzenie z pliku
#   ./deploy/eternal.sh update             kopia + nowa wersja kodu + przebudowa
#   ./deploy/eternal.sh help               wszystkie polecenia
# shellcheck disable=SC1111  # polskie cudzysłowy w komunikatach są zamierzone
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_DIR/.env"
BACKUP_DIR="${ETERNAL_BACKUP_DIR:-$APP_DIR/backups}"
CLI=(node --disable-warning=ExperimentalWarning dist/server/cli.js)
cd "$APP_DIR"

# --- pomocnicze ---------------------------------------------------------------------------------

if [ -t 1 ]; then B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'; else B=''; G=''; Y=''; R=''; N=''; fi
say() { printf '%s\n' "$*"; }
ok() { printf '%s✔%s %s\n' "$G" "$N" "$*"; }
warn() { printf '%s!%s %s\n' "$Y" "$N" "$*" >&2; }
die() { printf '%s✘ %s%s\n' "$R" "$*" "$N" >&2; exit 1; }

ASSUME_YES=0
ask() { # ask "Pytanie" "domyślna" → odpowiedź (bez terminala albo z --yes: domyślna)
  local q=$1 def=${2:-} ans
  if [ "$ASSUME_YES" = 1 ] || [ ! -t 0 ]; then printf '%s\n' "$def"; return; fi
  read -r -p "$q${def:+ [$def]}: " ans
  printf '%s\n' "${ans:-$def}"
}
confirm() { # confirm "Pytanie" → 0 = tak
  [ "$ASSUME_YES" = 1 ] && return 0
  [ -t 0 ] || return 1
  local ans
  read -r -p "$1 [t/N]: " ans
  case "$ans" in t | T | tak | y | Y | yes) return 0 ;; *) return 1 ;; esac
}

random_secret() { # random_secret <długość>
  local n=${1:-32}
  local s=''
  if command -v openssl >/dev/null 2>&1; then s="$(openssl rand -base64 $((n * 2)) | tr -dc 'A-Za-z0-9')"
  else s="$(head -c $((n * 4)) /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9')"; fi
  printf '%s\n' "${s:0:$n}"
}

env_get() { # env_get KLUCZ → wartość z .env (pusta, gdy brak)
  [ -f "$ENV_FILE" ] || return 0
  K="$1" awk -F= 'BEGIN{k=ENVIRON["K"]} $1==k {sub(/^[^=]*=/, ""); v=$0} END{if (v!="") print v}' "$ENV_FILE"
}
env_set() { # env_set KLUCZ WARTOŚĆ — podmienia linię albo dopisuje na końcu (wartość bez interpretacji znaków)
  local tmp
  tmp="$(mktemp)"
  K="$1" V="$2" awk 'BEGIN{k=ENVIRON["K"]; v=ENVIRON["V"]; done=0}
    index($0, k"=")==1 { if (!done) print k"="v; done=1; next } { print }
    END { if (!done) print k"="v }' "$ENV_FILE" >"$tmp"
  cat "$tmp" >"$ENV_FILE"
  rm -f "$tmp"
}

need_docker() {
  command -v docker >/dev/null 2>&1 || die "Brak Dockera. Uruchom: ./deploy/eternal.sh install (zainstaluje go) albo https://docs.docker.com/engine/install/"
  docker info >/dev/null 2>&1 || die "Brak dostępu do Dockera — uruchom jako root (sudo) albo dodaj użytkownika do grupy docker."
  docker compose version >/dev/null 2>&1 || die "Brak wtyczki docker compose (pakiet docker-compose-plugin)."
}
need_env() { [ -f "$ENV_FILE" ] || die "Brak pliku .env — najpierw: ./deploy/eternal.sh install"; }
dc() { docker compose "$@"; }
project() { local p; p="$(env_get COMPOSE_PROJECT_NAME)"; printf '%s\n' "${p:-$(basename "$APP_DIR" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')}"; }
app_cid() { dc ps -q eternal 2>/dev/null | head -n1; }
in_app() { dc exec -T eternal "$@"; }

wait_healthy() { # wait_healthy <sekundy>
  local limit=${1:-240} waited=0 cid state
  while [ "$waited" -lt "$limit" ]; do
    cid="$(app_cid)"
    if [ -n "$cid" ]; then
      state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || true)"
      case "$state" in
        healthy) return 0 ;;
        exited | dead) dc logs --tail 60 eternal >&2; die "Aplikacja zatrzymała się przy starcie (logi powyżej)." ;;
      esac
    fi
    sleep 3
    waited=$((waited + 3))
  done
  dc logs --tail 60 eternal >&2
  die "Aplikacja nie odpowiada po ${limit} s (logi powyżej)."
}

public_ip() {
  local ip=''
  if command -v curl >/dev/null 2>&1; then ip="$(curl -fsS --max-time 6 https://api.ipify.org 2>/dev/null || true)"; fi
  [ -n "$ip" ] || ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  printf '%s\n' "$ip"
}

open_firewall() {
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q 'Status: active'; then
    ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null && ufw allow 443/udp >/dev/null && ok "Zapora ufw: otwarte porty 80 i 443."
  fi
}

install_docker() {
  command -v docker >/dev/null 2>&1 && return 0
  [ "$(id -u)" = 0 ] || die "Docker nie jest zainstalowany. Uruchom instalator jako root: sudo ./deploy/eternal.sh install"
  confirm "Docker nie jest zainstalowany. Zainstalować go teraz (oficjalny skrypt get.docker.com)?" || die "Bez Dockera nie da się uruchomić Eternal."
  command -v curl >/dev/null 2>&1 || { apt-get update -y && apt-get install -y curl ca-certificates; }
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker >/dev/null 2>&1 || true
  ok "Docker zainstalowany."
}

# Jakie dane są już w wolumenie aplikacji: empty | demo (konta pokazowe @eternal.local) | real | unknown.
data_kind() {
  docker volume inspect "$(project)_eternal-data" >/dev/null 2>&1 || { echo empty; return; }
  local image
  image="$(env_get ETERNAL_IMAGE)"
  docker image inspect "${image:-eternal:local}" >/dev/null 2>&1 || { echo unknown; return; }
  local out
  out="$(dc run --rm --no-deps -T --entrypoint node eternal --disable-warning=ExperimentalWarning --input-type=module -e "
    import fs from 'node:fs';
    const f = '/data/eternal.sqlite';
    if (!fs.existsSync(f)) { console.log('empty'); process.exit(0); }
    const { DatabaseSync } = await import('node:sqlite');
    const d = new DatabaseSync(f, { readOnly: true });
    const all = d.prepare('SELECT count(*) AS c FROM app_user').get().c;
    const demo = d.prepare(\"SELECT count(*) AS c FROM app_user WHERE email LIKE '%@eternal.local'\").get().c;
    console.log(all === 0 ? 'empty' : demo > 0 ? 'demo' : 'real');" 2>/dev/null || true)"
  out="$(printf '%s\n' "$out" | grep -E '^(empty|demo|real)$' | tail -n1 || true)"
  printf '%s\n' "${out:-unknown}"
}

# Nie mieszamy danych: pilotaż na bazie pokazowej zostawiłby konta z publicznym hasłem,
# a pokaz na bazie pilotażu dodałby dane fikcyjne i konta pokazowe do prawdziwych danych.
guard_data_for_mode() {
  local mode=$1 kind
  kind="$(data_kind)"
  case "$mode:$kind" in
    pilotaz:demo)
      warn "Wolumen zawiera dane pokazowe (konta z publicznym hasłem). Pilotaż wymaga pustej bazy."
      confirm "Usunąć dane pokazowe i zacząć pilotaż od pustej bazy?" || die "Przerwano — dane pokazowe zostały bez zmian."
      dc rm -sf eternal >/dev/null 2>&1 || true
      docker volume rm "$(project)_eternal-data" >/dev/null
      ok "Dane pokazowe usunięte."
      ;;
    pokaz:real)
      die "Ta instancja ma dane pilotażu. Tryb pokazowy dodałby do nich dane fikcyjne i konta z publicznym hasłem.
  Pokaz zainstaluj w osobnym katalogu z inną nazwą projektu (COMPOSE_PROJECT_NAME) i inną domeną."
      ;;
    *:unknown) warn "Nie udało się sprawdzić danych w wolumenie $(project)_eternal-data — kontynuuję." ;;
  esac
}

install_cron() {
  [ "$(id -u)" = 0 ] && [ -d /etc/cron.d ] || return 0
  printf '# Eternal — codzienna kopia zapasowa (rotacja wg BACKUP_RETENTION_DAYS w .env)\n17 3 * * * root %s backup >>/var/log/eternal-backup.log 2>&1\n' "$APP_DIR/deploy/eternal.sh" >/etc/cron.d/eternal-backup
  chmod 644 /etc/cron.d/eternal-backup
  ok "Codzienna kopia zapasowa o 3:17 (/etc/cron.d/eternal-backup, pliki w $BACKUP_DIR)."
}

print_access() {
  local domain mode
  domain="$(env_get ETERNAL_DOMAIN)"
  mode="$(env_get DEMO_MODE)"
  say ""
  say "${B}Adresy${N}"
  say "  aplikacja pacjenta:  https://$domain"
  say "  panel placówki:      https://$domain/panel"
  if [ "$mode" = true ]; then
    say ""
    say "${B}Konta pokazowe${N} (dane fikcyjne; na ekranie logowania są przyciski jednego kliknięcia, a przy kodzie MFA — „Wpisz kod”)"
    say "  hasło wszystkich kont: Eternal-Demo-2026"
    say "  pacjent@eternal.local (pacjentka Anna Kowalska), maria@eternal.local (pacjentka)"
    say "  anna.nowicka@eternal.local, piotr.zielinski@eternal.local (lekarze), recepcja@eternal.local, admin@eternal.local"
    say "  klinika estetyczna: joanna.malinowska@eternal.local (lekarka), karolina@eternal.local (pacjentka)"
    say "  ${Y}Nie wpisuj tu prawdziwych danych pacjentów.${N}"
  fi
}

# --- polecenia ----------------------------------------------------------------------------------

cmd_install() {
  local domain='' mode='' admin_email='' admin_name='' clinic='' smtp='' build=1
  while [ $# -gt 0 ]; do
    case "$1" in
      --domain) domain=$2; shift 2 ;;
      --mode) mode=$2; shift 2 ;;
      --admin-email) admin_email=$2; shift 2 ;;
      --admin-name) admin_name=$2; shift 2 ;;
      --clinic) clinic=$2; shift 2 ;;
      --smtp-url) smtp=$2; shift 2 ;;
      --no-build) build=0; shift ;;
      *) die "Nieznana opcja: $1 (zobacz: ./deploy/eternal.sh help)" ;;
    esac
  done

  say "${B}Eternal — instalacja na serwerze${N} (katalog: $APP_DIR)"
  install_docker
  need_docker

  if [ ! -f "$ENV_FILE" ]; then
    cp .env.example "$ENV_FILE"
    ok "Utworzono .env z .env.example."
  else
    ok "Używam istniejącego .env (sekrety zostają, uzupełniam brakujące)."
  fi
  chmod 600 "$ENV_FILE"

  # domena
  [ -n "$domain" ] || domain="$(env_get ETERNAL_DOMAIN)"
  if [ -z "$domain" ] || [ "$domain" = localhost ] && [ "$ASSUME_YES" = 0 ] && [ -t 0 ]; then
    say ""
    say "Domena, pod którą ma działać Eternal (rekord DNS typu A musi wskazywać ten serwer), np. demo.twoja-firma.pl."
    say "Nie masz domeny? Wpisz ${B}ip${N} — użyję bezpłatnego adresu <adres-ip>.sslip.io (certyfikat HTTPS też zadziała)."
    domain="$(ask "Domena" "ip")"
  fi
  if [ "$domain" = ip ]; then
    local ip
    ip="$(public_ip)"
    [ -n "$ip" ] || die "Nie udało się ustalić publicznego adresu IP — podaj domenę: --domain twoja.domena.pl"
    domain="${ip//./-}.sslip.io"
    ok "Adres bez domeny: $domain"
  fi
  [ -n "$domain" ] || domain=localhost

  # tryb
  [ -n "$mode" ] || mode="$(ask "Tryb: pokaz (dane fikcyjne, konta pokazowe) czy pilotaz (pusta placówka, prawdziwe konta)" "pokaz")"
  case "$mode" in pokaz | pilotaz) ;; *) die "Tryb musi być: pokaz albo pilotaz" ;; esac
  # przed jakąkolwiek zmianą .env — odmowa zostawia instancję dokładnie w poprzednim stanie
  guard_data_for_mode "$mode"

  env_set COMPOSE_PROJECT_NAME "$(env_get COMPOSE_PROJECT_NAME | grep . || echo eternal)"
  env_set ETERNAL_DOMAIN "$domain"
  env_set PUBLIC_URL "https://$domain"
  env_set NODE_ENV production
  env_set TRUST_PROXY true
  [ -n "$(env_get AUDIT_HMAC_KEY)" ] || env_set AUDIT_HMAC_KEY "$(random_secret 48)"
  case "$(env_get SECURITY_CONTACT)" in '' | *twoja-placowka.pl) env_set SECURITY_CONTACT "security@$domain" ;; esac
  case "$(env_get VAPID_SUBJECT)" in '' | *twoja-placowka.pl) env_set VAPID_SUBJECT "mailto:security@$domain" ;; esac
  # adres z przykładu nie istnieje — do czasu własnego serwera wideo publiczny Jitsi (tylko testy, bez danych pacjentów)
  case "$(env_get JITSI_DOMAIN)" in '' | *twoja-placowka.pl) env_set JITSI_DOMAIN meet.jit.si ;; esac
  [ -z "$smtp" ] || env_set SMTP_URL "$smtp"

  if [ "$mode" = pokaz ]; then
    env_set COMPOSE_FILE docker-compose.yml:docker-compose.demo.yml
    env_set DEMO_MODE true
    env_set DEMO_SEED_ON_START true
    case "$(env_get AI_PROVIDER)" in '' | none) env_set AI_PROVIDER demo ;; esac
    if [ -n "$(env_get SMTP_URL)" ]; then env_set REQUIRE_EMAIL_VERIFICATION true; else env_set REQUIRE_EMAIL_VERIFICATION false; fi
  else
    env_set COMPOSE_FILE docker-compose.yml
    env_set DEMO_MODE false
    env_set DEMO_SEED_ON_START false
    [ "$(env_get AI_PROVIDER)" != demo ] || env_set AI_PROVIDER none
    env_set REQUIRE_EMAIL_VERIFICATION true
    if [ -z "$(env_get SMTP_URL)" ]; then
      warn "Pilotaż bez SMTP_URL: pacjenci nie potwierdzą adresu e-mail i nie zresetują hasła. Wpisz SMTP_URL w .env i wykonaj: ./deploy/eternal.sh restart"
    fi
  fi
  ok "Konfiguracja zapisana w .env (tryb: $mode, adres: https://$domain)."

  open_firewall
  say ""
  if [ "$build" = 1 ]; then
    say "Buduję obraz aplikacji (pierwszy raz kilka minut; serwer potrzebuje min. 2 GB RAM)…"
    dc up -d --build
  else
    dc up -d --no-build
  fi
  say "Czekam, aż aplikacja odpowie…"
  wait_healthy 300
  ok "Aplikacja działa."

  if [ "$mode" = pilotaz ]; then
    [ -n "$clinic" ] || clinic="$(ask "Nazwa placówki" "Moja placówka")"
    if [ -z "$(in_app "${CLI[@]}" orgs 2>/dev/null | head -n1)" ]; then
      in_app "${CLI[@]}" create-org "$clinic" >/dev/null && ok "Placówka: $clinic"
    fi
    [ -n "$admin_email" ] || admin_email="$(ask "E-mail administratora" "")"
    if [ -n "$admin_email" ]; then
      [ -n "$admin_name" ] || admin_name="$(ask "Imię i nazwisko administratora" "Administrator")"
      cmd_create_admin "$admin_email" "$admin_name"
    else
      warn "Bez konta administratora — dodasz je: ./deploy/eternal.sh create-admin <email> \"Imię Nazwisko\""
    fi
  fi

  install_cron
  print_access
  say ""
  say "${B}Dalej${N}"
  say "  co jest podłączone:   ./deploy/eternal.sh check"
  say "  podłączenie dostawcy: wpisz klucz w $ENV_FILE i wykonaj ./deploy/eternal.sh restart"
  say "  opis dostawców i kosztów: docs/WDROZENIE_SERWER.md"
  if [ "$domain" != localhost ]; then
    say "  Certyfikat HTTPS: Caddy pobiera go przy pierwszym wejściu (domena musi wskazywać ten serwer, porty 80/443 otwarte)."
  fi
}

cmd_create_admin() {
  need_docker; need_env
  [ $# -ge 2 ] || die "Użycie: ./deploy/eternal.sh create-admin <email> \"Imię Nazwisko\""
  local pass
  pass="$(random_secret 20)"
  dc exec -T -e ADMIN_PASSWORD="$pass" eternal "${CLI[@]}" create-admin "$1" "$2"
  say ""
  say "${B}Hasło administratora (zapisz je teraz, nie zostanie pokazane ponownie):${N} $pass"
  say "Przy pierwszym logowaniu panel poprosi o konfigurację drugiego składnika (aplikacja uwierzytelniająca)."
}

cmd_status() {
  need_docker; need_env
  dc ps
  local cid
  cid="$(app_cid)"
  [ -z "$cid" ] || say "Stan aplikacji: $(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid")"
  say "Adres: https://$(env_get ETERNAL_DOMAIN) · tryb: $([ "$(env_get DEMO_MODE)" = true ] && echo pokaz || echo pilotaz)"
}

cmd_backup() {
  need_docker; need_env
  [ -n "$(app_cid)" ] || die "Aplikacja nie działa — uruchom: ./deploy/eternal.sh start"
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  local ts file pass
  ts="$(date +%Y%m%d-%H%M%S)"
  file="$BACKUP_DIR/eternal-$ts.tar.gz"
  # spójna kopia bazy (VACUUM INTO) + pliki z katalogu danych (dokumenty, klucze), bez roboczych plików SQLite
  in_app sh -c 'set -e; rm -rf /data/.backup-tmp; mkdir -p /data/.backup-tmp
    node --disable-warning=ExperimentalWarning dist/server/cli.js backup /data/.backup-tmp >/dev/null
    mv /data/.backup-tmp/eternal-*.sqlite /data/.backup-tmp/eternal.sqlite
    cd /data
    tar czf /tmp/eternal-backup.tar.gz --exclude=./.backup-tmp --exclude=./backups --exclude=./eternal.sqlite \
      --exclude=./eternal.sqlite-wal --exclude=./eternal.sqlite-shm . -C /data/.backup-tmp eternal.sqlite
    rm -rf /data/.backup-tmp'
  dc cp "eternal:/tmp/eternal-backup.tar.gz" "$file" >/dev/null 2>&1 || die "Nie udało się skopiować kopii z kontenera."
  in_app rm -f /tmp/eternal-backup.tar.gz
  pass="${BACKUP_PASSPHRASE:-$(env_get BACKUP_PASSPHRASE)}"
  if [ -n "$pass" ] && command -v openssl >/dev/null 2>&1; then
    if ETERNAL_BACKUP_PASS="$pass" openssl enc -aes-256-cbc -pbkdf2 -salt -in "$file" -out "$file.enc" -pass env:ETERNAL_BACKUP_PASS; then
      rm -f "$file"
      file="$file.enc"
    fi
  fi
  chmod 600 "$file"
  local keep
  keep="$(env_get BACKUP_RETENTION_DAYS)"
  find "$BACKUP_DIR" -maxdepth 1 -name 'eternal-*.tar.gz*' -mtime +"${keep:-35}" -delete 2>/dev/null || true
  ok "Kopia zapasowa: $file ($(du -h "$file" | cut -f1)). Zawiera dane osobowe — przechowuj zaszyfrowaną i poza serwerem."
}

cmd_restore() {
  need_docker; need_env
  local src=${1:-}
  [ -n "$src" ] && [ -f "$src" ] || die "Użycie: ./deploy/eternal.sh restore <plik kopii .tar.gz albo .tar.gz.enc>"
  src="$(cd "$(dirname "$src")" && pwd)/$(basename "$src")"
  confirm "Odtworzenie ZASTĄPI obecne dane aplikacji danymi z $(basename "$src"). Kontynuować?" || die "Przerwano."
  local plain="$src" tmpdir
  tmpdir="$(mktemp -d)"
  if [[ "$src" == *.enc ]]; then
    local pass="${BACKUP_PASSPHRASE:-$(env_get BACKUP_PASSPHRASE)}"
    [ -n "$pass" ] || die "Kopia jest zaszyfrowana — ustaw BACKUP_PASSPHRASE w .env albo w zmiennej środowiska."
    plain="$tmpdir/backup.tar.gz"
    ETERNAL_BACKUP_PASS="$pass" openssl enc -d -aes-256-cbc -pbkdf2 -in "$src" -out "$plain" -pass env:ETERNAL_BACKUP_PASS
  else
    cp "$src" "$tmpdir/backup.tar.gz"
    plain="$tmpdir/backup.tar.gz"
  fi
  chmod 755 "$tmpdir"; chmod 644 "$plain"
  tar tzf "$plain" eternal.sqlite >/dev/null 2>&1 || tar tzf "$plain" ./eternal.sqlite >/dev/null 2>&1 || die "To nie jest kopia Eternal (brak eternal.sqlite w archiwum)."
  dc stop eternal >/dev/null
  dc run --rm --no-deps -T -v "$tmpdir:/restore:ro" --entrypoint sh eternal -c \
    'set -e; find /data -mindepth 1 -maxdepth 1 ! -name backups -exec rm -rf {} +; tar xzf /restore/backup.tar.gz -C /data'
  rm -rf "$tmpdir"
  dc up -d --no-build eternal >/dev/null
  wait_healthy 300
  ok "Dane odtworzone z $(basename "$src")."
}

cmd_reset_demo() {
  need_docker; need_env
  [ "$(env_get DEMO_MODE)" = true ] || die "reset-demo działa tylko w trybie pokazowym (DEMO_MODE=true) — w pilotażu użyj restore."
  confirm "Usunąć wszystkie dane instancji pokazowej i utworzyć dane fikcyjne od nowa?" || die "Przerwano."
  dc stop eternal >/dev/null
  dc rm -f eternal >/dev/null
  docker volume rm "$(project)_eternal-data" >/dev/null
  dc up -d --no-build eternal >/dev/null
  wait_healthy 300
  ok "Dane pokazowe utworzone od nowa."
}

cmd_update() {
  need_docker; need_env
  [ -z "$(app_cid)" ] || cmd_backup
  if [ -d "$APP_DIR/../.git" ] || [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" pull --ff-only
  else
    say "Brak repozytorium git — rozpakuj nową paczkę w tym katalogu (plik .env i kopie zostaną) i uruchom update ponownie."
  fi
  dc up -d --build
  wait_healthy 300
  docker image prune -f >/dev/null 2>&1 || true
  ok "Zaktualizowano."
}

usage() {
  cat <<EOF
Eternal — obsługa serwera (katalog: $APP_DIR)

  install [opcje]           pierwsza instalacja: Docker, .env z sekretami, HTTPS, start, kopie co noc
      --domain D            domena (albo „ip” → <adres-ip>.sslip.io)
      --mode pokaz|pilotaz  dane fikcyjne z kontami pokazowymi | pusta placówka
      --clinic "Nazwa"      (pilotaż) nazwa placówki
      --admin-email E       (pilotaż) pierwszy administrator, --admin-name "Imię Nazwisko"
      --smtp-url URL        serwer poczty, np. smtps://login:haslo@smtp.dostawca.pl:465
      --no-build            użyj gotowego obrazu (ETERNAL_IMAGE w .env) zamiast budować
      --yes                 bez pytań (wartości domyślne; działa też z restore i reset-demo)
  start | stop | restart    uruchomienie | zatrzymanie | ponowne uruchomienie z nowym .env
  status                    stan kontenerów i adres
  check [--live]            co działa, co w trybie demo, czego brakuje (--live: test połączeń z dostawcami)
  logs [eternal|caddy]      logi na żywo
  create-admin E "Imię"     nowe konto administratora z losowym hasłem
  backup                    kopia danych do $BACKUP_DIR (szyfrowana, gdy BACKUP_PASSPHRASE w .env)
  restore <plik>            odtworzenie danych z kopii
  reset-demo                dane pokazowe od nowa (tylko tryb pokaz)
  update                    kopia + git pull + przebudowa
EOF
}

main() {
  local cmd=${1:-help} a args=()
  [ $# -eq 0 ] || shift
  for a in "$@"; do
    case "$a" in --yes | -y) ASSUME_YES=1 ;; *) args+=("$a") ;; esac
  done
  set -- "${args[@]+"${args[@]}"}"
  case "$cmd" in
    install) cmd_install "$@" ;;
    start) need_docker; need_env; dc up -d --no-build; wait_healthy 300; print_access ;;
    stop) need_docker; need_env; dc stop ;;
    restart) need_docker; need_env; dc up -d --no-build --force-recreate; wait_healthy 300; ok "Uruchomiono ponownie z aktualnym .env." ;;
    status) cmd_status ;;
    check) need_docker; need_env; in_app "${CLI[@]}" check --no-fail "$@" ;;
    logs) need_docker; need_env; dc logs -f --tail 200 "$@" ;;
    create-admin) cmd_create_admin "$@" ;;
    backup) cmd_backup ;;
    restore) cmd_restore "$@" ;;
    reset-demo) cmd_reset_demo ;;
    update) cmd_update ;;
    help | -h | --help) usage ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"

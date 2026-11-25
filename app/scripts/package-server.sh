#!/usr/bin/env bash
# Paczka do wgrania na serwer: kod potrzebny do zbudowania obrazu + instalator, bez node_modules, testów i dużych plików.
#   npm run package:server   →  release/eternal-serwer-<wersja>-<commit>.tar.gz
# Na serwerze:  tar xzf eternal-serwer-*.tar.gz && cd eternal && sudo ./deploy/eternal.sh install
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ver="$(node -p "require('./package.json').version")"
sha="$(git rev-parse --short HEAD 2>/dev/null || echo lokalna)"
name="eternal-serwer-$ver-$sha"
mkdir -p release
out="release/$name.tar.gz"

paths=(Dockerfile .dockerignore docker-compose.yml docker-compose.demo.yml .env.example package.json package-lock.json
  tsconfig.base.json tsconfig.json tsconfig.server.json tsconfig.web.json vite.config.ts README.md server web deploy
  docs/WDROZENIE_SERWER.md docs/POKAZ.md docs/COMPLIANCE.md docs/BRAKI_I_WDROZENIE.md docs/INTEGRATIONS.md docs/PROFILE_PLACOWEK.md)

list="$(mktemp)"
trap 'rm -f "$list"' EXIT
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # tylko pliki z repozytorium (bez lokalnych .env, danych i plików roboczych)
  git ls-files -- "${paths[@]}" >"$list"
  untracked="$(git ls-files --others --exclude-standard -- "${paths[@]}")"
  [ -z "$untracked" ] || { echo "Pliki spoza repozytorium (nie trafią do paczki — najpierw commit):" >&2; echo "$untracked" >&2; }
else
  find "${paths[@]}" -type f >"$list"
fi
printf '%s\n' "$sha" >release/VERSION
tar czf "$out" --transform 's,^,eternal/,' -T "$list" -C release VERSION
rm -f release/VERSION
echo "Zapisano $out ($(du -h "$out" | cut -f1), $(wc -l <"$list") plików)"
echo "Na serwerze: tar xzf $(basename "$out") && cd eternal && sudo ./deploy/eternal.sh install"

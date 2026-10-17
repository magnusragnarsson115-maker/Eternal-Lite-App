#!/bin/sh
# Serwer deweloperski w tle (zrzuty ekranu, film demo). Zatrzymanie: kill $(cat data/server.pid)
cd "$(dirname "$0")/.."
mkdir -p data
NODE_OPTIONS=--disable-warning=ExperimentalWarning HIBP_ENABLED=${HIBP_ENABLED:-false} PORT=${PORT:-3000} \
  nohup node --import tsx server/index.ts > data/server.log 2>&1 &
echo $! > data/server.pid

#!/bin/sh
# uruchomienie serwera deweloperskiego w tle (używane lokalnie do zrzutów ekranu)
cd "$(dirname "$0")"
NODE_OPTIONS=--disable-warning=ExperimentalWarning HIBP_ENABLED=false PORT=${PORT:-3000} nohup npx tsx server/index.ts > data/server.log 2>&1 &
echo $! > data/server.pid

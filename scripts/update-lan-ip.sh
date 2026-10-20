#!/usr/bin/env bash
# Updates every file that genuinely needs your machine's current LAN IP,
# in one shot, whenever it changes (DHCP lease renewal, switching WiFi
# networks, etc.).
#
# Usage:
#   ./scripts/update-lan-ip.sh 192.168.100.136
#
# This is deliberately a SHORT list. Two things that used to be on it no
# longer are:
#   - backend-new/.env's LIVEKIT_URL is now hardcoded to `localhost`
#     permanently - the backend and the LiveKit docker container run on
#     the same machine, so it never actually needed the LAN IP at all.
#   - livekit/livekit.yaml's webhook URL now uses `host.docker.internal`
#     (a stable Docker Desktop alias for "the host machine"), not the LAN
#     IP, for the same reason.
# See the comments in those two files for the full explanation.
#
# What's left below is left because it's genuinely unavoidable: physical/
# emulated devices reach this machine over the actual network, so they
# need a real, current LAN-reachable address - there's no `localhost`
# equivalent for that direction.
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <new-lan-ip>"
  echo "Example: $0 192.168.100.136"
  echo ""
  echo "Find your current LAN IP with:"
  echo "  macOS:   ipconfig getifaddr en0   (or en1 if you're on Ethernet)"
  echo "  Linux:   hostname -I"
  exit 1
fi

NEW_IP="$1"
if ! [[ "$NEW_IP" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
  echo "'$NEW_IP' doesn't look like an IPv4 address (expected e.g. 192.168.1.42)."
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# macOS's sed requires -i '' (an explicit, possibly-empty backup suffix);
# GNU sed (Linux) accepts -i directly. Detect which one we've got.
if sed --version >/dev/null 2>&1; then
  sed_i() { sed -i -E "$@"; }        # GNU sed
else
  sed_i() { sed -i '' -E "$@"; }     # BSD/macOS sed
fi

update() {
  local file="$1" pattern="$2"
  if [ ! -f "$file" ]; then
    echo "  SKIP (not found): $file"
    return
  fi
  sed_i "$pattern" "$file"
  echo "  updated: $file"
}

echo "Updating LAN IP references to $NEW_IP ..."
echo ""

update "backend-new/.env" \
  "s#^LIVEKIT_PUBLIC_URL=ws://[0-9.]+:#LIVEKIT_PUBLIC_URL=ws://${NEW_IP}:#"

update "livekit/.env" \
  "s#^PUBLIC_IP=[0-9.]+#PUBLIC_IP=${NEW_IP}#"
update "livekit/.env" \
  "s#^DOMAIN=[0-9.]+#DOMAIN=${NEW_IP}#"

update "livekit/livekit.yaml" \
  "s#node_ip: [0-9.]+#node_ip: ${NEW_IP}#"

update "mobile-app/api/client.ts" \
  "s#^const LAN_API_URL = 'http://[0-9.]+:#const LAN_API_URL = 'http://${NEW_IP}:#"
update "loni-server-app/api/client.ts" \
  "s#^const LAN_API_URL = 'http://[0-9.]+:#const LAN_API_URL = 'http://${NEW_IP}:#"

# Hygiene only: EXPO_PUBLIC_LIVEKIT_URL is currently dead code (nothing in
# the active call flow reads it - the backend supplies the real LiveKit
# URL to clients at runtime via CallActionResponse instead). Kept in sync
# anyway in case that ever changes back.
update "mobile-app/.env" \
  "s#^EXPO_PUBLIC_LIVEKIT_URL=ws://[0-9.]+:#EXPO_PUBLIC_LIVEKIT_URL=ws://${NEW_IP}:#"
update "loni-server-app/.env" \
  "s#^EXPO_PUBLIC_LIVEKIT_URL=ws://[0-9.]+:#EXPO_PUBLIC_LIVEKIT_URL=ws://${NEW_IP}:#"

cat <<EOF

Done. Restart order matters - each of these caches the old value until restarted:

  1. LiveKit (picks up node_ip + webhook config):
       cd livekit && docker compose down && docker compose up -d

  2. Backend (pydantic-settings reads .env once at process start):
       restart your uvicorn/FastAPI process

  3. Both apps (EXPO_PUBLIC_* is baked into the JS bundle at build time):
       npx expo start -c
     then fully relaunch (not just reload) each app.

api/client.ts changes only need a JS reload, not a rebuild.
EOF

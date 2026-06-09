#!/usr/bin/env bash
set -euo pipefail

OPEN_TARGET="${1:-}"

get_mac_api_url() {
  local lan_ip
  lan_ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  if [[ -n "$lan_ip" ]]; then
    printf 'http://%s:4000\n' "$lan_ip"
    return
  fi

  printf 'http://localhost:4000\n'
}

export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-$(get_mac_api_url)}"

echo "EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL"
echo "Starting Expo for macOS. Keep backend running on port 4000."

EXPO_ARGS=(expo start --host lan --clear)

case "$OPEN_TARGET" in
  android)
    EXPO_ARGS+=(--android)
    ;;
  ios)
    EXPO_ARGS+=(--ios)
    ;;
  "" )
    ;;
  * )
    echo "Unknown target: $OPEN_TARGET" >&2
    echo "Use: ./start-mac.sh [android|ios]" >&2
    exit 1
    ;;
esac

npx "${EXPO_ARGS[@]}"

#!/usr/bin/env bash
set -euo pipefail

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FLUTTER_BIN="${FLUTTER_BIN:-$HOME/development/flutter/bin/flutter}"
DEFAULT_SIMULATOR="${DEFAULT_IOS_SIMULATOR:-iPhone 14}"

if [[ ! -x "$FLUTTER_BIN" ]]; then
  echo "Flutter not found at $FLUTTER_BIN"
  echo "Install Flutter 3.38.10 (macOS 12 compatible) — see apps/mobile/README.md"
  exit 1
fi

# pnpm forwards `--` to the script; skip it.
if [[ "${1:-}" == "--" ]]; then
  shift
fi

cd "$ROOT_DIR/apps/mobile"
"$FLUTTER_BIN" pub get

DEVICE="${1:-}"

booted_ios_udid() {
  xcrun simctl list devices booted 2>/dev/null \
    | grep -E "iPhone|iPad" \
    | head -1 \
    | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/'
}

simulator_udid_for_name() {
  local name="$1"
  xcrun simctl list devices available \
    | grep "$name (" \
    | head -1 \
    | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/'
}

ensure_ios_simulator() {
  local udid
  udid="$(booted_ios_udid || true)"
  if [[ -n "$udid" ]]; then
    echo "$udid"
    return 0
  fi

  echo "No iOS Simulator running. Booting $DEFAULT_SIMULATOR..."
  udid="$(simulator_udid_for_name "$DEFAULT_SIMULATOR")"
  if [[ -z "$udid" ]]; then
    echo "Could not find simulator: $DEFAULT_SIMULATOR"
    echo "Open Xcode → Settings → Platforms to install iOS simulators, or run:"
    echo "  xcrun simctl list devices available"
    exit 1
  fi

  xcrun simctl boot "$udid" 2>/dev/null || true
  open -a Simulator 2>/dev/null || true

  # Flutter needs a moment to discover the booted simulator.
  for _ in {1..15}; do
    sleep 1
    if booted_ios_udid >/dev/null; then
      booted_ios_udid
      return 0
    fi
  done

  echo "Simulator booted but Flutter did not detect it yet."
  echo "Try: pnpm mobile:devices"
  exit 1
}

if [[ -n "$DEVICE" ]]; then
  exec "$FLUTTER_BIN" run -d "$DEVICE" --dart-define=SKIP_SETUP="${SKIP_SETUP:-true}"
fi

IOS_DEVICE="$(ensure_ios_simulator)"
echo "Running on iOS Simulator ($IOS_DEVICE)..."
exec "$FLUTTER_BIN" run -d "$IOS_DEVICE" --dart-define=SKIP_SETUP="${SKIP_SETUP:-true}"

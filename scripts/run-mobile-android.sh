#!/usr/bin/env bash
set -euo pipefail

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FLUTTER_BIN="${FLUTTER_BIN:-$HOME/development/flutter/bin/flutter}"

if [[ ! -x "$FLUTTER_BIN" ]]; then
  echo "Flutter not found at $FLUTTER_BIN"
  echo "Install Flutter 3.38.10 (macOS 12 compatible) — see apps/mobile/README.md"
  exit 1
fi

cd "$ROOT_DIR/apps/mobile"
"$FLUTTER_BIN" pub get

DEVICE="${1:-}"
if [[ -n "$DEVICE" ]]; then
  exec "$FLUTTER_BIN" run -d "$DEVICE" --dart-define=SKIP_SETUP="${SKIP_SETUP:-true}"
fi

exec "$FLUTTER_BIN" run -d android --dart-define=SKIP_SETUP="${SKIP_SETUP:-true}"

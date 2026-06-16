#!/usr/bin/env bash
set -euo pipefail

FLUTTER_BIN="${FLUTTER_BIN:-$HOME/development/flutter/bin/flutter}"

if [[ ! -x "$FLUTTER_BIN" ]]; then
  echo "Flutter not found."
  exit 1
fi

"$FLUTTER_BIN" devices

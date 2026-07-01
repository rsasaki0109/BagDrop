#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOON_DIR="$ROOT/moon"
OUT_DIR="$ROOT/apps/web/public/moon"
BUILD_ARTIFACT="$MOON_DIR/_build/wasm/release/build/cmd/core/core.wasm"

if ! command -v moon >/dev/null 2>&1; then
  echo "MoonBit CLI not found. Install from https://www.moonbitlang.com/download" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

(
  cd "$MOON_DIR"
  moon build --target wasm --release cmd/core
)

cp "$BUILD_ARTIFACT" "$OUT_DIR/core.wasm"
echo "Wrote $OUT_DIR/core.wasm"

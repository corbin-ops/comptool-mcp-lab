#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3003}"
NEXT_BIN="$ROOT_DIR/node_modules/next/dist/bin/next"
SWC_DIR="$ROOT_DIR/node_modules/@next/swc-darwin-arm64"

NODE_CANDIDATES=(
  "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  "/opt/homebrew/bin/node"
  "/usr/local/bin/node"
)

NODE_BIN=""

for candidate in "${NODE_CANDIDATES[@]}"; do
  if [ -x "$candidate" ]; then
    NODE_BIN="$candidate"
    break
  fi
done

if [ -z "$NODE_BIN" ] && command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
fi

if [ -z "$NODE_BIN" ]; then
  echo "No Node.js runtime found on this device."
  exit 1
fi

if [ ! -f "$NEXT_BIN" ]; then
  echo "Next.js is missing from node_modules. Restore node_modules or run npm install when internet is available."
  exit 1
fi

if [ ! -f "$SWC_DIR/next-swc.darwin-arm64.node" ]; then
  echo "Missing $SWC_DIR/next-swc.darwin-arm64.node"
  echo "Run this when internet is available:"
  echo "  curl -L --fail https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.2.4.tgz -o /tmp/next-swc-darwin-arm64.tgz"
  echo "  mkdir -p \"$SWC_DIR\""
  echo "  tar -xzf /tmp/next-swc-darwin-arm64.tgz -C \"$SWC_DIR\" --strip-components=1"
  exit 1
fi

cd "$ROOT_DIR"
exec "$NODE_BIN" "$NEXT_BIN" dev -p "$PORT"

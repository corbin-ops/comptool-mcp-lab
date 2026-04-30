#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION_DIR="$ROOT_DIR/extension"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(awk -F'"' '/"version":/ {print $4; exit}' "$EXTENSION_DIR/manifest.json")"
ZIP_PATH="$DIST_DIR/comptoolv2-extension-$VERSION.zip"

mkdir -p "$DIST_DIR"
rm -f "$ZIP_PATH"

cd "$EXTENSION_DIR"
zip -qr "$ZIP_PATH" manifest.json background.js content.js page-kml-bridge.js icons

echo "$ZIP_PATH"

#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/images"

cp "$ROOT_DIR/site/index.html" "$DIST_DIR/index.html"
cp "$ROOT_DIR/site/styles.css" "$DIST_DIR/styles.css"
cp "$ROOT_DIR/site/favicon.svg" "$DIST_DIR/favicon.svg"

cp "$ROOT_DIR/docs/images/lockscreen-widget-and-shortcuts.jpg" "$DIST_DIR/images/lockscreen-widget-and-shortcuts.jpg"
cp "$ROOT_DIR/docs/images/widget-background-white.png" "$DIST_DIR/images/widget-background-white.png"
cp "$ROOT_DIR/docs/images/widget-background-dark.png" "$DIST_DIR/images/widget-background-dark.png"

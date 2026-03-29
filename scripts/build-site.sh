#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DIST_DIR="$ROOT_DIR/dist"
PUBLIC_DIR="$ROOT_DIR/public"

rm -rf "$DIST_DIR" "$PUBLIC_DIR"

for OUTPUT_DIR in "$DIST_DIR" "$PUBLIC_DIR"
do
    mkdir -p "$OUTPUT_DIR/images"

    cp "$ROOT_DIR/site/index.html" "$OUTPUT_DIR/index.html"
    cp "$ROOT_DIR/site/styles.css" "$OUTPUT_DIR/styles.css"
    cp "$ROOT_DIR/site/favicon.svg" "$OUTPUT_DIR/favicon.svg"

    cp "$ROOT_DIR/docs/images/lockscreen-widget-and-shortcuts.jpg" "$OUTPUT_DIR/images/lockscreen-widget-and-shortcuts.jpg"
    cp "$ROOT_DIR/docs/images/widget-background-white.png" "$OUTPUT_DIR/images/widget-background-white.png"
    cp "$ROOT_DIR/docs/images/widget-background-dark.png" "$OUTPUT_DIR/images/widget-background-dark.png"
done

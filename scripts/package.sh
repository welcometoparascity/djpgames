#!/usr/bin/env bash
# Builds the production bundle and packages both delivery zips:
#   Jain-Ludo-Hostinger.zip - dist/ contents at the zip root, ready to upload.
#   Jain-Ludo-Source.zip   - full source tree, excluding node_modules/dist/build caches.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Type-check + build"
npm run build

echo "==> Packaging Jain-Ludo-Hostinger.zip"
rm -f Jain-Ludo-Hostinger.zip
(cd dist && zip -r -q ../Jain-Ludo-Hostinger.zip .)

echo "==> Packaging Jain-Ludo-Source.zip"
rm -f Jain-Ludo-Source.zip
zip -r -q Jain-Ludo-Source.zip . \
  -x "node_modules/*" -x "dist/*" -x ".git/*" \
  -x "Jain-Ludo-Hostinger.zip" -x "Jain-Ludo-Source.zip" \
  -x "*.DS_Store"

echo "==> Verifying Hostinger zip root contents"
unzip -l Jain-Ludo-Hostinger.zip | head -20

echo "Done."

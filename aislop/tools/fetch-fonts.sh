#!/usr/bin/env bash
# Download the OFL/Apache fonts used by the film from the google/fonts repository (+ Liberation Serif from the system).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p fonts
while read -r f; do
  [ -z "$f" ] && continue
  n=$(basename "$f")
  [ -s "fonts/$n" ] && continue
  u=$(echo "$f" | sed 's/\[/%5B/g; s/\]/%5D/g; s/,/%2C/g')
  curl -sSL -o "fonts/$n" "https://raw.githubusercontent.com/google/fonts/main/$u" && echo "ok $n"
done < fonts.txt
for s in Regular Bold Italic; do
  src="/usr/share/fonts/truetype/liberation/LiberationSerif-$s.ttf"
  [ -f "$src" ] && cp -n "$src" fonts/ || echo "install fonts-liberation for LiberationSerif-$s.ttf"
done

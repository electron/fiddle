#!/bin/sh
# Renders every svg/*.svg to png/<name>-1024.png with Chromium, keeping transparency.
cd "$(dirname "$0")" && mkdir -p png
for f in svg/*.svg; do
  n=$(basename "$f" .svg)
  printf '<style>html,body{margin:0;background:transparent}</style><img src="%s" width=1024 height=1024 style="display:block">' "$f" > r.html
  "${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}" --headless --no-sandbox --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --default-background-color=00000000 \
    --screenshot="png/$n-1024.png" --window-size=1024,1024 "file://$PWD/r.html" >/dev/null 2>&1
done
rm r.html

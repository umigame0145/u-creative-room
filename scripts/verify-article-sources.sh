#!/usr/bin/env bash
# GET the primary sources used in P0-4; TLS verification stays enabled.
set -eu
for url in \
  https://www.w3.org/TR/png-3/ \
  https://www.w3.org/Graphics/JPEG/itu-t81.pdf \
  https://developers.google.com/speed/webp/docs/compression \
  https://html.spec.whatwg.org/multipage/canvas.html \
  https://www.w3.org/TR/webcodecs/ \
  https://ffmpeg.org/ffprobe.html \
  https://github.com/beurtschipper/Depix \
  https://helpx.adobe.com/acrobat/using/removing-sensitive-content-pdfs.html
do
  curl --fail --silent --show-error --location --max-time 30 --output /dev/null \
    --write-out '%{http_code} %{url_effective}\n' "$url"
done

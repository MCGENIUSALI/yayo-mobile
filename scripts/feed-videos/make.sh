#!/usr/bin/env bash
# Regenerates the demo feed clips (silent 6–7 s loops, 720×1280, H.264) from still images.
# Usage: scripts/feed-videos/make.sh   (needs ffmpeg and python3 + Pillow)
set -euo pipefail
cd "$(dirname "$0")/../.."
tmp=$(mktemp -d)

# Square product renders → portrait canvas with the background gradient extended.
python3 - "$tmp" <<'PY'
import sys
from PIL import Image
out = sys.argv[1]
for n in ['jbl-go-3', 'jbl-tune-510']:
    im = Image.open(f'assets/products/{n}.jpg').convert('RGB')
    W, H = 1000, 1778
    top, bot = im.getpixel((500, 4)), im.getpixel((500, 995))
    c = Image.new('RGB', (W, H))
    for y in range(H):
        t = y / (H - 1)
        c.paste(tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3)), (0, y, W, y + 1))
    mask = Image.new('L', (1000, 1000), 255)
    for y in range(120):
        a = int(255 * y / 120)
        mask.paste(a, (0, y, 1000, y + 1)); mask.paste(a, (0, 999 - y, 1000, 1000 - y))
    c.paste(im, (0, (H - 1000) // 2 - 60), mask)
    c.save(f'{out}/{n}-tall.jpg', quality=92)
PY

zoom="zoompan=z='min(1+on*0.0009,1.13)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
enc="-c:v libx264 -profile:v main -crf 30 -preset slow -movflags +faststart -an"
ffmpeg -y -loglevel error -loop 1 -i assets/feed/pulse.jpg -vf "scale=-2:1440,crop=810:1440,$zoom:d=168:s=720x1280:fps=24,format=yuv420p" -frames:v 168 $enc assets/feed/pulse.mp4
ffmpeg -y -loglevel error -loop 1 -i "$tmp/jbl-go-3-tall.jpg" -vf "scale=810:1440,$zoom:d=144:s=720x1280:fps=24,format=yuv420p" -frames:v 144 $enc assets/feed/go-3.mp4
ffmpeg -y -loglevel error -loop 1 -i "$tmp/jbl-tune-510-tall.jpg" -vf "scale=810:1440,$zoom:d=144:s=720x1280:fps=24,format=yuv420p" -frames:v 144 $enc assets/feed/tune-510.mp4
for f in pulse go-3 tune-510; do
  ffmpeg -y -loglevel error -i "assets/feed/$f.mp4" -vf "select=eq(n\,0)" -frames:v 1 -q:v 4 "assets/feed/$f-poster.jpg"
done
echo "OK: assets/feed/*.mp4"

#!/usr/bin/env bash
set -euo pipefail
# Original local geometry -> native-frame-rate H.264. No network or stock assets.
cd "$(dirname "$0")/.."
output_root="${SCENE_RENDER_DIR:-$PWD/.local-setup/scene-render}"
mkdir -p public/films "$output_root"
strands=(technology health-sciences law-public-policy aviation culinary engineering construction education business digital-media)
if (($#)); then strands=("$@"); fi
for strand in "${strands[@]}"; do
  case "$strand" in
    technology|health-sciences|law-public-policy|aviation|culinary|engineering|construction|education|business|digital-media) ;;
    *) printf 'Unknown IGNITE strand: %s\n' "$strand" >&2; exit 1 ;;
  esac
done
# Every invocation gets a fresh frame directory. A failed/short render cannot
# silently reuse frames from a prior run or replace any published asset.
run_directory="$(mktemp -d "$output_root/run-XXXXXX")"
export SCENE_RENDER_DIR="$run_directory"
export SCENE_RENDER_FPS=24
staging_directory="$run_directory/publish"
mkdir -p "$staging_directory"
printf 'Rendering into %s\n' "$run_directory"
for strand in "${strands[@]}"; do
  printf 'Rendering %s\n' "$strand"
  blender -b -t 2 -P scripts/render-scene-films.py -- "$strand" > "$run_directory/$strand.log" 2>&1
  python3 - "$run_directory/$strand" <<'PY'
import json,sys
from pathlib import Path
root=Path(sys.argv[1])
expected={f'frame-{i:04}.png' for i in range(1,289)}
actual={p.name for p in root.glob('frame-*.png')}
if actual != expected:
    raise SystemExit(f'Incomplete native24fps render: expected288 frames, found{len(actual)}')
if any((root/name).stat().st_size < 1000 for name in expected):
    raise SystemExit('A rendered frame is empty or incomplete')
PY
  ffmpeg -hide_banner -loglevel error -y -framerate 24 -start_number 1 \
    -i "$run_directory/$strand/frame-%04d.png" -frames:v 288 -an \
    -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -movflags +faststart \
    -threads 2 "$staging_directory/$strand.mp4"
  # A settled first-person view is also the static reduced-motion fallback.
  ffmpeg -hide_banner -loglevel error -y -ss 11.5 -i "$staging_directory/$strand.mp4" \
    -frames:v 1 -quality 88 "$staging_directory/$strand.webp"
  python3 - "$staging_directory/$strand.mp4" "$staging_directory/$strand.webp" <<'PY'
import json,subprocess,sys
from pathlib import Path
film,poster=map(Path,sys.argv[1:])
metadata=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(film)]))
streams=metadata['streams']
if len(streams)!=1 or streams[0]['codec_name']!='h264' or streams[0]['codec_type']!='video':
    raise SystemExit('Expected one H.264 video stream and no audio')
s=streams[0]
if (s['width'],s['height'],s['pix_fmt'],s['avg_frame_rate'])!=(960,540,'yuv420p','24/1'):
    raise SystemExit('Unexpected browser media format')
if not 11.95 <= float(metadata['format']['duration']) <= 12.05 or int(s['nb_frames'])!=288:
    raise SystemExit('Incomplete encoded film')
if not 50_000 < film.stat().st_size < 2_000_000 or not 5_000 < poster.stat().st_size < 150_000:
    raise SystemExit('Film/poster outside the asset budget')
data=film.read_bytes()
if data.find(b'moov') > data.find(b'mdat'):
    raise SystemExit('Movie metadata must precede the media payload')
PY
  printf 'Staged %s\n' "$strand"
done
# Only publish after ALL selected strands render and encode successfully. These
# local renames are sequential; the Git/Vercel release publishes the set together.
for strand in "${strands[@]}"; do
  mv -- "$staging_directory/$strand.mp4" "public/films/$strand.mp4"
  mv -- "$staging_directory/$strand.webp" "public/films/$strand.webp"
done
printf 'Published %s validated film(s). Frames retained in %s\n' "${#strands[@]}" "$run_directory"

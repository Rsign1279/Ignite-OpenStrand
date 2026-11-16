#!/usr/bin/env bash
set -euo pipefail
# Local production pipeline; Blender creates original geometry and animation.
# No network requests or external assets are used. Requires Blender 4.3 and ffmpeg.
cd "$(dirname "$0")/.."
output_root="${SCENE_RENDER_DIR:-$PWD/.local-setup/scene-render}"
export SCENE_RENDER_DIR="$output_root"
mkdir -p public/films "$output_root"
strands=(technology education digital-media engineering health-sciences law-public-policy aviation culinary construction business)
if (($#)); then strands=("$@"); fi
for strand in "${strands[@]}"; do
  case "$strand" in
    technology|education|digital-media|engineering|health-sciences|law-public-policy|aviation|culinary|construction|business) ;;
    *) printf 'Unknown IGNITE strand: %s\n' "$strand" >&2; exit 1 ;;
  esac
done
temporary_film=""
temporary_poster=""
cleanup() {
  if [[ -n "$temporary_film" ]]; then rm -f -- "$temporary_film"; fi
  if [[ -n "$temporary_poster" ]]; then rm -f -- "$temporary_poster"; fi
}
trap cleanup EXIT
for strand in "${strands[@]}"; do
  printf 'Rendering %s\n' "$strand"
  blender -b -t 2 -P scripts/render-scene-films.py -- "$strand" > "$output_root/$strand.log" 2>&1
  temporary_film="$(mktemp "public/films/.$strand-XXXXXX.mp4")"
  temporary_poster="$(mktemp "public/films/.$strand-XXXXXX.webp")"
  ffmpeg -hide_banner -loglevel error -y -framerate 6 -pattern_type glob -i "$output_root/$strand/frame-*.png" \
    -vf "hqdn3d=4:3:6:4,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,tpad=stop_mode=clone:stop_duration=0.5" \
    -t 12 -an -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart -threads 2 "$temporary_film"
  ffmpeg -hide_banner -loglevel error -y -ss 5 -i "$temporary_film" -frames:v 1 -quality 88 "$temporary_poster"
  mv -- "$temporary_film" "public/films/$strand.mp4"
  mv -- "$temporary_poster" "public/films/$strand.webp"
  temporary_film=""
  temporary_poster=""
  printf 'Finished %s\n' "$strand"
done

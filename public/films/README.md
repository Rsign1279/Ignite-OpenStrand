# OpenStrand scene films

These silent 12-second MP4s are original, locally rendered animations of an imagined interview setting. They are not footage of an employer or a real interview. The room, furniture, materials, lighting, camera animation, display animation, and moving foliage are authored in `scripts/render-scene-films.py`; no stock footage, external textures, or third-party character assets are used.

Each strand has its own accent lighting, wall title, and desk prop. The camera approaches the open candidate's seat. The films introduce the setting; the adjacent scene text supplies the question-specific story, and students can continue without watching the full film.

The player is silent, plays inline, includes pause and replay controls, and starts as a still poster when reduced motion is requested. Text remains available if playback fails. The videos are served from the same origin as the app.

Rebuild with Blender 4.3 and ffmpeg:

```sh
./scripts/render-scene-films.sh
# Or render selected strands:
./scripts/render-scene-films.sh technology education
```

Output: H.264 MP4, 960 × 540, 24 fps, yuv420p, fast-start metadata, no audio track; one WebP poster per film. Geometry is rendered at 6 fps, denoised, then interpolated to 24 fps for a lightweight, smooth playback asset.

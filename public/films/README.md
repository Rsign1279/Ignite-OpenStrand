# OpenStrand first-person scene films

Ten original, silent 12-second walk-ins introduce fictional student interview settings. The camera is the candidate's viewpoint: start outside a framed doorway, walk into the room at standing eye height, approach the interview table, then settle into a seated view. There is no aerial camera or visible third-person avatar.

Each strand has its own room layout, working environment, furniture and placement situation:

| Strand              | Setting and interview context                             | Visible landmarks                                  |
| ------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| Technology          | Product lab; student prototype internship                 | Interface wall, server rack, sketch board          |
| Health Sciences     | Simulation briefing; supervised student placement         | Empty training bed, divider, simulation kit        |
| Law / Public Policy | Civic research; community-project internship              | Neighborhood map, research library, proposal folio |
| Aviation            | Flight-training briefing; supervised learning opportunity | Training aircraft, apron window, flight plan       |
| Culinary Arts       | Teaching kitchen; supervised kitchen placement            | Cooking range, copper pans, preparation island     |
| Engineering         | Prototype workshop; student design internship             | Roof trusses, design sketches, pegboard tools      |
| Construction        | Site-planning office; supervised planning placement       | Blueprints, site model, separated training frame   |
| Education           | School learning commons; learner-support placement        | Learner artwork, books, daylight windows           |
| Global Business     | Venture suite; student client-team internship             | Pitch display, oak screen, oval meeting table      |
| Digital Media       | Production suite; student media placement                 | Storyboard, edit monitors, acoustic panels         |

These are original procedural animations, not footage of employers or actual interviews. Students do not need professional credentials or the pictured experience. Adjacent text provides the question-specific setup; it never supplies a fabricated personal answer. Questions, evaluation and student data are independent of the films.

The player preserves the full 16:9 view at every screen size. It supports inline playback, pause/replay, native controls and continuing immediately. Reduced-motion users see a settled-room poster until they choose Play. Written scene text remains available during failed or stalled playback. The videos contain no audio or speech and are served from the app's own origin.

## Rebuild

Requires Blender 4.3, Python 3, ffmpeg and ffprobe. No network downloads, stock footage, textures, models or character assets are used.

```sh
./scripts/render-scene-films.sh
# Selected strands:
./scripts/render-scene-films.sh technology education
```

The shared geometry, doorway and human-scale camera path are authored in `scripts/scene_geometry.py` and `scripts/render-scene-films.py`. Strand layouts live in `scripts/scene_rooms_care.py` and `scripts/scene_rooms_create.py`. Lighting uses EEVEE, four temporal samples, shadow-free area fills and a fixed daylight shadow key to avoid stochastic shadow grain.

Every run receives a new directory under the ignored `.local-setup/scene-render` cache; `SCENE_RENDER_DIR` can select a different root. Each room emits `render-manifest.json` with the recipe, all camera samples, doorway geometry and object bounds. Previews and partial frame ranges are available directly through the Python renderer's command-line options.

The production shell requires all 288 frames, encodes and checks every selected film/poster, then replaces the selected local assets. A failed render or encode preserves the previously published files. Local file renames are sequential; Git and the deployment publish the reviewed asset set together.

Delivery: native 24 fps, 288 rendered frames, 960 × 540 H.264 MP4, yuv420p, fast-start metadata, no audio and no frame interpolation. Each film stays below 2 MB, with a WebP poster below 150 KB taken from the settled view.

## Verify

```sh
# Adds Pillow to the render-tool prerequisites; no app dependency is needed.
python3 scripts/verify-scene-films.py --output-dir .local-setup/scene-verification
# Inspect a render's camera/room manifests as well:
python3 scripts/verify-scene-films.py --manifest-dir PATH_TO_RUN --output-dir .local-setup/scene-verification
```

The verifier decodes real frames, checks format, duration, motion and visible variation, and produces a labelled contact sheet for visual review. Manifest checks supplement the images; they cannot prove that encoded footage is attractive, realistic or educationally effective. Browser tests cover all ten films at 320 px, real frame decoding, pause/seek/end/replay and access to the exact canonical question. Existing tests cover reduced motion, media failure, stalls and session cleanup.

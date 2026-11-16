"""Render original first-person OpenStrand walk-in films with Blender 4.3.

blender -b -t 2 -P scripts/render-scene-films.py -- technology
blender -b -t 2 -P scripts/render-scene-films.py -- aviation --preview --frame 84
blender -b -P scripts/render-scene-films.py -- education --manifest-only

All geometry, room designs, materials and motion are original. No network,
stock imagery, external models or third-party character assets are used.
"""
import argparse
import importlib
import json
import math
import os
from pathlib import Path
import sys
import bpy
from mathutils import Vector

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from scene_geometry import SceneGeometry, linear_rgb

ROOMS = {
    "technology": ("PRODUCT STUDIO", "#a8c4c8", "scene_rooms_care"),
    "health-sciences": ("SIMULATION LEARNING SUITE", "#aac7b7", "scene_rooms_care"),
    "law-public-policy": ("CIVIC RESEARCH ROOM", "#c1b4cc", "scene_rooms_care"),
    "aviation": ("FLIGHT TRAINING BRIEFING", "#9dbcc9", "scene_rooms_care"),
    "culinary": ("TEACHING KITCHEN", "#d2af8e", "scene_rooms_care"),
    "engineering": ("DESIGN REVIEW WORKSHOP", "#b5c1a1", "scene_rooms_create"),
    "construction": ("SITE PLANNING OFFICE", "#cbb68b", "scene_rooms_create"),
    "education": ("SCHOOL LEARNING COMMONS", "#d1bd90", "scene_rooms_create"),
    "business": ("VENTURE MEETING SUITE", "#adbcc9", "scene_rooms_create"),
    "digital-media": ("PRODUCTION EDIT SUITE", "#bea8bc", "scene_rooms_create"),
}


def smoothstep(value):
    value = max(0., min(1., value))
    return value * value * (3 - 2 * value)


def interpolate(a, b, factor):
    return tuple(start + (end - start) * factor for start, end in zip(a, b))


def camera_pose(time):
    """Metre-scale doorway entry, unobstructed walk and restrained seated rest."""
    if time <= 3.6:
        position = interpolate((-3.4, -7.1, 1.65), (-3.4, -4.1, 1.65), smoothstep(time / 3.6))
    elif time < 9.7:
        position = interpolate((-3.4, -4.1, 1.65), (0., .05, 1.65), smoothstep((time - 3.6) / 6.1))
    else:
        position = (0., .05, 1.65)
    gait = math.sin(time * math.tau * 1.4) * .006
    envelope = smoothstep(time / .65) * (1 - smoothstep((time - 8.7) / 1.0))
    if time < 9.7:
        position = (position[0], position[1], position[2] + gait * envelope)
    settle = smoothstep((time - 10) / 1.25)
    position = (position[0], position[1], position[2] - .43 * settle)
    look = smoothstep((time - 2.5) / 5.4)
    target = interpolate((-3.4, -1.0, 1.61), (0., 2.8, 1.30), look)
    return position, target


def door_angle(time):
    return math.radians(24 + 77 * smoothstep(time / 2.4))


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("strand", choices=ROOMS, nargs="?", default="technology")
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--frame", type=int)
    parser.add_argument("--frame-start", type=int)
    parser.add_argument("--frame-end", type=int)
    parser.add_argument("--manifest-only", action="store_true")
    options = parser.parse_args(args)
    fps = int(os.environ.get("SCENE_RENDER_FPS", "24"))
    if fps not in (6, 12, 24):
        raise ValueError("SCENE_RENDER_FPS must be 6, 12, or 24")
    frame_count = 12 * fps
    label, accent_hex, module = ROOMS[options.strand]
    output_root = Path(os.environ.get("SCENE_RENDER_DIR", str(SCRIPT_DIR.parent / ".local-setup" / "scene-render")))
    output = output_root / options.strand
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material)
    scene = bpy.context.scene
    api = SceneGeometry(scene, accent_hex, fps)
    m = api.materials

    # A full architectural entry, not a cut or an aerial camera dolly.
    api.cube("Room foundation", (0, .25, -.105), (11, 9.5, .20), m["floor"])
    api.cube("Corridor foundation", (-3.4, -6, -.105), (5.2, 4, .20), m["floor"])
    api.cube("Back shell", (0, 5.12, 1.7), (11.3, .24, 3.4), m["wall"])
    api.cube("Left shell", (-5.62, .25, 1.7), (.24, 9.5, 3.4), m["wall"])
    api.cube("Right shell", (5.62, .25, 1.7), (.24, 9.5, 3.4), m["wall"])
    # The rough opening sits behind the timber jambs. Sharing the exact inside
    # face would z-fight as the candidate approaches the doorway.
    api.cube("Entrance left reveal", (-5.0, -4.5, 1.7), (1.24, .22, 3.4), m["wall"])
    api.cube("Entrance right reveal", (1.6, -4.5, 1.7), (8.04, .22, 3.4), m["wall"])
    api.cube("Entrance lintel", (-3.4, -4.5, 2.95), (1.96, .22, .9), m["wall"])
    for x in (-4.34, -2.46):
        api.cube("Door jamb", (x, -4.5, 1.235), (.08, .30, 2.47), m["wood"], .012)
    api.cube("Door header", (-3.4, -4.5, 2.49), (1.96, .30, .10), m["wood"], .012)
    api.cube("Door threshold", (-3.4, -4.5, .006), (1.8, .28, .012), m["gold"])
    door = bpy.data.objects.new("Entry door hinge", None)
    bpy.context.collection.objects.link(door)
    door.location = (-4.3, -4.47, 0)
    leaf = api.cube("Opening entrance door", (.88, 0, 1.21), (1.76, .065, 2.42), m["wood"], .02)
    leaf.parent = door
    panel = api.cube("Door inset panel", (.88, -.04, 1.24), (1.57, .015, 2.13), m["cream"], .02)
    panel.parent = door
    handle = api.line("Door pull", (1.60, -.095, 1.02), (1.60, -.095, 1.22), .017, m["gold"])
    handle.parent = door
    api.cube("Corridor identity plaque", (-1.72, -4.635, 1.61), (1.08, .035, .42), m["ink"], .018)
    api.text("Door studio mark", "IGNITE", (-1.72, -4.662, 1.67), .12, m["cream"])
    api.text("Door strand mark", label, (-1.72, -4.663, 1.53), .037, m["cream"])

    room_data = importlib.import_module(module).build_room(api, options.strand) or {}
    room_data["module"] = module
    api.area("Room soft key", (-2.4, -.8, 3.5), 900, "#fff0da", 4.5, (0, 1.6, .7))
    api.area("Window fill", (3.8, 2.8, 3.2), 600, "#e0e9e7", 3.7, (0, 1, 1))
    api.area("Corridor entry light", (-3.4, -5.4, 2.8), 190, "#fff0da", 2.0, (-3.4, -3.5, .8))
    # Broad area lights retain warm physical material shading. A narrow-angle
    # daylight key casts clean shadows instead of noisy low-sample area-light
    # penumbras, so every native frame stays clear without spatial blurring.
    for light in bpy.data.lights:
        light.use_shadow = False
    sun_data = bpy.data.lights.new("Architectural daylight key", "SUN")
    sun_data.energy, sun_data.angle, sun_data.use_shadow = .65, .012, True
    sun = bpy.data.objects.new("Architectural daylight key", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.location = (-3, -4, 7)
    sun.rotation_euler = (Vector((0, 1, 0)) - sun.location).to_track_quat("-Z", "Y").to_euler()
    world = scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (*linear_rgb("#bdc5bd"), 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = .35
    bpy.ops.object.camera_add(location=(-3.4, -7.1, 1.65))
    camera = bpy.context.object
    camera.name = "Candidate first person viewpoint"
    scene.camera = camera
    camera.data.lens, camera.data.sensor_width = 28, 36
    camera.data.clip_start, camera.data.clip_end = .04, 100
    camera.data.dof.use_dof = False
    samples = []
    for frame in range(1, frame_count + 1):
        time = (frame - 1) / fps
        position, target = camera_pose(time)
        camera.location = position
        rotation = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
        camera.rotation_euler, door.rotation_euler.z = rotation, door_angle(time)
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)
        door.keyframe_insert(data_path="rotation_euler", frame=frame)
        samples.append({"frame": frame, "time_seconds": round(time, 5),
                        "position": [round(value, 6) for value in position],
                        "target": [round(value, 6) for value in target],
                        "rotation_euler": [round(value, 6) for value in rotation],
                        "door_angle_degrees": round(math.degrees(door_angle(time)), 5)})
    for obj in (camera, door):
        for curve in obj.animation_data.action.fcurves:
            for point in curve.keyframe_points:
                point.interpolation = "LINEAR"
    scene.frame_set(1)
    bpy.context.view_layer.update()
    objects = []
    for obj in scene.objects:
        if obj.type in ("MESH", "FONT"):
            bounds_min, bounds_max = api.bounds(obj)
            objects.append({"name": obj.name, "type": obj.type,
                            "bounds_min": bounds_min, "bounds_max": bounds_max,
                            "collidable": bool(obj.get("scene_collidable", False)),
                            "door_part": obj.parent == door})
    manifest = {"version": 2, "strand": options.strand, "room": room_data,
                "duration_seconds": 12, "source_fps": fps, "frame_count": frame_count, "frame_step": 1,
                "fps": fps, "frameCount": frame_count, "durationSeconds": 12, "resolution": [960, 540],
                "doorway": {"plane_y": -4.5, "center_x": -3.4, "clear_width": 1.8, "height": 2.45,
                            "hinge": [-4.3, -4.47, 0], "leaf_width": 1.76, "leaf_thickness": .065},
                "camera": {"lens_mm": 28, "sensor_width_mm": 36, "standing_eye_m": 1.65,
                           "seated_eye_m": 1.22, "settle_start_seconds": 10,
                           "hold_start_seconds": 11.25, "body_clearance_m": .25},
                "render_recipe": {"engine": "BLENDER_EEVEE_NEXT", "taa_samples": int(os.environ.get("SCENE_RENDER_SAMPLES", "4")),
                                  "shadow_mode": "directional-key-with-area-fill", "shadow_ray_count": 1,
                                  "daylight_energy": .65, "daylight_angle_radians": .012,
                                  "interpolated_frames": False},
                "samples": samples, "objects": objects}
    (output / "render-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    if options.manifest_only:
        print(f"Wrote first-person scene manifest: {output}")
        return
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples = int(os.environ.get("SCENE_RENDER_SAMPLES", "4"))
    scene.eevee.shadow_ray_count = 1
    scene.render.threads_mode = "FIXED"
    scene.render.threads = int(os.environ.get("SCENE_RENDER_THREADS", "2"))
    scene.render.resolution_x, scene.render.resolution_y = 960, 540
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.fps = fps
    scene.frame_start = options.frame_start or int(os.environ.get("SCENE_FRAME_START", "1"))
    scene.frame_end = options.frame_end or int(os.environ.get("SCENE_FRAME_END", str(frame_count)))
    if not (1 <= scene.frame_start <= scene.frame_end <= frame_count):
        raise ValueError("Render frame range is outside the 12-second film")
    scene.frame_step = 1
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = .25
    scene.render.film_transparent = False
    scene.render.filepath = str(output / "frame-")
    if options.preview:
        preview_frame = options.frame or round(7.2 * fps) + 1
        if not 1 <= preview_frame <= frame_count:
            raise ValueError("Preview frame is outside the film")
        scene.frame_set(preview_frame)
        scene.render.filepath = str(output / f"preview-{preview_frame:04d}.png")
        bpy.ops.render.render(write_still=True)
    else:
        bpy.ops.render.render(animation=True)


if __name__ == "__main__":
    main()

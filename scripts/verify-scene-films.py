#!/usr/bin/env python3
"""Check rendered films and create a contact sheet for human visual review.

Requires ffprobe, ffmpeg and Pillow. This complements the dependency-free asset
unit test and browser playback checks; it cannot establish visual realism or
educational efficacy. Render manifests support camera-path inspection but are
not evidence that the encoded pixels match the authored scene.
"""
import argparse
import json
import math
import subprocess
from itertools import combinations
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat


STRANDS = (
    "technology", "health-sciences", "law-public-policy", "aviation", "culinary",
    "engineering", "construction", "education", "business", "digital-media",
)
TIMES = (.25, 3.5, 6, 9, 11.75)
WIDTH, HEIGHT, DELIVERY_FPS, MOTION_FPS = 320, 180, 24, 4


def run(args, **kwargs):
    result = subprocess.run(args, check=True, capture_output=True, **kwargs)
    return result.stdout


def difference(first, second):
    return sum(ImageStat.Stat(ImageChops.difference(first, second)).mean) / 3


def distance(first, second):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(first, second)))


def direction(sample):
    values = [a - b for a, b in zip(sample["target"], sample["position"])]
    length = math.sqrt(sum(value * value for value in values))
    assert length > .1, "Camera target must be away from its position"
    intended = [value / length for value in values]
    x, y, z = sample["rotation_euler"]
    # Camera looks along local -Z. Independently derive the actual gaze from
    # its authored XYZ Euler rotation instead of trusting the intended target.
    actual = [
        -math.cos(x) * math.sin(y) * math.cos(z) - math.sin(x) * math.sin(z),
        -math.cos(x) * math.sin(y) * math.sin(z) + math.sin(x) * math.cos(z),
        -math.cos(x) * math.cos(y),
    ]
    assert sum(a * b for a, b in zip(intended, actual)) > math.cos(math.radians(.1)), "Camera rotation does not face its declared target"
    return actual


def verify_manifest(path, strand):
    data = json.loads(path.read_text())
    assert data["strand"] == strand, "Manifest strand does not match film"
    samples = data["samples"]
    assert len(samples) >= 72, "Camera manifest lacks a complete sampled path"
    doorway, camera, room = data["doorway"], data["camera"], data["room"]
    assert room["room_title"] and room["scenario"] and len(room["visual_anchors"]) >= 3
    plane = doorway["plane_y"]
    center = doorway["center_x"]
    clearance = camera["body_clearance_m"]
    assert samples[0]["position"][1] < plane - .8, "Walk must start outside the doorway"
    assert samples[-1]["position"][1] > plane + 2, "Walk never arrives inside the room"
    crossed = []
    max_speed, max_turn, max_turn_rate, max_roll = 0.0, 0.0, 0.0, 0.0
    static_solids = [item for item in data["objects"] if item.get("collidable") and not item.get("door_part")]
    nearest_static_surface = float("inf")
    for index, sample in enumerate(samples):
        assert all(math.isfinite(number) for key in ("position", "target", "rotation_euler") for number in sample[key])
        roll = abs(sample["rotation_euler"][1])
        max_roll = max(roll, max_roll)
        assert roll <= .01, "First-person camera has unintended roll"
        for item in static_solids:
            # Conservative eye clearance only: an AABB is not an exact mesh,
            # and the moving door is checked separately at the threshold.
            separation = math.sqrt(sum(max(low - value, 0, value - high) ** 2 for value, low, high in zip(sample["position"], item["bounds_min"], item["bounds_max"])))
            nearest_static_surface = min(nearest_static_surface, separation)
            assert separation >= .08, f"Camera eye intersects static bounds: {item['name']} at {sample['time_seconds']}s"
        elapsed = sample["time_seconds"]
        if elapsed < camera["settle_start_seconds"] - .1:
            assert 1.45 <= sample["position"][2] <= 1.8, "Walking camera is not at standing eye height"
        if not index:
            continue
        previous = samples[index - 1]
        interval = elapsed - previous["time_seconds"]
        assert interval > 0, "Camera time must increase"
        speed = distance(sample["position"], previous["position"]) / interval
        max_speed = max(speed, max_speed)
        assert speed < 1.6, "Camera jumps or walks too quickly"
        first, second = direction(previous), direction(sample)
        turn = math.degrees(math.acos(max(-1, min(1, sum(a * b for a, b in zip(first, second))))))
        max_turn = max(turn, max_turn)
        turn_rate = turn / interval
        max_turn_rate = max(turn_rate, max_turn_rate)
        assert turn_rate <= 30, "Camera gaze exceeds 30 degrees per second"
        assert sample["position"][1] >= previous["position"][1] - .02, "Camera unexpectedly reverses out of the room"
        if previous["position"][1] < plane <= sample["position"][1]:
            fraction = (plane - previous["position"][1]) / (sample["position"][1] - previous["position"][1])
            x = previous["position"][0] + fraction * (sample["position"][0] - previous["position"][0])
            assert abs(x - center) + clearance < doorway["clear_width"] / 2, "Camera clips doorway clearance"
            assert sample["door_angle_degrees"] >= 75, "Door is not open when the candidate crosses"
            crossed.append({"seconds": elapsed, "x": x, "doorAngle": sample["door_angle_degrees"]})
    assert len(crossed) == 1, "Candidate must cross the doorway exactly once"
    assert 1.1 <= samples[-1]["position"][2] <= 1.35, "Camera does not settle at seated eye height"
    held = [sample for sample in samples if sample["time_seconds"] >= camera["hold_start_seconds"]]
    assert len(held) >= 5, "Final shot has no calm hold"
    assert max(distance(sample["position"], held[-1]["position"]) for sample in held) < .01, "Camera drifts after settling"
    return {"file": str(path), "room": room, "doorCrossing": crossed[0], "maxSpeedMetersPerSecond": max_speed, "maxGazeTurnDegreesPerFrame": max_turn, "maxGazeDegreesPerSecond": max_turn_rate, "maxRollDegrees": math.degrees(max_roll), "samples": len(samples), "staticSolidsChecked": len(static_solids), "nearestStaticBoundsMeters": nearest_static_surface}


def verify_film(media, output, strand):
    source = media / (strand + ".mp4")
    metadata = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(source)]))
    streams = metadata["streams"]
    assert len(streams) == 1 and streams[0]["codec_type"] == "video", "Film must contain exactly one silent video track"
    video = streams[0]
    assert video["codec_name"] == "h264" and video["pix_fmt"] == "yuv420p", "Unsupported browser codec or pixel format"
    assert (video["width"], video["height"]) == (960, 540), "Unexpected video dimensions"
    assert int(video.get("nb_frames", 0)) == 288, "Film must contain all 288 delivery frames"
    numerator, denominator = map(int, video["avg_frame_rate"].split("/"))
    assert denominator > 0, "Video has no valid frame rate"
    assert abs(numerator / denominator - 24) < .01, "Film must play at 24fps"
    duration = float(metadata["format"]["duration"])
    assert 11.9 <= duration <= 12.1, "Film is not a complete 12-second walk-in"
    assert 50_000 < source.stat().st_size < 2_000_000, "Film exceeds the existing delivery budget"
    blob = source.read_bytes()
    assert 0 < blob.find(b"moov") < blob.find(b"mdat"), "Movie metadata must precede payload for immediate playback"
    raw = run(["ffmpeg", "-v", "error", "-xerror", "-threads", "2", "-i", str(source), "-vf", f"scale={WIDTH}:{HEIGHT}", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"])
    frame_size = WIDTH * HEIGHT * 3
    assert len(raw) % frame_size == 0, "Decoded frame data is truncated"
    frames = [Image.frombytes("RGB", (WIDTH, HEIGHT), raw[offset:offset + frame_size]) for offset in range(0, len(raw), frame_size)]
    assert len(frames) == 288, "Film does not decode every delivery frame"
    for index, frame in enumerate(frames):
        stat = ImageStat.Stat(frame)
        mean = sum(stat.mean) / 3
        spread = sum(stat.stddev) / 3
        assert 5 < mean < 245 and spread > 6, f"Blank or unreadable decoded frame at {index / DELIVERY_FPS}s"
    motion_samples = frames[::DELIVERY_FPS // MOTION_FPS]
    changes = [difference(first, second) for first, second in zip(motion_samples, motion_samples[1:])]
    assert sum(change > .35 for change in changes) >= 12, "Film has too little actual decoded motion"
    assert max(changes) > 2, "Film appears frozen"
    selected = []
    for seconds in TIMES:
        frame = frames[min(round(seconds * DELIVERY_FPS), len(frames) - 1)]
        frame.save(output / f"{strand}-{seconds:05.2f}.png")
        selected.append(frame)
    assert difference(selected[0], selected[-1]) > 6, "Beginning and seated viewpoint are visually unchanged"
    poster = Image.open(media / (strand + ".webp"))
    assert poster.size == (960, 540), "Poster does not match the video frame"
    return {"strand": strand, "bytes": source.stat().st_size, "durationSeconds": duration, "framesDecoded": len(frames), "motionSamplesAt4fps": len(motion_samples), "movingIntervals": sum(change > .35 for change in changes), "maxDecodedFrameChange": max(changes), "video": {key: video[key] for key in ("codec_name", "pix_fmt", "width", "height", "avg_frame_rate")}}, selected


def contact_sheet(output, rows):
    sheet = Image.new("RGB", (len(TIMES) * WIDTH, len(rows) * (HEIGHT + 28) + 48), "#ffffeb")
    draw = ImageDraw.Draw(sheet)
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    font = ImageFont.truetype(font_path, 13) if Path(font_path).exists() else ImageFont.load_default()
    draw.text((10, 10), "FIRST-PERSON WALK-IN REVIEW / entry, threshold, approach, interview station, seated view", fill="#1a1a1a", font=font)
    for row, (strand, frames) in enumerate(rows):
        top = 48 + row * (HEIGHT + 28)
        for column, (seconds, image) in enumerate(zip(TIMES, frames)):
            x = column * WIDTH
            sheet.paste(image, (x, top))
            draw.text((x + 8, top + HEIGHT + 5), f"{strand} / {seconds:g}s", fill="#1a1a1a", font=font)
    sheet.save(output / "contact-sheet.jpg", quality=93)


def main():
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("strands", nargs="*", metavar="STRAND")
    parser.add_argument("--media-dir", type=Path, default=root / "public" / "films")
    parser.add_argument("--manifest-dir", type=Path, help="Render cache containing <strand>/render-manifest.json (optional)")
    parser.add_argument("--output-dir", type=Path, default=root / ".local-setup" / "scene-verification")
    args = parser.parse_args()
    strands = args.strands or STRANDS
    if any(strand not in STRANDS for strand in strands) or len(set(strands)) != len(strands):
        parser.error("Choose each strand at most once from: " + ", ".join(STRANDS))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    report = {"result": "pending", "limits": "Decoded media and authored camera checks supplement human visual review; they do not establish realism, accessibility on every device, or student learning.", "mediaDirectory": str(args.media_dir), "manifestChecked": bool(args.manifest_dir), "films": [], "pairs": [], "failures": []}
    images = []
    for strand in strands:
        try:
            film, frames = verify_film(args.media_dir, args.output_dir, strand)
            if args.manifest_dir:
                film["camera"] = verify_manifest(args.manifest_dir / strand / "render-manifest.json", strand)
            report["films"].append(film)
            images.append((strand, frames))
        except (AssertionError, KeyError, ValueError, OSError, subprocess.CalledProcessError) as error:
            detail = str(error)
            if isinstance(error, subprocess.CalledProcessError) and error.stderr:
                detail += ": " + error.stderr.decode("utf-8", errors="replace")[-2000:]
            report["failures"].append({"strand": strand, "error": detail})
    if args.manifest_dir:
        for key in ("room_title", "scenario"):
            values = [film["camera"]["room"][key] for film in report["films"]]
            if len(set(values)) != len(values):
                report["failures"].append({"error": f"Strand {key} values are not distinct"})
    for (first, first_images), (second, second_images) in combinations(images, 2):
        error = sum(difference(a, b) for a, b in zip(first_images[2:], second_images[2:])) / 3
        report["pairs"].append({"first": first, "second": second, "meanDecodedRoomDifference": error})
        if error < 2:
            report["failures"].append({"strands": [first, second], "error": "Decoded room images are visually near-identical"})
    if images:
        contact_sheet(args.output_dir, images)
    report["result"] = "failed" if report["failures"] else "passed"
    (args.output_dir / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"result": report["result"], "films": len(report["films"]), "manifestChecked": report["manifestChecked"], "outputDirectory": str(args.output_dir), "failures": report["failures"]}))
    raise SystemExit(1 if report["failures"] else 0)


if __name__ == "__main__":
    main()

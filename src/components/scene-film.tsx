"use client";

import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Pause, Film } from "lucide-react";
import type { StrandId } from "@/config/strands";
import { interviewSettings } from "@/config/interview-scenes";

function waitForMetadata(player: HTMLVideoElement, signal: AbortSignal) {
  if (signal.aborted)
    return Promise.reject(new DOMException("Canceled", "AbortError"));
  if (player.readyState >= HTMLMediaElement.HAVE_METADATA)
    return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      player.removeEventListener("loadedmetadata", ready);
      player.removeEventListener("error", failed);
      signal.removeEventListener("abort", canceled);
      if (error) reject(error);
      else resolve();
    };
    const ready = () => finish();
    const failed = () => finish(new Error("Scene metadata could not load."));
    const canceled = () => finish(new DOMException("Canceled", "AbortError"));
    const timeout = window.setTimeout(
      () => finish(new Error("Scene loading timed out.")),
      15000,
    );
    player.addEventListener("loadedmetadata", ready, { once: true });
    player.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", canceled, { once: true });
    // WebKit can suspend a newly inserted media element before selecting its
    // source. Explicit loading, then metadata readiness, precedes every play.
    player.load();
  });
}

/**
 * Locally authored, silent scene films. Narrative content stays in the adjacent
 * scene text so the video is an optional, accessible way to enter the setting.
 */
export function SceneFilm({
  strand,
  className = "",
}: {
  strand: StrandId;
  className?: string;
}) {
  return <SceneFilmPlayer key={strand} strand={strand} className={className} />;
}

function SceneFilmPlayer({
  strand,
  className,
}: {
  strand: StrandId;
  className: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const playRequest = useRef(0);
  const preparation = useRef<AbortController | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const scene = interviewSettings[strand];

  useEffect(() => {
    const player = video.current;
    if (!player) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active = true;
    let autoplayFrame = 0;
    function respectMotion(event: MediaQueryListEvent) {
      if (event.matches) {
        preparation.current?.abort();
        player?.pause();
        setLoading(false);
        setPlaying(false);
      }
    }
    // The first render is a still poster. Motion starts only after checking the
    // device preference, and autoplay rejection leaves a working play button.
    if (!preference.matches) {
      // A frame lets React's development cleanup cancel the first attempt.
      autoplayFrame = window.requestAnimationFrame(() => {
        if (!active || document.hidden || preference.matches) return;
        const controller = new AbortController();
        preparation.current = controller;
        setLoading(true);
        void waitForMetadata(player, controller.signal)
          .then(() => {
            if (
              active &&
              !controller.signal.aborted &&
              !document.hidden &&
              !preference.matches
            )
              return player.play();
          })
          .catch((error) => {
            if (active && !controller.signal.aborted) {
              setPlaying(false);
              setLoading(false);
              if (!(
                error instanceof DOMException &&
                error.name === "NotAllowedError"
              ))
                setFailed(true);
            }
          });
      });
    }
    preference.addEventListener("change", respectMotion);
    function visibility() {
      if (document.hidden) {
        preparation.current?.abort();
        player?.pause();
        setLoading(false);
      }
    }
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      preparation.current?.abort();
      window.cancelAnimationFrame(autoplayFrame);
      player.pause();
      preference.removeEventListener("change", respectMotion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [strand]);

  useEffect(() => {
    if (!loading) return;
    const timeout = window.setTimeout(() => {
      preparation.current?.abort();
      video.current?.pause();
      setLoading(false);
      setPlaying(false);
      setFailed(true);
    }, 15000);
    return () => window.clearTimeout(timeout);
  }, [loading]);

  async function toggle() {
    const player = video.current;
    if (!player) return;
    const request = ++playRequest.current;
    preparation.current?.abort();
    if (playing || loading) {
      player.pause();
      setLoading(false);
      return;
    }
    if (ended) {
      player.currentTime = 0;
      setSeconds(0);
    }
    try {
      const controller = new AbortController();
      preparation.current = controller;
      setLoading(true);
      if (failed) {
        setFailed(false);
        player.load();
        setSeconds(0);
      }
      await waitForMetadata(player, controller.signal);
      if (
        request !== playRequest.current ||
        !player.isConnected ||
        controller.signal.aborted
      )
        return;
      await player.play();
    } catch (error) {
      if (request !== playRequest.current || !player.isConnected) return;
      // Pausing a pending play request is a deliberate user action, not a
      // failed film. Native controls and the external pause button both do it.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setFailed(true);
      }
      setLoading(false);
    }
  }

  const chapter =
    seconds < 3.5
      ? { number: 1, title: "Step inside" }
      : seconds < 10
        ? { number: 2, title: "Walk to your seat" }
        : { number: 3, title: "Settle in" };
  return (
    <figure className={`scene-film ${className}`}>
      <div className="scene-film-frame">
        <video
          ref={video}
          className="scene-film-video"
          src={`/films/${strand}.mp4`}
          muted
          playsInline
          controls={started}
          preload="metadata"
          poster={`/films/${strand}.webp`}
          aria-label={`Silent first-person walk-in: ${scene.place}. You enter through a doorway, walk to the interview table, and settle into your seat.`}
          onPlay={() => setLoading(true)}
          onPlaying={() => {
            setPlaying(true);
            setLoading(false);
            setStarted(true);
            setEnded(false);
            setFailed(false);
          }}
          onWaiting={(event) => {
            if (!event.currentTarget.paused) {
              setLoading(true);
              setPlaying(false);
            }
          }}
          onPause={() => {
            setPlaying(false);
            setLoading(false);
          }}
          onEnded={() => {
            setPlaying(false);
            setLoading(false);
            setEnded(true);
          }}
          onTimeUpdate={(event) => {
            const player = event.currentTarget;
            // WebKit can report waiting after playback has resumed without a
            // second playing event. Advancing media time with a decoded frame
            // is the reliable signal that the room is actually moving again.
            if (
              !player.paused &&
              !player.seeking &&
              player.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
              player.currentTime > seconds
            ) {
              setLoading(false);
              setPlaying(true);
              setStarted(true);
              setEnded(false);
              setFailed(false);
            }
            setSeconds(player.currentTime);
          }}
          onError={() => {
            setFailed(true);
            setPlaying(false);
            setLoading(false);
          }}
        >
          Video unavailable. Read the scene beside it.
        </video>
        <div className="scene-film-topline" aria-hidden="true">
          <span>
            <Film size={14} /> IGNITE ORIGINAL SCENE
          </span>
          <span>12 SEC / SILENT</span>
        </div>
        {!started && !failed && !loading && (
          <button
            type="button"
            className="scene-film-start"
            onClick={toggle}
            aria-label={`Play the scene: ${scene.place}`}
          >
            <Play size={25} fill="currentColor" />
          </button>
        )}
        {started && (
          <div className="scene-film-caption" aria-hidden="true">
            <span>{String(chapter.number).padStart(2, "0")}</span>
            <div>
              <small>{chapter.title}</small>
              <strong>{scene.place}</strong>
            </div>
          </div>
        )}
      </div>
      <figcaption className="scene-film-controls">
        <span role="status">
          {failed
            ? "Scene unavailable. Your written scene is ready."
            : loading
              ? "Loading scene. You can continue."
              : ended
                ? "Scene complete. Continue when ready."
                : "Play the scene or continue."}
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label={
            failed
              ? "Retry scene film"
              : playing || loading
                ? "Pause scene film"
                : ended
                  ? "Replay scene film"
                  : "Play scene film"
          }
        >
          {playing || loading ? (
            <Pause size={15} />
          ) : ended || failed ? (
            <RotateCcw size={15} />
          ) : (
            <Play size={15} />
          )}
          {failed
            ? "Retry"
            : playing || loading
              ? "Pause"
              : ended
                ? "Replay"
                : "Play"}
        </button>
      </figcaption>
    </figure>
  );
}

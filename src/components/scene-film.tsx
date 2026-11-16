"use client";

import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Pause, Film } from "lucide-react";
import type { StrandId } from "@/config/strands";
import { interviewSettings } from "@/config/interview-scenes";

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
      if (event.matches) player?.pause();
    }
    // The first render is a still poster. Motion starts only after checking the
    // device preference, and autoplay rejection leaves a working play button.
    if (!preference.matches) {
      // WebKit must finish selecting a newly attached <source> before play.
      // A frame also lets React's development cleanup cancel the first attempt.
      autoplayFrame = window.requestAnimationFrame(() => {
        if (!active || document.hidden || preference.matches) return;
        setLoading(true);
        void player.play().catch(() => {
          if (active) {
            setPlaying(false);
            setLoading(false);
          }
        });
      });
    }
    preference.addEventListener("change", respectMotion);
    function visibility() {
      if (document.hidden) player?.pause();
    }
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      window.cancelAnimationFrame(autoplayFrame);
      player.pause();
      preference.removeEventListener("change", respectMotion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [strand]);

  useEffect(() => {
    if (!loading) return;
    const timeout = window.setTimeout(() => {
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
    if (playing || loading) {
      player.pause();
      setLoading(false);
      return;
    }
    if (ended) player.currentTime = 0;
    try {
      setLoading(true);
      if (failed) {
        setFailed(false);
        player.load();
        await new Promise<void>((resolve) =>
          window.requestAnimationFrame(() => resolve()),
        );
      }
      if (request !== playRequest.current || !player.isConnected) return;
      await player.play();
    } catch (error) {
      // Pausing a pending play request is a deliberate user action, not a
      // failed film. Native controls and the external pause button both do it.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setFailed(true);
      }
      setLoading(false);
    }
  }

  const chapter =
    seconds < 4 ? "Arrive" : seconds < 8 ? "Take your seat" : "Find your focus";
  return (
    <figure className={`scene-film ${className}`}>
      <div className="scene-film-frame">
        <video
          ref={video}
          className="scene-film-video"
          muted
          playsInline
          controls={started}
          preload="none"
          poster={`/films/${strand}.webp`}
          aria-label={`Silent animated scene: ${scene.place}. Camera approaches a welcoming interview table.`}
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
          <source
            src={`/films/${strand}.mp4`}
            type="video/mp4"
            onError={() => {
              setFailed(true);
              setPlaying(false);
              setLoading(false);
            }}
          />
          Your browser cannot play this scene. The complete scene is available
          as text beside it.
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
            <span>
              {String(seconds < 4 ? 1 : seconds < 8 ? 2 : 3).padStart(2, "0")}
            </span>
            <div>
              <small>{chapter}</small>
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
              ? "Loading your scene. You can continue whenever you’re ready."
              : ended
                ? "You’re here. Take the next step when you’re ready."
                : "Let the room become familiar."}
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

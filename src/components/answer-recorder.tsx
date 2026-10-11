"use client";
import { useState, useRef, useEffect } from "react";
import { Mic, Square, Keyboard, Volume2 } from "lucide-react";
import { api } from "@/lib/client-api";
export function AnswerRecorder({
  question,
  busy,
  onRecording,
  onCancel,
  onSubmit,
}: {
  question: string;
  busy: boolean;
  onRecording: () => void;
  onCancel: () => void;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [acquiring, setAcquiring] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(19).fill(6));
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const locked = useRef(false);
  const permissionRequest = useRef(0);
  const mounted = useRef(true);
  const audio = useRef<AudioContext | null>(null);
  const animation = useRef<number>(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      chunks.current = [];
      cancelAnimationFrame(animation.current);
      void audio.current?.close().catch(() => {});
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  function release() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    cancelAnimationFrame(animation.current);
    void audio.current?.close().catch(() => {});
    audio.current = null;
    setLevels(Array(19).fill(6));
  }
  async function start() {
    if (locked.current) return;
    locked.current = true;
    const requestId = ++permissionRequest.current;
    setError("");
    setAcquiring(true);
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Recording is unavailable in this browser. Type your answer below.",
        );
      window.speechSynthesis?.cancel();
      const acquiredStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current || requestId !== permissionRequest.current) {
        acquiredStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = acquiredStream;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((m) => MediaRecorder.isTypeSupported(m));
      recorder.current = new MediaRecorder(
        stream.current,
        mime
          ? { mimeType: mime, audioBitsPerSecond: 32000 }
          : { audioBitsPerSecond: 32000 },
      );
      chunks.current = [];
      recorder.current.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      recorder.current.onerror = () => {
        chunks.current = [];
        release();
        setRecording(false);
        setMode("text");
        setError("Recording failed. Please type your answer.");
        onCancel();
        locked.current = false;
      };
      recorder.current.start(1000);
      setElapsed(0);
      setRecording(true);
      onRecording();
      try {
        audio.current = new AudioContext();
        const source = audio.current.createMediaStreamSource(stream.current);
        const analyser = audio.current.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const bins = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
          analyser.getByteFrequencyData(bins);
          setLevels(
            Array.from({ length: 19 }, (_, i) => Math.max(6, bins[i + 2] / 5)),
          );
          animation.current = requestAnimationFrame(draw);
        };
        draw();
      } catch {
        /* Recording remains usable without visualization. */
      }
    } catch (e) {
      if (!mounted.current || requestId !== permissionRequest.current) return;
      release();
      setRecording(false);
      onCancel();
      setMode("text");
      setError(
        e instanceof Error
          ? e.message
          : "Microphone access was denied. You can type your answer.",
      );
    } finally {
      if (requestId === permissionRequest.current) {
        locked.current = false;
        if (mounted.current) setAcquiring(false);
      }
    }
  }
  async function finish() {
    if (locked.current || !recorder.current) return;
    locked.current = true;
    setError("");
    setTranscribing(true);
    setRecording(false);
    const current = recorder.current;
    current.onstop = async () => {
      const blob = new Blob(chunks.current, { type: current.mimeType });
      chunks.current = [];
      release();
      try {
        if (blob.size < 100)
          throw new Error(
            "No recording was captured. Please record again or type your answer.",
          );
        if (blob.size > 3_900_000)
          throw new Error(
            "Your recording is too large. Please type your answer or record a shorter response.",
          );
        const form = new FormData();
        form.append(
          "audio",
          blob,
          current.mimeType.includes("mp4")
            ? "answer.mp4"
            : current.mimeType.includes("ogg")
              ? "answer.ogg"
              : "answer.webm",
        );
        const result = await api<{ transcript: string }>(
          "/api/transcribe",
          form,
        );
        if (!mounted.current) return;
        setText(result.transcript);
        setMode("text");
        onCancel();
        await onSubmit(result.transcript);
        if (mounted.current) setText("");
      } catch (e) {
        if (mounted.current) {
          setError(
            e instanceof Error
              ? e.message
              : "Transcription failed. Please try again or type your answer.",
          );
          setMode("text");
          onCancel();
        }
      } finally {
        locked.current = false;
        if (mounted.current) setTranscribing(false);
      }
    };
    try {
      current.stop();
    } catch {
      chunks.current = [];
      release();
      locked.current = false;
      setTranscribing(false);
      setMode("text");
      setError(
        "Recording could not finish. Please record again or type your answer.",
      );
      onCancel();
    }
  }
  async function submit() {
    if (locked.current || busy) return;
    locked.current = true;
    setError("");
    try {
      await onSubmit(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      locked.current = false;
    }
  }
  function speak() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(question));
    }
  }
  const disabled = busy || transcribing;
  return (
    <div className="answer-area">
      <div role="status" aria-live="polite" className="record-status">
        {acquiring
          ? "Waiting for microphone permission…"
          : transcribing
            ? "Transcribing your response…"
            : busy
              ? "Reviewing your response…"
              : recording
                ? `Recording · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
                : "Ready when you are."}
      </div>
      {mode === "voice" ? (
        <>
          <button
            className={`record-orb ${recording ? "recording" : ""}`}
            onClick={recording ? finish : start}
            disabled={disabled || acquiring}
            aria-label={recording ? "I'm Finished" : "Begin Answer"}
          >
            {recording ? (
              <Square size={30} fill="currentColor" />
            ) : (
              <Mic size={35} />
            )}
          </button>
          <div className="waveform recorder-wave" aria-hidden="true">
            {levels.map((height, i) => (
              <i key={i} style={{ height }} />
            ))}
          </div>
          <button
            className="button primary"
            onClick={recording ? finish : start}
            disabled={disabled || acquiring}
          >
            {recording ? "I'm Finished" : "Begin Answer"}
          </button>
          {recording && elapsed > 300 && (
            <p className="helper">
              Take the time you need. Longer recordings may exceed the upload
              limit; text mode is also available.
            </p>
          )}
        </>
      ) : (
        <div className="text-answer">
          <label htmlFor="answer">Your answer</label>
          <textarea
            id="answer"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={16000}
            rows={7}
            disabled={disabled}
            placeholder="Share your experience in your own words…"
          />
          <button
            className="button primary"
            onClick={submit}
            disabled={disabled || text.trim().length === 0}
          >
            I&apos;m Finished
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!recording && (
        <div className="answer-tools">
          <button
            disabled={disabled}
            onClick={() => {
              if (acquiring) {
                permissionRequest.current++;
                locked.current = false;
                setAcquiring(false);
              }
              setMode(mode === "voice" ? "text" : "voice");
              setError("");
            }}
          >
            <Keyboard size={17} />
            {mode === "voice" ? "Type my answer" : "Use microphone"}
          </button>
          <button disabled={disabled} onClick={speak}>
            <Volume2 size={17} />
            Read question aloud
          </button>
        </div>
      )}
      <p className="privacy-note">
        Your recording is processed securely and never saved by this app.
      </p>
    </div>
  );
}

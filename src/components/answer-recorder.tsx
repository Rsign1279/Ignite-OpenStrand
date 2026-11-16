"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Keyboard, Volume2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { SESSION_CHANGED_MESSAGE } from "@/lib/student-session";

type RecorderProps = {
  question: string;
  studentSessionId?: string;
  onSessionChange?: () => void;
  busy: boolean;
  disabled?: boolean;
  onRecording: () => void;
  onCancel: () => void;
  onSubmit: (text: string) => Promise<void>;
};
const MAX_RECORDING_BYTES = 3_900_000;

export function AnswerRecorder({ disabled = false, ...props }: RecorderProps) {
  // Ending a shared-device session unmounts the active recorder immediately:
  // permission requests, media tracks, transcripts and drafts cannot carry over.
  return disabled ? (
    <div className="answer-area" role="status">
      Ending your session…
    </div>
  ) : (
    <ActiveAnswerRecorder key={props.question} {...props} />
  );
}

function ActiveAnswerRecorder({
  question,
  studentSessionId,
  onSessionChange,
  busy,
  onRecording,
  onCancel,
  onSubmit,
}: Omit<RecorderProps, "disabled">) {
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [acquiring, setAcquiring] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const [levels, setLevels] = useState<number[]>(Array(19).fill(6));
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recordingBytes = useRef(0);
  const locked = useRef(false);
  const operation = useRef(0);
  const mounted = useRef(true);
  const transcription = useRef<AbortController | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const animation = useRef<number>(0);

  const releaseMedia = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    cancelAnimationFrame(animation.current);
    void audio.current?.close().catch(() => {});
    audio.current = null;
  }, []);
  const disposeRecording = useCallback(() => {
    const current = recorder.current;
    recorder.current = null;
    if (current) {
      // Some implementations dispatch data/stop after an error or stop().
      // Detach every handler before releasing the previous student's media.
      current.ondataavailable = null;
      current.onerror = null;
      current.onstop = null;
      try {
        if (current.state !== "inactive") current.stop();
      } catch {
        // Track release must still happen if a browser's recorder has failed.
      }
    }
    chunks.current = [];
    recordingBytes.current = 0;
    releaseMedia();
  }, [releaseMedia]);
  const cancelSpeech = useCallback(() => {
    if (utterance.current) {
      utterance.current.onend = null;
      utterance.current.onerror = null;
      utterance.current = null;
    }
    window.speechSynthesis?.cancel();
  }, []);
  const cancelOperations = useCallback(() => {
    operation.current++;
    transcription.current?.abort();
    transcription.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelOperations();
      disposeRecording();
      cancelSpeech();
    };
  }, [disposeRecording, cancelSpeech, cancelOperations]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  function isCurrent(id: number) {
    return mounted.current && id === operation.current;
  }
  function stopSpeech() {
    cancelSpeech();
    setSpeaking(false);
  }
  function recover(message: string, id: number) {
    if (!isCurrent(id)) return;
    operation.current++;
    transcription.current?.abort();
    transcription.current = null;
    disposeRecording();
    locked.current = false;
    setLevels(Array(19).fill(6));
    setRecording(false);
    setTranscribing(false);
    setAcquiring(false);
    setMode("text");
    setError(message);
    onCancel();
  }
  async function start() {
    if (locked.current || busy) return;
    locked.current = true;
    const id = ++operation.current;
    setError("");
    setAcquiring(true);
    stopSpeech();
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Recording is unavailable in this browser. Type your answer below.",
        );
      const acquiredStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!isCurrent(id)) {
        acquiredStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = acquiredStream;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((m) => MediaRecorder.isTypeSupported(m));
      const current = new MediaRecorder(
        acquiredStream,
        mime
          ? { mimeType: mime, audioBitsPerSecond: 32000 }
          : { audioBitsPerSecond: 32000 },
      );
      recorder.current = current;
      chunks.current = [];
      recordingBytes.current = 0;
      current.ondataavailable = (event) => {
        if (!isCurrent(id) || recorder.current !== current) return;
        recordingBytes.current += event.data.size;
        if (recordingBytes.current > MAX_RECORDING_BYTES) {
          recover(
            "Your recording reached the upload limit. Please type your answer or record a shorter response.",
            id,
          );
          return;
        }
        if (event.data.size) chunks.current.push(event.data);
      };
      current.onerror = () =>
        recover("Recording failed. Please type your answer.", id);
      current.onstop = () =>
        recover(
          "Recording stopped unexpectedly. Please record again or type your answer.",
          id,
        );
      current.start(1000);
      setElapsed(0);
      setRecording(true);
      onRecording();
      try {
        audio.current = new AudioContext();
        const source = audio.current.createMediaStreamSource(acquiredStream);
        const analyser = audio.current.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const bins = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
          if (!isCurrent(id) || recorder.current !== current) return;
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
      recover(
        e instanceof Error
          ? e.message
          : "Microphone access was denied. You can type your answer.",
        id,
      );
    } finally {
      if (isCurrent(id)) {
        locked.current = false;
        setAcquiring(false);
      }
    }
  }
  function finish() {
    if (locked.current || busy || !recorder.current) return;
    locked.current = true;
    const id = operation.current;
    setError("");
    setTranscribing(true);
    setRecording(false);
    const current = recorder.current;
    current.onstop = async () => {
      if (!isCurrent(id) || recorder.current !== current) return;
      const blob = new Blob(chunks.current, { type: current.mimeType });
      disposeRecording();
      setLevels(Array(19).fill(6));
      const controller = new AbortController();
      transcription.current = controller;
      try {
        if (blob.size < 100)
          throw new Error(
            "No recording was captured. Please record again or type your answer.",
          );
        if (blob.size > MAX_RECORDING_BYTES)
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
          controller.signal,
          { studentSessionId },
        );
        if (!isCurrent(id)) return;
        if (typeof result.transcript !== "string" || !result.transcript.trim())
          throw new Error(
            "No speech was found. Please record again or type your answer.",
          );
        setText(result.transcript);
        setMode("text");
        onCancel();
        await onSubmit(result.transcript);
        if (isCurrent(id)) setText("");
      } catch (e) {
        if (isCurrent(id)) {
          if (
            e instanceof Error &&
            e.message === SESSION_CHANGED_MESSAGE &&
            onSessionChange
          ) {
            cancelOperations();
            onSessionChange();
            return;
          }
          setError(
            e instanceof Error
              ? e.message
              : "Transcription failed. Please try again or type your answer.",
          );
          setMode("text");
          onCancel();
        }
      } finally {
        if (isCurrent(id)) {
          transcription.current = null;
          locked.current = false;
          setTranscribing(false);
        }
      }
    };
    try {
      current.stop();
      // Release the microphone immediately; final data arrives via onstop.
      releaseMedia();
    } catch {
      recover(
        "Recording could not finish. Please record again or type your answer.",
        id,
      );
    }
  }
  function discard() {
    operation.current++;
    disposeRecording();
    locked.current = false;
    setLevels(Array(19).fill(6));
    setRecording(false);
    setElapsed(0);
    setError("");
    onCancel();
  }
  async function submit() {
    if (locked.current || busy || !text.trim()) return;
    locked.current = true;
    const id = ++operation.current;
    setError("");
    stopSpeech();
    try {
      await onSubmit(text);
    } catch (e) {
      if (isCurrent(id))
        setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      if (isCurrent(id)) locked.current = false;
    }
  }
  function speak() {
    stopSpeech();
    if (speaking) return;
    if (
      !window.speechSynthesis ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      setSpeechMessage(
        "Read aloud is unavailable in this browser. The question is written above.",
      );
      return;
    }
    try {
      const next = new SpeechSynthesisUtterance(question);
      next.lang = "en-US";
      next.rate = 0.92;
      next.onend = () => {
        if (mounted.current && utterance.current === next) setSpeaking(false);
      };
      next.onerror = (event) => {
        if (!mounted.current || utterance.current !== next) return;
        setSpeaking(false);
        if (event.error !== "canceled" && event.error !== "interrupted")
          setSpeechMessage("Audio could not play. Read the question above.");
      };
      utterance.current = next;
      setSpeechMessage("");
      setSpeaking(true);
      window.speechSynthesis.speak(next);
    } catch {
      stopSpeech();
      setSpeechMessage("Audio could not play. Read the question above.");
    }
  }
  const disabled = busy || transcribing;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
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
          {recording && (
            <button className="quiet-link" onClick={discard} disabled={busy}>
              Discard recording
            </button>
          )}
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
            aria-describedby="answer-length"
            placeholder="Share your experience in your own words…"
          />
          <p className="helper" id="answer-length">
            {wordCount} {wordCount === 1 ? "word" : "words"} · Specific details
            matter more than length.
          </p>
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
                operation.current++;
                locked.current = false;
                setAcquiring(false);
              }
              stopSpeech();
              setMode(mode === "voice" ? "text" : "voice");
              setError("");
            }}
          >
            <Keyboard size={17} />
            {mode === "voice" ? "Type my answer" : "Use microphone"}
          </button>
          <button
            disabled={disabled || acquiring}
            onClick={speak}
            aria-pressed={speaking}
          >
            {speaking ? <Square size={17} /> : <Volume2 size={17} />}
            {speaking ? "Stop reading" : "Read question aloud"}
          </button>
        </div>
      )}
      {speechMessage && (
        <p className="helper" role="status">
          {speechMessage}
        </p>
      )}
      <p className="privacy-note">
        Your recording is processed securely and never saved by this app.
      </p>
    </div>
  );
}

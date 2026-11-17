"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Keyboard, Volume2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { SESSION_CHANGED_MESSAGE } from "@/lib/student-session";
import "./answer-recorder.css";

type RecorderProps = {
  question: string;
  studentSessionId?: string;
  onSessionChange?: () => void;
  busy: boolean;
  processingMessage?: string;
  disabled?: boolean;
  onRecording: () => void;
  onCancel: () => void;
  onSubmit: (text: string) => Promise<void>;
};
const MAX_RECORDING_BYTES = 3_900_000;
const MAX_ANSWER_CHARACTERS = 16000;
type RecordingEdit = {
  draft: string;
  selection?: { start: number; end: number };
};
type PendingRecording = {
  requestId: string;
  blob: Blob;
  mimeType: string;
  edit: RecordingEdit;
  transcript?: string;
};

export function AnswerRecorder({ disabled = false, ...props }: RecorderProps) {
  // Ending a shared-device session unmounts the active recorder immediately:
  // permission requests, media tracks, transcripts and drafts cannot carry over.
  return disabled ? (
    <div className="answer-area" role="status">
      Ending your session…
    </div>
  ) : (
    <ActiveAnswerRecorder
      key={`${props.studentSessionId ?? "unbound"}:${props.question}`}
      {...props}
    />
  );
}

function ActiveAnswerRecorder({
  question,
  studentSessionId,
  onSessionChange,
  busy,
  processingMessage,
  onRecording,
  onCancel,
  onSubmit,
}: Omit<RecorderProps, "disabled">) {
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [acquiring, setAcquiring] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState("");
  const textValue = useRef("");
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const activeEdit = useRef<RecordingEdit | null>(null);
  const pendingRecording = useRef<PendingRecording | null>(null);
  const [hasPendingRecording, setHasPendingRecording] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState("");
  const focusPosition = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [capacityWait, setCapacityWait] = useState("");
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
  const mediaEndHandlers = useRef<
    { track: MediaStreamTrack; handler: EventListener }[]
  >([]);

  const releaseMedia = useCallback(() => {
    for (const { track, handler } of mediaEndHandlers.current)
      track.removeEventListener?.("ended", handler);
    mediaEndHandlers.current = [];
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
    activeEdit.current = null;
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
      pendingRecording.current = null;
      textValue.current = "";
      disposeRecording();
      cancelSpeech();
    };
  }, [disposeRecording, cancelSpeech, cancelOperations]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (mode !== "text" || transcribing || focusPosition.current === null)
      return;
    const position = focusPosition.current;
    focusPosition.current = null;
    textarea.current?.focus();
    textarea.current?.setSelectionRange(position, position);
  }, [mode, transcribing, text]);

  function updateDraft(value: string) {
    textValue.current = value;
    setText(value);
  }
  function clearPendingRecording() {
    pendingRecording.current = null;
    setHasPendingRecording(false);
    setPendingText(null);
  }

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
  async function start(replaceSelection = false) {
    if (locked.current || busy) return;
    if (pendingRecording.current) {
      setError("Add or discard the pending recording before recording more.");
      return;
    }
    if (textValue.current.length > MAX_ANSWER_CHARACTERS) {
      setError(
        "Shorten your answer to 16,000 characters before recording more.",
      );
      return;
    }
    if (replaceSelection && (!selection || selection.start >= selection.end)) {
      setError("Select the words you want to replace first.");
      return;
    }
    locked.current = true;
    const id = ++operation.current;
    activeEdit.current = {
      draft: textValue.current,
      ...(replaceSelection && selection ? { selection: { ...selection } } : {}),
    };
    setError("");
    setDraftNotice("");
    setMode("voice");
    setAcquiring(true);
    stopSpeech();
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Recording is unavailable here. Type your answer below.",
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
      for (const track of acquiredStream.getTracks()) {
        const handler = () =>
          recover(
            "Microphone disconnected. Your draft is still here; record again or type.",
            id,
          );
        if (typeof track.addEventListener === "function") {
          track.addEventListener("ended", handler, { once: true });
          mediaEndHandlers.current.push({ track, handler });
        }
      }
      chunks.current = [];
      recordingBytes.current = 0;
      current.ondataavailable = (event) => {
        if (!isCurrent(id) || recorder.current !== current) return;
        recordingBytes.current += event.data.size;
        if (recordingBytes.current > MAX_RECORDING_BYTES) {
          recover(
            "Recording reached the upload limit. Type your answer or record a shorter answer.",
            id,
          );
          return;
        }
        if (event.data.size) chunks.current.push(event.data);
      };
      current.onerror = () =>
        recover("Recording failed. Type your answer below.", id);
      current.onstop = () =>
        recover(
          "Recording stopped unexpectedly. Record again or type your answer.",
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
        const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        let lastUpdate = -Infinity;
        let still = false;
        const draw = (now: number) => {
          if (!isCurrent(id) || recorder.current !== current) return;
          if (motion.matches) {
            if (!still) setLevels(Array(19).fill(6));
            still = true;
          } else if (!document.hidden && now - lastUpdate >= 50) {
            lastUpdate = now;
            still = false;
            analyser.getByteFrequencyData(bins);
            const next = Array.from({ length: 19 }, (_, i) =>
              Math.max(6, Math.round(bins[i + 2] / 5)),
            );
            setLevels((previous) =>
              next.every((height, i) => height === previous[i])
                ? previous
                : next,
            );
          }
          animation.current = requestAnimationFrame(draw);
        };
        draw(performance.now());
      } catch {
        /* Recording remains usable without visualization. */
      }
    } catch (e) {
      recover(
        e instanceof Error
          ? e.message
          : "Microphone access denied. Type your answer below.",
        id,
      );
    } finally {
      if (isCurrent(id)) {
        locked.current = false;
        setAcquiring(false);
      }
    }
  }
  function applyRecordedText(
    segment: PendingRecording,
    spoken: string,
    deliberateEdit?: RecordingEdit,
  ) {
    const edit = deliberateEdit ?? segment.edit;
    // A retried clip may finish after the student has edited their old draft.
    // Keep both texts until they deliberately choose the new placement.
    if (!deliberateEdit && textValue.current !== edit.draft) {
      setPendingText(spoken);
      setError(
        "Your draft changed. Choose where to add the recorded text below.",
      );
      return;
    }
    const next = edit.selection
      ? edit.draft.slice(0, edit.selection.start) +
        spoken +
        edit.draft.slice(edit.selection.end)
      : edit.draft +
        (edit.draft && !/\s$/.test(edit.draft) ? " " : "") +
        spoken;
    if (next.length > MAX_ANSWER_CHARACTERS) {
      setPendingText(spoken);
      setError(
        "This would exceed 16,000 characters. Shorten your draft or the recorded text before adding it.",
      );
      return;
    }
    updateDraft(next);
    focusPosition.current = edit.selection
      ? edit.selection.start + spoken.length
      : next.length;
    setSelection(null);
    clearPendingRecording();
    setError("");
    setDraftNotice("Recording added. Review your answer before submitting.");
    setMode("text");
  }
  async function transcribeSegment(segment: PendingRecording, id: number) {
    locked.current = true;
    setTranscribing(true);
    setMode("text");
    setError("");
    setCapacityWait("");
    const controller = new AbortController();
    transcription.current = controller;
    try {
      const form = new FormData();
      form.append(
        "audio",
        segment.blob,
        segment.mimeType.includes("mp4")
          ? "answer.mp4"
          : segment.mimeType.includes("ogg")
            ? "answer.ogg"
            : "answer.webm",
      );
      const result = await api<{ transcript: string }>(
        "/api/transcribe",
        form,
        controller.signal,
        {
          studentSessionId,
          transcriptionRequestId: segment.requestId,
          onCapacityWait: () => {
            if (isCurrent(id) && pendingRecording.current === segment)
              setCapacityWait("Transcription is busy. Retrying shortly…");
          },
        },
      );
      if (!isCurrent(id) || pendingRecording.current !== segment) return;
      if (typeof result.transcript !== "string" || !result.transcript.trim())
        throw new Error(
          "No speech found. Retry this recording or discard it and type.",
        );
      const spoken = result.transcript.trim();
      segment.transcript = spoken;
      applyRecordedText(segment, spoken);
    } catch (e) {
      if (isCurrent(id)) {
        if (
          e instanceof Error &&
          e.message === SESSION_CHANGED_MESSAGE &&
          onSessionChange
        ) {
          clearPendingRecording();
          cancelOperations();
          onSessionChange();
          return;
        }
        setError(
          e instanceof Error
            ? e.message
            : "Transcription failed. Retry this recording or discard it and type.",
        );
        setMode("text");
      }
    } finally {
      if (isCurrent(id)) {
        transcription.current = null;
        locked.current = false;
        setTranscribing(false);
        setCapacityWait("");
      }
    }
  }
  function finish() {
    if (locked.current || busy || !recorder.current) return;
    locked.current = true;
    const id = operation.current;
    const edit = activeEdit.current ?? { draft: textValue.current };
    setError("");
    setTranscribing(true);
    setRecording(false);
    setMode("text");
    const current = recorder.current;
    current.onstop = () => {
      if (!isCurrent(id) || recorder.current !== current) return;
      const blob = new Blob(chunks.current, { type: current.mimeType });
      disposeRecording();
      setLevels(Array(19).fill(6));
      onCancel();
      if (blob.size < 100 || blob.size > MAX_RECORDING_BYTES) {
        recover(
          blob.size < 100
            ? "No recording captured. Record again or type your answer."
            : "Recording is too large. Record a shorter segment or type.",
          id,
        );
        return;
      }
      const segment = {
        requestId: crypto.randomUUID(),
        blob,
        mimeType: current.mimeType,
        edit,
      };
      pendingRecording.current = segment;
      setHasPendingRecording(true);
      void transcribeSegment(segment, id);
    };
    try {
      current.stop();
      // Final container bytes arrive before onstop; only the microphone is released here.
      releaseMedia();
    } catch {
      recover(
        "Recording could not finish. Record again or type your answer.",
        id,
      );
    }
  }
  function retryTranscription() {
    const segment = pendingRecording.current;
    if (!segment || locked.current || busy) return;
    const id = ++operation.current;
    void transcribeSegment(segment, id);
  }
  function placePendingText(replaceSelection = false) {
    const segment = pendingRecording.current;
    const spoken = pendingText?.trim();
    if (!segment || !spoken || locked.current || busy) return;
    if (replaceSelection && !selection) return;
    applyRecordedText(segment, spoken, {
      draft: textValue.current,
      ...(replaceSelection && selection ? { selection: { ...selection } } : {}),
    });
  }
  function cancelTranscription() {
    const captured = pendingRecording.current !== null;
    cancelOperations();
    disposeRecording();
    locked.current = false;
    setTranscribing(false);
    setCapacityWait("");
    setAcquiring(false);
    setRecording(false);
    setMode("text");
    setError(
      captured
        ? "Transcription paused. Your draft is unchanged; retry or discard this recording."
        : "Recording canceled. Your draft is unchanged.",
    );
    onCancel();
  }
  function discardPendingRecording() {
    if (locked.current || busy) return;
    clearPendingRecording();
    setError("");
    setDraftNotice("Recording discarded. Your draft is unchanged.");
  }
  function discard() {
    operation.current++;
    disposeRecording();
    locked.current = false;
    setLevels(Array(19).fill(6));
    setRecording(false);
    setElapsed(0);
    setError("");
    if (textValue.current.trim()) setMode("text");
    onCancel();
  }
  async function submit() {
    if (
      locked.current ||
      busy ||
      acquiring ||
      recording ||
      transcribing ||
      pendingRecording.current ||
      !text.trim() ||
      text.length > MAX_ANSWER_CHARACTERS
    )
      return;
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
      setSpeechMessage("Read aloud unavailable. Read the question above.");
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
          setSpeechMessage("Read aloud failed. Read the question above.");
      };
      utterance.current = next;
      setSpeechMessage("");
      setSpeaking(true);
      window.speechSynthesis.speak(next);
    } catch {
      stopSpeech();
      setSpeechMessage("Read aloud failed. Read the question above.");
    }
  }
  const disabled = busy || transcribing;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="answer-area">
      <div className="record-status">
        <span role="status" aria-live="polite">
          {acquiring
            ? "Waiting for microphone permission…"
            : transcribing
              ? capacityWait || "Transcribing your response…"
              : busy
                ? processingMessage || "Reviewing your response…"
                : recording
                  ? "Recording"
                  : "Ready when you are."}
        </span>
        {recording && (
          <span
            role="timer"
            aria-live="off"
            aria-label={`Elapsed recording time: ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`}
          >
            {` · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`}
          </span>
        )}
      </div>
      {mode === "voice" ? (
        <>
          <button
            className={`record-orb ${recording ? "recording" : ""}`}
            onClick={recording ? finish : () => void start()}
            disabled={disabled || acquiring}
            aria-label={recording ? "Stop and review" : "Begin Answer"}
          >
            {recording ? (
              <Square size={30} fill="currentColor" />
            ) : (
              <Mic size={35} />
            )}
          </button>
          <div className="waveform recorder-wave" aria-hidden="true">
            {levels.map((height, i) => (
              <i
                key={i}
                style={{ height: 52, transform: `scaleY(${height / 52})` }}
              />
            ))}
          </div>
          <button
            className="button primary"
            onClick={recording ? finish : () => void start()}
            disabled={disabled || acquiring}
          >
            {recording ? "Stop and review" : "Begin Answer"}
          </button>
          {recording && (
            <button className="quiet-link" onClick={discard} disabled={busy}>
              Discard recording
            </button>
          )}
          {recording && elapsed > 300 && (
            <p className="helper">
              Long recordings may hit the upload limit. You can also type.
            </p>
          )}
        </>
      ) : (
        <div className="text-answer">
          <label htmlFor="answer">Your answer</label>
          <textarea
            id="answer"
            ref={textarea}
            value={text}
            onChange={(e) => {
              updateDraft(e.target.value);
              setSelection(null);
              setDraftNotice("");
            }}
            onSelect={(e) => {
              const { selectionStart: start, selectionEnd: end } =
                e.currentTarget;
              setSelection(start < end ? { start, end } : null);
            }}
            maxLength={MAX_ANSWER_CHARACTERS}
            rows={7}
            disabled={disabled}
            aria-describedby="answer-length"
            placeholder="Share your experience in your own words…"
          />
          <p className="helper" id="answer-length">
            {wordCount} {wordCount === 1 ? "word" : "words"} · Specific details
            matter more than length.
            {text.trim() && " Select words to replace them by voice."}
          </p>
          <button
            className="button primary"
            onClick={submit}
            disabled={
              disabled ||
              hasPendingRecording ||
              text.trim().length === 0 ||
              text.length > MAX_ANSWER_CHARACTERS
            }
          >
            I&apos;m Finished
          </button>
        </div>
      )}
      {transcribing && (
        <button
          className="quiet-link"
          onClick={cancelTranscription}
          disabled={busy}
        >
          Cancel transcription
        </button>
      )}
      {hasPendingRecording && !transcribing && (
        <section className="recorded-edit-box" aria-label="Pending recording">
          {pendingText !== null ? (
            <>
              <label htmlFor="recorded-addition">Recorded text to add</label>
              <textarea
                id="recorded-addition"
                value={pendingText}
                maxLength={MAX_ANSWER_CHARACTERS}
                rows={4}
                disabled={busy}
                onChange={(e) => {
                  setPendingText(e.target.value);
                  if (pendingRecording.current)
                    pendingRecording.current.transcript = e.target.value;
                }}
              />
              <div className="pending-recording-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || !pendingText.trim()}
                  onClick={() => placePendingText()}
                >
                  Add to end
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || !pendingText.trim() || !selection}
                  onClick={() => placePendingText(true)}
                >
                  Replace selection
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="button secondary"
              onClick={retryTranscription}
              disabled={busy}
            >
              Retry transcription
            </button>
          )}
          <button
            type="button"
            className="quiet-link"
            onClick={discardPendingRecording}
            disabled={busy}
          >
            Discard recording
          </button>
        </section>
      )}
      {draftNotice && (
        <p className="helper" role="status">
          {draftNotice}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!recording && (
        <div className="answer-tools">
          <button
            disabled={disabled || (mode === "text" && hasPendingRecording)}
            onClick={() => {
              if (mode === "text") {
                void start();
                return;
              }
              if (acquiring) {
                operation.current++;
                locked.current = false;
                setAcquiring(false);
              }
              stopSpeech();
              setMode("text");
              setError("");
            }}
          >
            {mode === "voice" ? <Keyboard size={17} /> : <Mic size={17} />}
            {mode === "voice" ? "Type my answer" : "Continue recording"}
          </button>
          {mode === "text" && text.trim() && (
            <button
              disabled={
                disabled || acquiring || hasPendingRecording || !selection
              }
              onClick={() => void start(true)}
            >
              <Mic size={17} /> Replace selection by voice
            </button>
          )}
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
        Audio is transcribed, not stored by this app.
      </p>
    </div>
  );
}

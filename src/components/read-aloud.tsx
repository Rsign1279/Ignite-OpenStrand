"use client";
import { useEffect, useRef, useState } from "react";
import { Volume2, Square } from "lucide-react";

export function ReadAloud({
  text,
  label = "Listen to the scene",
}: {
  text: string;
  label?: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState("");
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(
    () => () => {
      if (utterance.current) {
        utterance.current.onend = null;
        utterance.current.onerror = null;
        window.speechSynthesis?.cancel();
      }
    },
    [],
  );
  function toggle() {
    if (!("speechSynthesis" in window)) {
      setMessage("Read aloud unavailable. Read the scene above.");
      return;
    }
    window.speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const next = new SpeechSynthesisUtterance(text);
    next.lang = "en-US";
    next.rate = 0.92;
    next.onend = () => setSpeaking(false);
    next.onerror = (event) => {
      setSpeaking(false);
      if (event.error !== "interrupted" && event.error !== "canceled")
        setMessage("Read aloud failed. Read the scene above.");
    };
    utterance.current = next;
    setMessage("");
    setSpeaking(true);
    window.speechSynthesis.speak(next);
  }
  return (
    <>
      <button
        type="button"
        className="scene-audio"
        onClick={toggle}
        aria-pressed={speaking}
      >
        {speaking ? <Square size={16} /> : <Volume2 size={17} />}
        {speaking ? "Stop listening" : label}
      </button>
      {message && (
        <p className="helper" role="status">
          {message}
        </p>
      )}
    </>
  );
}

"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowRight, RotateCcw, MapPin, AudioLines } from "lucide-react";
import { getStrand, type StrandId } from "@/config/strands";
import { getInterviewScene } from "@/config/interview-scenes";

export function StudioPreview() {
  const [strand, setStrand] = useState<StrandId>("technology");
  const [revealed, setRevealed] = useState(false);
  const selected = getStrand(strand);
  const question = selected.questions[8];
  const scene = getInterviewScene(strand, question, "PRE");
  return (
    <div
      className="studio-preview"
      aria-label="Interactive preview of the interview studio"
    >
      <div className="preview-toolbar">
        <span>
          <span className="live-dot" /> INSIDE OPENSTRAND
        </span>
        <span>01 / {revealed ? "THE QUESTION" : "THE SCENE"}</span>
      </div>
      <div className="preview-room-art">
        <Image
          key={strand}
          src={`/films/${strand}.webp`}
          className="strand-room-poster"
          width={960}
          height={540}
          alt=""
          loading="lazy"
          unoptimized
        />
        <span className="preview-location">
          <MapPin size={14} />
          {scene.place}
        </span>
        <div className="preview-seat-tag">
          <span className="seat-dot" />
          <div>
            <strong>Your seat</strong>
            <span>Take a breath.</span>
          </div>
        </div>
      </div>
      <div className="preview-story" aria-live="polite">
        <div className="preview-story-label">
          <span>
            {revealed ? selected.interviewerTitle : "BEFORE THE QUESTION"}
          </span>
          <AudioLines size={17} />
        </div>
        <p>{revealed ? `“${question.text}”` : scene.detail}</p>
        <button type="button" onClick={() => setRevealed(!revealed)}>
          {revealed ? (
            <>
              <RotateCcw size={14} /> Revisit the scene
            </>
          ) : (
            <>
              Reveal the question <ArrowRight size={15} />
            </>
          )}
        </button>
      </div>
      <div
        className="preview-strands"
        role="group"
        aria-label="Preview a strand"
      >
        {(["technology", "education", "digital-media"] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={strand === id}
            onClick={() => {
              setStrand(id);
              setRevealed(false);
            }}
          >
            {id === "education" ? "Education" : getStrand(id).shortName}
          </button>
        ))}
      </div>
    </div>
  );
}

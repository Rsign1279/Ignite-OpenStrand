"use client";
import { ArrowRight, Check, Shuffle, ArrowUpRight } from "lucide-react";
import { getStrand, type StrandId } from "@/config/strands";
import { getInterviewScene } from "@/config/interview-scenes";
import type { PracticeQuestion } from "@/config/question-bank";
import { InterviewRoom } from "./interview-room";

export function QuestionLibrary({
  strand,
  name,
  question,
  completed,
  onChoose,
  onStart,
}: {
  strand: StrandId;
  name: string;
  question: PracticeQuestion;
  completed: string[];
  onChoose: (id: string) => void;
  onStart: () => void;
}) {
  const selected = getStrand(strand);
  const scene = getInterviewScene(strand, question, "PRE");
  function surprise() {
    const others = selected.questions.filter((q) => q.id !== question.id);
    const unexplored = others.filter((q) => !completed.includes(q.id));
    const pool = unexplored.length ? unexplored : others;
    onChoose(pool[0].id);
  }
  return (
    <section className="question-library" aria-labelledby="library-heading">
      <div className="library-heading">
        <div>
          <span className="eyebrow">YOUR PRACTICE STUDIO</span>
          <h1 id="library-heading">Ready, {name}?</h1>
          <p>Choose a topic. We’ll set the scene.</p>
        </div>
        <span className="library-count">
          <strong>10</strong> questions
        </span>
      </div>
      <div className="library-layout">
        <div className="library-spotlight">
          <div className="library-room">
            <InterviewRoom strand={strand} />
            <span className="scene-tag">
              <span className="live-dot" /> YOUR NEXT SCENE
            </span>
            <span className="library-room-caption">
              {scene.place} <ArrowUpRight size={18} />
            </span>
          </div>
          <div className="library-spotlight-copy">
            <span className="eyebrow">{scene.opportunity}</span>
            <h2>{scene.title}</h2>
            <p className="question-preview">{scene.intention}</p>
            <button className="button primary" onClick={onStart}>
              Meet your interviewer <ArrowRight size={18} />
            </button>
            <p className="helper">
              See the question after the scene. Answer, learn STAR, then retry.
            </p>
          </div>
        </div>
        <div className="library-topics">
          <div className="library-controls">
            <label htmlFor="practice-question">
              Choose a practice question · 10 in your strand
            </label>
            <select
              id="practice-question"
              value={question.id}
              onChange={(e) => onChoose(e.target.value)}
            >
              {selected.questions.map((q, i) => (
                <option key={q.id} value={q.id}>
                  {i + 1}. {q.topic}
                </option>
              ))}
            </select>
          </div>
          <div className="topic-grid" role="group" aria-label="Practice topics">
            {selected.questions.map((q, i) => (
              <button
                type="button"
                key={q.id}
                className={`topic-card ${q.id === question.id ? "selected" : ""}`}
                aria-pressed={q.id === question.id}
                onClick={() => onChoose(q.id)}
              >
                <span className="topic-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{q.topic}</span>
                {completed.includes(q.id) ? (
                  <Check size={17} aria-label="Reviewed in this session" />
                ) : (
                  <ArrowUpRight size={16} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
          <button type="button" className="surprise-button" onClick={surprise}>
            <Shuffle size={16} /> Pick one for me
          </button>
          <div className="library-reassurance">
            <strong>Your student experiences count.</strong>
            <p>
              Use IGNITE, school, clubs, volunteering, work, or personal
              projects. No professional experience needed.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

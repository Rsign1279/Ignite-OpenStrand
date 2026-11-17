"use client";
import { ArrowRight, ChevronDown, Lightbulb, PenLine } from "lucide-react";
import { getQuestionTopic, topicStories } from "@/config/interview-scenes";
import type { PracticeQuestion } from "@/config/question-bank";
import { rubric } from "@/config/strands";

export const starParts = rubric.map((criterion) => ({
  letter: criterion.letter,
  title: criterion.title,
  question: criterion.lessonQuestion,
  text: criterion.lessonText,
}));
export type StoryNotes = Record<(typeof starParts)[number]["letter"], string>;
export const emptyStoryNotes: StoryNotes = { S: "", T: "", A: "", R: "" };

export function StarLesson({
  question,
  feedback,
  notes,
  onNotes,
  onContinue,
}: {
  question: PracticeQuestion;
  feedback?: string;
  notes: StoryNotes;
  onNotes: (value: StoryNotes) => void;
  onContinue: () => void;
}) {
  const topic = topicStories[getQuestionTopic(question)];
  return (
    <section className="lesson studio-lesson">
      <div className="screen-heading">
        <span className="eyebrow">A FRAMEWORK, NOT A SCRIPT</span>
        <h1>
          Make your experience
          <br />
          <em>easy to follow.</em>
        </h1>
        <p>
          Four parts, up to 3 points each. Make your role and outcome clear.
        </p>
      </div>
      {feedback && (
        <div className="lesson-feedback">
          <Lightbulb size={23} />
          <div>
            <span className="eyebrow">YOUR NEXT STEP</span>
            <p>{feedback}</p>
          </div>
        </div>
      )}
      <div className="star-grid">
        {starParts.map((s) => (
          <article key={s.letter}>
            <span>{s.letter}</span>
            <h2>{s.title}</h2>
            <strong>{s.question}</strong>
            <p>{s.text}</p>
          </article>
        ))}
      </div>
      <details className="example-card reflection-details">
        <summary>
          See a STAR example <span>Separate story</span>
        </summary>
        <div>
          <article>
            <h3>A vague answer</h3>
            <p>“We ran a club fundraiser. It was busy, but it went well.”</p>
          </article>
          <article>
            <h3>A story you can follow</h3>
            <p>
              “Our club needed funds for supplies <b>(S)</b>. I was responsible
              for organizing a bake sale <b>(T)</b>. I assigned shifts, made a
              supply checklist, and promoted it at school <b>(A)</b>. We met our
              goal, and I learned to delegate earlier <b>(R)</b>.”
            </p>
          </article>
        </div>
      </details>
      <details className="story-planner">
        <summary className="planner-heading">
          <span className="planner-icon">
            <PenLine size={23} />
          </span>
          <div>
            <span className="eyebrow">OPTIONAL · YOUR STORY SKETCH</span>
            <h2>Sketch your answer.</h2>
            <p>Short notes for your next take.</p>
          </div>
          <ChevronDown
            className="planner-toggle"
            size={22}
            aria-hidden="true"
          />
        </summary>
        <p className="planner-question">“{question.text}”</p>
        <p className="planner-intention">{topic.intention}</p>
        <div className="planner-grid">
          {starParts.map((s, i) => (
            <div key={s.letter}>
              <label htmlFor={`story-${s.letter}`}>
                <span>{s.letter}</span>
                {s.title}
              </label>
              <p id={`story-hint-${s.letter}`}>{topic.prompts[i]}</p>
              <textarea
                id={`story-${s.letter}`}
                rows={3}
                maxLength={800}
                value={notes[s.letter]}
                aria-describedby={`story-hint-${s.letter}`}
                placeholder="A few words, in your own voice…"
                onChange={(e) =>
                  onNotes({ ...notes, [s.letter]: e.target.value })
                }
              />
            </div>
          ))}
        </div>
        <p className="helper">
          Optional, private notes. They are not submitted or saved; refreshing
          clears them.
        </p>
      </details>
      <div className="lesson-takeaway">
        <Lightbulb size={19} />
        <p>{topic.takeaway}</p>
      </div>
      <button className="button primary" onClick={onContinue}>
        Try again with STAR <ArrowRight size={18} />
      </button>
    </section>
  );
}

export function StoryNotesPanel({
  notes,
  question,
}: {
  notes: StoryNotes;
  question: PracticeQuestion;
}) {
  const topic = topicStories[getQuestionTopic(question)];
  return (
    <details className="story-notes-panel">
      <summary>
        <PenLine size={16} /> Your STAR notes
      </summary>
      <div>
        <p>{topic.intention}</p>
        {starParts.map((s, i) => (
          <article key={s.letter}>
            <strong>
              {s.letter} · {s.title}
            </strong>
            <p>{notes[s.letter] || topic.prompts[i]}</p>
          </article>
        ))}
        <span className="helper">Keep your answer natural and true.</span>
      </div>
    </details>
  );
}

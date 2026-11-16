"use client";
import { ArrowRight, ChevronDown, Lightbulb, PenLine } from "lucide-react";
import { getQuestionTopic, topicStories } from "@/config/interview-scenes";
import type { PracticeQuestion } from "@/config/question-bank";

export const starParts = [
  {
    letter: "S",
    title: "Situation",
    question: "What was happening?",
    text: "Set the scene. Give just enough context to understand the story.",
  },
  {
    letter: "T",
    title: "Task",
    question: "What were you responsible for?",
    text: "Make your goal or responsibility clear.",
  },
  {
    letter: "A",
    title: "Action",
    question: "What specifically did YOU do?",
    text: "Spend most of your answer here. Explain your steps and choices.",
  },
  {
    letter: "R",
    title: "Result",
    question: "What happened or what did you learn?",
    text: "Share an outcome, feedback, impact, or an honest lesson.",
  },
] as const;
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
          STAR gives your own story a beginning, a contribution, and an outcome.
        </p>
      </div>
      {feedback && (
        <div className="lesson-feedback">
          <Lightbulb size={23} />
          <div>
            <span className="eyebrow">BRING THIS INTO YOUR NEXT TAKE</span>
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
      <div className="example-card">
        <span className="eyebrow">SEE THE DIFFERENCE · A SEPARATE EXAMPLE</span>
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
      </div>
      <details className="story-planner">
        <summary className="planner-heading">
          <span className="planner-icon">
            <PenLine size={23} />
          </span>
          <div>
            <span className="eyebrow">OPTIONAL · YOUR STORY SKETCH</span>
            <h2>Sketch your answer.</h2>
            <p>Short notes are enough. You’ll see them on your next take.</p>
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
          These notes stay in this page’s memory. They are not submitted or
          saved; refreshing clears them. You can continue without writing notes.
        </p>
      </details>
      <div className="lesson-takeaway">
        <Lightbulb size={19} />
        <p>{topic.takeaway}</p>
      </div>
      <button className="button primary" onClick={onContinue}>
        I understand STAR — Start Post-Assessment <ArrowRight size={18} />
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
        <PenLine size={16} /> Your STAR notes & question focus
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
        <span className="helper">
          Use this as a guide. Keep your answer natural and true to your
          experience.
        </span>
      </div>
    </details>
  );
}

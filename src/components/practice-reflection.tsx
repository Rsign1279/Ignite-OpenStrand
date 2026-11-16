"use client";

import { useId, useState } from "react";
import { ArrowRight, Check, NotebookPen, Target } from "lucide-react";
import { getQuestionTopic } from "@/config/interview-scenes";
import type { PracticeQuestion } from "@/config/question-bank";
import type { Evaluation } from "@/lib/validation";
import {
  getPracticeFocus,
  createRevisionGoal,
  interviewFollowUps,
  summarizeQuestionGrowth,
  type PracticeAttempt,
} from "@/lib/practice-learning";

/** Mount with an attempt-specific key to keep reflections tied to the answer. */
export function PracticeReflection({
  evaluation,
  question,
  answer,
  onRetry,
  busy = false,
}: {
  evaluation: Evaluation;
  question: PracticeQuestion;
  answer?: string;
  onRetry?: () => void;
  busy?: boolean;
}) {
  const id = useId();
  const [reflection, setReflection] = useState("");
  const [checked, setChecked] = useState(false);
  const focus = getPracticeFocus(evaluation);
  const revisionGoal = createRevisionGoal(question.id, evaluation);
  return (
    <section className="practice-reflection" aria-labelledby={`${id}-heading`}>
      <div className="reflection-heading">
        <span className="reflection-mark">
          <Target size={22} />
        </span>
        <div>
          <span className="eyebrow">YOUR NEXT STEP</span>
          <h2 id={`${id}-heading`}>{focus.title}</h2>
        </div>
        {!focus.complete && (
          <span className="reflection-score">
            {focus.label} <b>{focus.score}/3</b>
          </span>
        )}
      </div>
      <p className="reflection-action">{revisionGoal.action}</p>
      <details className="reflection-details">
        <summary>Rehearse this step</summary>
        <div className="reflection-rehearsal">
          <NotebookPen size={18} />
          <p>{focus.rehearsal}</p>
        </div>
      </details>
      {answer && (
        <details className="answer-review">
          <summary>Review the answer you submitted</summary>
          <p>{answer}</p>
          <span>
            Submitted text or transcription. Compare it with the feedback.
          </span>
        </details>
      )}
      <details className="reflection-details">
        <summary>
          Make a quick improvement plan <span>Optional</span>
        </summary>
        <div>
          <label htmlFor={`${id}-plan`}>
            What will you change in your next answer?
          </label>
          <textarea
            id={`${id}-plan`}
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            maxLength={600}
            rows={3}
            placeholder="One detail I will add, clarify, or explain…"
            aria-describedby={`${id}-privacy`}
          />
          <label className="reflection-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>{focus.selfCheck}</span>
          </label>
          <p id={`${id}-privacy`} className="reflection-privacy">
            Private, not scored or saved. Clears when you leave this review.
          </p>
        </div>
      </details>
      <details className="reflection-details reflection-follow-up">
        <summary>
          Try an interviewer’s follow-up <span>Unscored</span>
        </summary>
        <div>
          <p>“{interviewFollowUps[getQuestionTopic(question)]}”</p>
          <span>
            Rehearse aloud or in thought using a true detail. Nothing is
            recorded or scored.
          </span>
        </div>
      </details>
      <div className="reflection-footer">
        <span>
          <Check size={15} /> Keep it true.
        </span>
        {onRetry && (
          <button
            type="button"
            className="button secondary"
            onClick={onRetry}
            disabled={busy}
          >
            Retry this question <ArrowRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

export function QuestionGrowth({
  attempts,
  question,
}: {
  attempts: readonly PracticeAttempt[];
  question: PracticeQuestion;
}) {
  const growth = summarizeQuestionGrowth(attempts, question.id);
  if (!growth) return null;
  return (
    <section
      className={`question-growth growth-${growth.direction}`}
      aria-label="Growth on this question"
    >
      <div>
        <span className="eyebrow">THIS QUESTION · FIRST TO LATEST</span>
        <h2>{growth.title}</h2>
        <p>{growth.explanation}</p>
      </div>
      <div className="growth-comparison">
        <span>
          <small>
            {growth.excludedAttempts ? "First with this guide" : "First"}
          </small>
          <strong>
            {growth.before}
            <small>/12</small>
          </strong>
        </span>
        <ArrowRight size={21} />
        <span>
          <small>Latest</small>
          <strong>
            {growth.after}
            <small>/12</small>
          </strong>
        </span>
        <b>
          {growth.change > 0 ? "+" : ""}
          {growth.change}
          <small>points</small>
        </b>
      </div>
      <p className="growth-note">
        Based on {growth.attempts} comparable scored responses to this question
        in this session, using the same review method.{" "}
        {growth.excludedAttempts > 0
          ? `${growth.excludedAttempts} responses with other review methods are excluded. `
          : ""}
        Practice scores do not predict hiring success.
      </p>
    </section>
  );
}

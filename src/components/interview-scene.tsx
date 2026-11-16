"use client";
import { ArrowRight } from "lucide-react";
import {
  getInterviewScene,
  type InterviewRound,
} from "@/config/interview-scenes";
import { getStrand, type StrandId } from "@/config/strands";
import type { PracticeQuestion } from "@/config/question-bank";
import { SceneFilm } from "./scene-film";
import { ReadAloud } from "./read-aloud";
import { RevisionGoalReminder } from "./revision-goal-reminder";
import type { PracticeRevisionGoal } from "@/lib/practice-learning";

export function InterviewScene({
  strand,
  question,
  round,
  retry = false,
  revisionGoal,
  onEnter,
}: {
  strand: StrandId;
  question: PracticeQuestion;
  round: InterviewRound;
  retry?: boolean;
  revisionGoal?: PracticeRevisionGoal;
  onEnter: () => void;
}) {
  const scene = getInterviewScene(strand, question, round);
  if (retry)
    scene.opening = `Back in ${scene.place.toLowerCase()}, you have another take at the same question. Keep your story true and use your feedback.`;
  const selected = getStrand(strand);
  const visibleGoal =
    round !== "PRE" && revisionGoal?.questionId === question.id
      ? revisionGoal
      : undefined;
  return (
    <section className="scene-screen" aria-labelledby="scene-title">
      <div className="scene-art">
        <div className="scene-art-top">
          <span className="scene-tag">
            <span className="live-dot" /> THE INTERVIEW ROOM
          </span>
          <span>IGNITE / OPENSTRAND</span>
        </div>
        <SceneFilm strand={strand} />
        <span className="scene-coordinate" aria-hidden="true">
          A PLACE FOR YOUR NEXT CHAPTER
        </span>
      </div>
      <div className="scene-copy">
        <div className="eyebrow">
          {round === "POST"
            ? "TAKE TWO · THE SAME QUESTION"
            : round === "TRANSFER"
              ? retry
                ? "ANOTHER TAKE · THE SAME QUESTION"
                : "A NEW QUESTION · A NEW STORY"
              : "YOUR FIRST SCENE"}
        </div>
        <h1 id="scene-title">
          {scene.title}
          <span>.</span>
        </h1>
        <p className="scene-opening">{scene.opening}</p>
        <p>{scene.beat}</p>
        <div className="scene-person">
          <span className="interviewer-avatar" aria-hidden="true">
            {selected.interviewerTitle
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <strong>{selected.interviewerTitle}</strong>
            <span>{scene.opportunity}</span>
          </div>
        </div>
        <div className="scene-invitation">
          <span className="scene-invitation-line" />
          <p>
            <strong>Take a breath. Begin when ready.</strong>
          </p>
        </div>
        {visibleGoal && <RevisionGoalReminder goal={visibleGoal} compact />}
        <div className="scene-actions">
          <button className="button primary" onClick={onEnter}>
            I’m ready — ask the question <ArrowRight size={18} />
          </button>
          <ReadAloud
            text={`${scene.opening} ${scene.beat} ${visibleGoal ? `Your focus for this take: ${visibleGoal.action}` : ""} Take a breath. Begin when ready.`}
          />
        </div>
        <p className="scene-disclaimer">
          Fictional practice setting. No professional experience needed.
        </p>
        {round === "PRE" && (
          <details className="scene-details">
            <summary>More scene detail</summary>
            <p>{scene.detail}</p>
          </details>
        )}
      </div>
    </section>
  );
}

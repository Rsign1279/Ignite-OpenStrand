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
    scene.opening = `You return to ${scene.place.toLowerCase()} for another take. The interviewer gives you a moment to remember your feedback. This is the same question: keep your experience true and try the improvement you chose.`;
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
        {round === "PRE" && <p>{scene.detail}</p>}
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
            <span>Practice interviewer · {scene.opportunity}</span>
          </div>
        </div>
        <div className="scene-invitation">
          <span className="scene-invitation-line" />
          <p>
            You take a breath. The interviewer looks up.
            <br />
            <strong>This is your space to practice.</strong>
          </p>
        </div>
        {visibleGoal && <RevisionGoalReminder goal={visibleGoal} compact />}
        <div className="scene-actions">
          <button className="button primary" onClick={onEnter}>
            I’m ready — ask the question <ArrowRight size={18} />
          </button>
          <ReadAloud
            text={`${scene.opening} ${round === "PRE" ? scene.detail : ""} ${scene.beat} ${visibleGoal ? `Your focus for this take: ${visibleGoal.action}` : ""} Take a breath. This is your space to practice.`}
          />
        </div>
        <p className="scene-disclaimer">
          An imagined setting for a real skill. No professional experience
          needed.
        </p>
      </div>
    </section>
  );
}

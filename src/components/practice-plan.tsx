"use client";
import { Download, Check, Compass } from "lucide-react";
import { useState } from "react";
import { getStrand, type StrandId } from "@/config/strands";
import { LEGACY_SCORING_VERSION } from "@/config/rubric-anchors";
import {
  getPracticeFocus,
  type PracticeAttempt,
} from "@/lib/practice-learning";
import { totalScore, type Evaluation } from "@/lib/validation";

export function PracticePlan({
  strand,
  attempts,
  evaluation,
}: {
  strand: StrandId;
  attempts: readonly PracticeAttempt[];
  evaluation: Evaluation;
}) {
  const selected = getStrand(strand);
  const focus = getPracticeFocus(evaluation);
  const [downloaded, setDownloaded] = useState(false);
  const explored = selected.questions.filter((q) =>
    attempts.some((a) => a.questionId === q.id),
  );
  function download() {
    const lines = [
      "IGNITE OPENSTRAND — MY NEXT INTERVIEW",
      "",
      selected.name,
      `${attempts.length} answers across ${explored.length} topics this session.`,
      "",
      "MY NEXT PRACTICE GOAL",
      focus.title,
      focus.action,
      "",
      "A QUICK REHEARSAL",
      focus.rehearsal,
      "",
      "CHECK MY ANSWER",
      focus.selfCheck,
      "",
      "MY PRACTICE RECORD",
    ];
    for (const question of explored) {
      const questionAttempts = attempts.filter(
        (a) => a.questionId === question.id,
      );
      const scores = questionAttempts.map((attempt, index) => {
        const settingsChanged =
          index > 0 &&
          (attempt.scoringVersion ?? LEGACY_SCORING_VERSION) !==
            (questionAttempts[index - 1].scoringVersion ??
              LEGACY_SCORING_VERSION);
        return `${settingsChanged ? "[review settings changed] " : ""}${totalScore(attempt.scores)}/12`;
      });
      lines.push(`${question.topic}: ${scores.join(" → ")}`);
    }
    lines.push(
      "",
      "BEFORE MY NEXT REAL INTERVIEW",
      "1. Choose two honest, role-relevant experiences.",
      "2. Rehearse Situation, Task, Action, Result in my own words.",
      "3. Practice an unfamiliar question with fewer notes.",
      "4. Ask a teacher or partner what was clear and what needs detail.",
      "",
      "Practice scores are not a prediction of hiring success. Compare repeats of the same question with the same review settings; question difficulty varies. No name, recording, or answer transcript is included.",
    );
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ignite-my-interview-practice-plan.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  }
  return (
    <section className="practice-plan" aria-labelledby="practice-plan-title">
      <div className="practice-plan-heading">
        <Compass size={25} />
        <span className="eyebrow">YOUR TAKEAWAY</span>
      </div>
      <h2 id="practice-plan-title">Your practice plan.</h2>
      <p>
        <strong>{attempts.length} answers</strong> across{" "}
        <strong>{explored.length} topics</strong> this session.
      </p>
      <div className="practice-plan-focus">
        <strong>{focus.title}</strong>
      </div>
      <details className="reflection-details">
        <summary>Practice tips</summary>
        <div>
          <p>{focus.action}</p>
          <ol>
            <li>Choose a real experience that fits the question.</li>
            <li>Explain your actions and what happened afterward.</li>
            <li>Rehearse a new question with fewer notes.</li>
          </ol>
        </div>
      </details>
      <button type="button" className="button secondary" onClick={download}>
        {downloaded ? <Check size={18} /> : <Download size={18} />} Download my
        practice plan
      </button>
      <p className="helper" role="status">
        {downloaded
          ? "Plan downloaded: goals and scores, with no name, audio, or answer text."
          : "Goals and session scores. No name, audio, or answer text."}
      </p>
    </section>
  );
}

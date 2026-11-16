import { Target } from "lucide-react";
import type { PracticeRevisionGoal } from "@/lib/practice-learning";

export function RevisionGoalReminder({
  goal,
  compact = false,
}: {
  goal: PracticeRevisionGoal;
  compact?: boolean;
}) {
  return (
    <section
      className={`revision-goal-reminder${compact ? " compact" : ""}`}
      aria-label="Your focus for this take"
    >
      <div className="revision-goal-label">
        <Target size={17} aria-hidden="true" />
        <span className="eyebrow">
          {goal.complete
            ? "KEEP PRACTICING THE SKILL"
            : "YOUR FOCUS FOR THIS TAKE"}
        </span>
      </div>
      {!compact && <strong>{goal.title}</strong>}
      <p>{goal.action}</p>
      {!compact && (
        <details>
          <summary>A quick rehearsal</summary>
          <p>{goal.rehearsal}</p>
        </details>
      )}
    </section>
  );
}

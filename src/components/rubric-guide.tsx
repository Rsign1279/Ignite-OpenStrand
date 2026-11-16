import { BookOpen } from "lucide-react";
import {
  rubricReviewPrinciples,
  rubricScoringGuide,
} from "@/config/rubric-anchors";

export function RubricGuide() {
  return (
    <details className="rubric-guide">
      <summary>
        <BookOpen size={18} aria-hidden="true" />
        <span>How your answer is reviewed</span>
      </summary>
      <div className="rubric-guide-content">
        <p className="rubric-guide-intro">
          Four categories, 0–3 points each, guide the AI review. Scores describe
          this answer and cannot judge your worth or predict hiring success.
        </p>
        <div className="rubric-guide-grid">
          {rubricScoringGuide.map((criterion) => (
            <section key={criterion.key} className="rubric-guide-criterion">
              <h3>{criterion.label}</h3>
              <p>{criterion.definition}</p>
              <dl aria-label={`${criterion.label} scoring anchors`}>
                {criterion.levels.map((level) => (
                  <div key={level.score}>
                    <dt>
                      <span>{level.score}</span>
                      {level.label}
                    </dt>
                    <dd>{level.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <div className="rubric-guide-principles">
          <h3>What counts as evidence</h3>
          <ul>
            {rubricReviewPrinciples.map((principle) => (
              <li key={principle}>{principle}</li>
            ))}
          </ul>
          <p>
            AI can miss context. Check the feedback against your answer; discuss
            any mismatch with your advisor.
          </p>
        </div>
      </div>
    </details>
  );
}

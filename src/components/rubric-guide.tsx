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
          Four categories, 0–3 points each. These same descriptions guide the AI
          review and help you interpret its feedback. A score describes this
          answer; it is not a judgment of you or a prediction of hiring success.
        </p>
        <div className="rubric-guide-grid">
          {rubricScoringGuide.map((criterion) => (
            <section key={criterion.key} className="rubric-guide-criterion">
              <h3>{criterion.label}</h3>
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
          <h3>Bring your experience. Keep it true.</h3>
          <ul>
            {rubricReviewPrinciples.map((principle) => (
              <li key={principle}>{principle}</li>
            ))}
          </ul>
          <p>
            AI feedback can miss context. Compare its observations with what you
            actually said, and discuss a score with your advisor if it does not
            fit the evidence.
          </p>
        </div>
      </div>
    </details>
  );
}

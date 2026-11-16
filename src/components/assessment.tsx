import { rubric } from "@/config/strands";
import {
  totalScore,
  scoreChange,
  type Evaluation,
  type Comparison,
} from "@/lib/validation";
import { ArrowRight } from "lucide-react";
import { RubricGuide } from "./rubric-guide";
export function Rubric({
  value,
  pre,
}: {
  value: Evaluation;
  pre?: Evaluation;
}) {
  return (
    <div className="rubric">
      {rubric.map((r) => (
        <div className="rubric-row" key={r.key}>
          <div>
            <strong>{r.label}</strong>
          </div>
          <div className="score-track" aria-hidden="true">
            <div style={{ width: `${(value.scores[r.key] / 3) * 100}%` }} />
          </div>
          <strong>
            {pre && <small>{pre.scores[r.key]} → </small>}
            {value.scores[r.key]} / 3
          </strong>
        </div>
      ))}
    </div>
  );
}
export function Assessment({ value }: { value: Evaluation }) {
  return (
    <>
      <div className="total-display">
        <strong>
          {totalScore(value.scores)}
          <span> / 12</span>
        </strong>
        <p>Your score for this answer.</p>
      </div>
      <Rubric value={value} />
      <RubricGuide />
      <div className="feedback-grid">
        <article>
          <span className="eyebrow">WHAT WORKED</span>
          <p>{value.strongestPart}</p>
        </article>
        <article>
          <span className="eyebrow">TRY NEXT</span>
          <p>{value.improvementArea}</p>
        </article>
      </div>
    </>
  );
}
export function Compare({
  pre,
  post,
  comparison,
  comparable = true,
}: {
  pre: Evaluation;
  post: Evaluation;
  comparison: Comparison;
  comparable?: boolean;
}) {
  const change = scoreChange(pre, post);
  return (
    <>
      <div className="comparison-hero">
        <div>
          <span>FIRST ANSWER</span>
          <strong>
            {totalScore(pre.scores)}
            <small> /12</small>
          </strong>
        </div>
        <ArrowRight size={30} />
        <div>
          <span>SECOND ANSWER</span>
          <strong>
            {totalScore(post.scores)}
            <small> /12</small>
          </strong>
        </div>
        {comparable && (
          <div className="change-badge">
            {change > 0 ? "+" : ""}
            {change}
            <small>point{Math.abs(change) !== 1 ? "s" : ""}</small>
          </div>
        )}
      </div>
      {!comparable && (
        <p className="score-comparability-note">
          Review settings changed, so these scores aren’t compared. Use the
          latest feedback for your next step.
        </p>
      )}
      <Rubric value={post} pre={comparable ? pre : undefined} />
      <RubricGuide />
      <details className="reflection-details comparison-feedback">
        <summary>What changed in this answer</summary>
        <div className="feedback-grid">
          <article>
            <span className="eyebrow">WHAT CHANGED</span>
            <ol>
              {comparison.improvements.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </article>
          <article>
            <span className="eyebrow">YOUR NEXT STEP</span>
            <p>{comparison.nextStep}</p>
          </article>
        </div>
      </details>
    </>
  );
}

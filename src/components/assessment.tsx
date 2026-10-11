import { rubric } from "@/config/strands";
import {
  totalScore,
  scoreChange,
  type Evaluation,
  type Comparison,
} from "@/lib/validation";
import { ArrowRight } from "lucide-react";
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
            <span>{r.definition}</span>
          </div>
          <div className="score-track">
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
        <p>A starting point for your next step.</p>
      </div>
      <Rubric value={value} />
      <div className="feedback-grid">
        <article>
          <span className="eyebrow">STRONGEST PART</span>
          <p>{value.strongestPart}</p>
        </article>
        <article>
          <span className="eyebrow">MOST IMPORTANT IMPROVEMENT</span>
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
}: {
  pre: Evaluation;
  post: Evaluation;
  comparison: Comparison;
}) {
  const change = scoreChange(pre, post);
  return (
    <>
      <div className="comparison-hero">
        <div>
          <span>PRE-ASSESSMENT</span>
          <strong>
            {totalScore(pre.scores)}
            <small> /12</small>
          </strong>
        </div>
        <ArrowRight size={30} />
        <div>
          <span>POST-ASSESSMENT</span>
          <strong>
            {totalScore(post.scores)}
            <small> /12</small>
          </strong>
        </div>
        <div className="change-badge">
          {change > 0 ? "+" : ""}
          {change}
          <small>point{Math.abs(change) !== 1 ? "s" : ""}</small>
        </div>
      </div>
      <Rubric value={post} pre={pre} />
      <div className="feedback-grid">
        <article>
          <span className="eyebrow">TWO IMPROVEMENTS WE NOTICED</span>
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
    </>
  );
}

export function AnswerComparison({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  if (!before || !after) return null;
  return (
    <details className="answer-comparison">
      <summary>Compare both answers</summary>
      <p className="answer-comparison-intro">
        What became clearer? What would you change next time?
      </p>
      <div>
        <article>
          <h2>First answer</h2>
          <p>{before}</p>
        </article>
        <article>
          <h2>Second answer</h2>
          <p>{after}</p>
        </article>
      </div>
      <p className="answer-comparison-note">
        Your submitted text or transcription. AI can miss details; check its
        feedback against your real experience.
      </p>
    </details>
  );
}

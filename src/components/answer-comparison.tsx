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
      <summary>Compare your first and second answers</summary>
      <p className="answer-comparison-intro">
        Read both responses alongside the feedback. Which details became
        clearer, and what would you explain differently next time?
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
        These are the submitted texts or transcriptions. Check them against your
        own experience; an AI review can miss details.
      </p>
    </details>
  );
}

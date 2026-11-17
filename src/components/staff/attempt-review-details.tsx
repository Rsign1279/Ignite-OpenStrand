import type { Attempt } from "@/lib/analytics/model";
import { LEGACY_SCORING_VERSION } from "@/config/rubric-anchors";
export function AttemptReviewDetails({
  attempt,
}: {
  attempt: Pick<Attempt, "scoring_version" | "comparison">;
}) {
  return (
    <details className="attempt-review-details">
      <summary>Review details</summary>
      <dl>
        <div>
          <dt>Scoring method</dt>
          <dd>
            <code>{attempt.scoring_version ?? LEGACY_SCORING_VERSION}</code>
          </dd>
        </div>
        {attempt.comparison && (
          <>
            <div>
              <dt>Comparison method</dt>
              <dd>
                <code>{attempt.comparison.review_version}</code>
              </dd>
            </div>
            <div>
              <dt>Comparison saved</dt>
              <dd>
                <time dateTime={attempt.comparison.created_at}>
                  {new Date(attempt.comparison.created_at).toLocaleString(
                    "en-US",
                    { timeZone: "America/Chicago" },
                  )}{" "}
                  Central
                </time>
              </dd>
            </div>
            {attempt.comparison.pre_attempt_id && (
              <div>
                <dt>Paired first answer ID</dt>
                <dd>
                  <code>{attempt.comparison.pre_attempt_id}</code>
                </dd>
              </div>
            )}
          </>
        )}
      </dl>
    </details>
  );
}

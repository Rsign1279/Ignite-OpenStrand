import { rubric } from "@/config/strands";
import type { Comparison, StarScores } from "@/lib/validation";

// Comparison presentation changes independently from the numeric scoring policy.
export const COMPARISON_REVIEW_VERSION = "ignite-text-evidence-v1";

type SavedScores =
  | { before: StarScores; after: StarScores; comparable: true }
  | { comparable: false };

const MAX_EXCERPT = 180;
const MAX_CANDIDATES = 48;
const words = (text: string) =>
  text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
const wording = (text: string) => words(text).join(" ");

/** Every excerpt is a contiguous piece of the original text, never a rewrite. */
function excerpts(text: string) {
  const result: string[] = [];
  for (const sentence of text.match(
    /[^.!?。！？\n]+[.!?。！？]*|[.!?。！？]+/gu,
  ) ?? []) {
    let rest = sentence.trim();
    while (rest.length > MAX_EXCERPT) {
      const space = rest.lastIndexOf(" ", MAX_EXCERPT);
      let end = space > MAX_EXCERPT / 2 ? space : MAX_EXCERPT;
      // JSONB rejects a lone surrogate; never cut an emoji/code point in half.
      if (/[\uD800-\uDBFF]/u.test(rest[end - 1])) end--;
      result.push(rest.slice(0, end).trim());
      rest = rest.slice(end).trim();
    }
    if (rest) result.push(rest);
  }
  return [
    ...new Map(result.map((text) => [wording(text), text])).values(),
  ].filter((text) => wording(text));
}

function scoreObservation(scores?: SavedScores) {
  if (!scores) return undefined;
  if (!scores.comparable)
    return "The recorded scores use different review settings, so they are not compared.";
  const changes = rubric
    .filter(({ key }) => scores.before[key] !== scores.after[key])
    .map(
      ({ label, key }) =>
        `${label}: ${scores.before[key]} → ${scores.after[key]}`,
    );
  return changes.length
    ? `Recorded score changes — ${changes.join("; ")}.`
    : "The recorded STAR scores are unchanged.";
}

function overlap(before: string, after: string) {
  const first = new Set(words(before));
  const second = new Set(words(after));
  const shared = [...first].filter((word) => second.has(word)).length;
  return (2 * shared) / (first.size + second.size || 1);
}

/**
 * Shows observable wording and saved scores, not an inferred learning gain.
 * Sentence matching only selects excerpts; it cannot invent roles or outcomes.
 * This deliberately does not claim that a longer or different answer is better.
 */
export function buildEvidenceComparison(
  before: string,
  after: string,
  nextStep: string,
  scores?: SavedScores,
): Comparison {
  const scoreChange = scoreObservation(scores);
  if (wording(before) === wording(after))
    return {
      improvements: [
        "The two answers contain the same words; no different wording is shown.",
        scoreChange ??
          "No additional wording change is shown in the submitted answers.",
      ],
      nextStep,
    };

  const first = excerpts(before);
  const second = excerpts(after);
  const firstKeys = new Set(first.map(wording));
  const secondKeys = new Set(second.map(wording));
  const firstChanged = first.filter((text) => !secondKeys.has(wording(text)));
  const secondChanged = second.filter((text) => !firstKeys.has(wording(text)));
  if (!firstChanged.length && !secondChanged.length)
    return {
      improvements: [
        "The answers reuse the same passages; their order or repetition changed.",
        scoreChange ?? "No new passage was identified in the retry.",
      ],
      nextStep,
    };

  // Bound matching work even for a very fragmented 16,000-character transcript.
  const oldParts = (firstChanged.length ? firstChanged : first).slice(
    0,
    MAX_CANDIDATES,
  );
  const newParts = (secondChanged.length ? secondChanged : second).slice(
    0,
    MAX_CANDIDATES,
  );
  const candidates = oldParts.flatMap((oldText, oldIndex) =>
    newParts.flatMap((newText, newIndex) =>
      wording(oldText) === wording(newText)
        ? []
        : [
            {
              oldText,
              newText,
              oldIndex,
              newIndex,
              match: overlap(oldText, newText),
            },
          ],
    ),
  );
  candidates.sort(
    (a, b) =>
      b.match - a.match || a.oldIndex - b.oldIndex || a.newIndex - b.newIndex,
  );
  const usedBefore = new Set<number>();
  const usedAfter = new Set<number>();
  const changes: string[] = [];
  for (const pair of candidates) {
    if (usedBefore.has(pair.oldIndex) || usedAfter.has(pair.newIndex)) continue;
    changes.push(
      `First excerpt: “${pair.oldText}” Retry excerpt: “${pair.newText}”`,
    );
    usedBefore.add(pair.oldIndex);
    usedAfter.add(pair.newIndex);
    if (changes.length === 2) break;
  }
  if (!changes.length)
    changes.push(
      "The submitted wording differs, but no paired excerpt was identified.",
    );
  if (scoreChange && changes.length === 2)
    changes[0] = `${scoreChange} ${changes[0]}`;
  return {
    improvements: [
      changes[0],
      changes[1] ??
        scoreChange ??
        "No second distinct wording change was identified.",
    ],
    // Keep the committed assessment's actual next step, including on recovery.
    nextStep,
  };
}

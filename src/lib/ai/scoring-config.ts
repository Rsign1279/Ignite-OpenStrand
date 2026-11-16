import "server-only";
import { RUBRIC_SCORING_VERSION } from "@/config/rubric-anchors";

export const SCORING_TEMPERATURE = 0.1;
export const getScoringModel = () =>
  process.env.GROQ_MODEL || "openai/gpt-oss-120b";
export const getScoringVersion = () =>
  `${RUBRIC_SCORING_VERSION}|groq:${getScoringModel()}|temperature:${SCORING_TEMPERATURE}`;

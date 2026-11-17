import {
  buildQuestionBank,
  legacyQuestions,
  type PracticeQuestion,
} from "./question-bank";
export const strandIds = [
  "technology",
  "health-sciences",
  "law-public-policy",
  "aviation",
  "culinary",
  "engineering",
  "construction",
  "education",
  "business",
  "digital-media",
] as const;
export type StrandId = (typeof strandIds)[number];
const experiences =
  "IGNITE projects, client work, school activities, team projects, leadership, clubs, volunteering, employment, or personal projects";
const definitions = [
  ["Technology", "Technology Hiring Manager", "Code"],
  ["Health Sciences", "Clinical Team Leader", "HeartPulse"],
  ["Law - Public Policy", "Public Policy Director", "Scale"],
  ["Aviation - Air Mobility", "Aviation Operations Leader", "Plane"],
  ["Culinary Arts", "Executive Chef", "ChefHat"],
  ["Engineering - Industrial Design", "Engineering Manager", "Settings"],
  ["Construction Management", "Construction Superintendent", "HardHat"],
  ["Education Innovation", "School Principal", "GraduationCap"],
  ["Global Business", "Business Manager", "BriefcaseBusiness"],
  ["Digital Media", "Creative Director", "Clapperboard"],
] as const;
export const strands = strandIds.map((id, i) => ({
  id,
  name: definitions[i][0],
  shortName: definitions[i][0],
  interviewerTitle: definitions[i][1],
  icon: definitions[i][2],
  context:
    id === "education"
      ? "You are a school principal interviewing the student for a supervised education student learning placement. The student is a high-school student in the IGNITE Education Innovation program, without assumed teaching credentials or full-time teaching experience. Examples may come from IGNITE, classroom observations, work with learners, client projects, team projects, leadership, employment, or volunteering."
      : `Interview a high-school IGNITE ${definitions[i][0]} student, without assuming professional experience. Accept examples from ${experiences}.`,
  primaryQuestion:
    id === "education" ? legacyQuestions.education : legacyQuestions.general,
  transferPrompt: `Ask ONE new behavioral question a ${definitions[i][1]} would realistically ask an entry-level candidate. Appropriate for a high-school student; accept ${experiences}. Do not mention STAR or coach. Do not repeat the primary question.`,
  allowedExperiences: experiences,
  questions: buildQuestionBank(id),
}));
export const rubric = [
  {
    key: "situation",
    label: "S — Situation",
    definition: "Clearly explain the setting and problem.",
  },
  {
    key: "task",
    label: "T — Task",
    definition: "Clearly explain your goal and responsibility.",
  },
  {
    key: "action",
    label: "A — Action",
    definition: "Clearly explain what you personally did and how or why.",
  },
  {
    key: "result",
    label: "R — Result",
    definition:
      "Clearly connect your actions to an outcome, feedback, or learning.",
  },
] as const;
// Historical scores retain their original meaning; never infer a Task score.
export const legacyRubric = [
  {
    key: "situationTask",
    label: "Situation & Task",
    definition: "Situation and task are specific and understandable",
  },
  {
    key: "personalActions",
    label: "Personal Actions",
    definition: "Actions clearly explain what I personally did",
  },
  {
    key: "resultImpact",
    label: "Result / Impact",
    definition: "Result includes an outcome, impact, feedback, or learning",
  },
  {
    key: "professionalCommunication",
    label: "Communication",
    definition:
      "Response is relevant, specific, and professionally communicated",
  },
] as const;
export const getStrand = (id: StrandId) => strands.find((s) => s.id === id)!;

export function getPracticeQuestion(
  id: StrandId,
  questionId?: string,
): PracticeQuestion {
  const strand = getStrand(id);
  const legacyId =
    id === "education" ? "education-primary-v1" : "general-primary-v1";
  if (!questionId || questionId === legacyId)
    return {
      id: legacyId,
      topic: "When plans change",
      text: strand.primaryQuestion,
    };
  const question = strand.questions.find((q) => q.id === questionId);
  if (!question) throw new Error("Unknown practice question");
  return question;
}

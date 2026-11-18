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
    letter: "S",
    title: "Situation",
    label: "S — Situation",
    definition:
      "Clearly explain the situation so your interviewer understands the context, without needing every detail.",
    lessonQuestion: "What was happening?",
    lessonText: "Give only the context your interviewer needs.",
  },
  {
    key: "task",
    letter: "T",
    title: "Task",
    label: "T — Task",
    definition:
      "Clearly state the task, problem, or challenge you took responsibility for, or the goal of your efforts.",
    lessonQuestion: "What were you responsible for?",
    lessonText:
      "Name the task, challenge, or goal you took responsibility for.",
  },
  {
    key: "action",
    letter: "A",
    title: "Action",
    label: "A — Action",
    definition:
      "Clearly describe the actions you personally took toward the task or goal, showing skills or character traits relevant to the question.",
    lessonQuestion: "What specifically did YOU do?",
    lessonText:
      "Explain your own steps and the relevant skills or character traits they demonstrate.",
  },
  {
    key: "result",
    letter: "R",
    title: "Result",
    label: "R — Result",
    definition:
      "Clearly explain the results of your actions, using quantifiable evidence when available and sharing learning or key takeaways where relevant.",
    lessonQuestion: "What happened or what did you learn?",
    lessonText:
      "Share the outcome, real numbers when available, and a useful takeaway.",
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

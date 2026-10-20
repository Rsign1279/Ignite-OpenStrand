import type { StrandId } from "./strands";
export const questionTopics = [
  ["teamwork", "Teamwork"],
  ["challenge", "Unexpected challenges"],
  ["feedback", "Using feedback"],
  ["learning", "Learning quickly"],
  ["priorities", "Managing responsibilities"],
  ["mistake", "Learning from mistakes"],
  ["initiative", "Taking initiative"],
  ["perspectives", "Different perspectives"],
  ["adaptability", "When plans change"],
  ["achievement", "A proud accomplishment"],
] as const;
export const legacyQuestions = {
  education:
    "Tell me about a time when a lesson, activity, project, or plan did not go as expected. What did you do?",
  general:
    "Tell me about a time when a project, task, activity, or plan did not go as expected. What did you do?",
};
export type PracticeQuestion = { id: string; topic: string; text: string };
// Contexts are deliberately student-level: projects, observations and simulations,
// never assumed employment, clinical credentials or professional responsibilities.
const contexts: Record<
  StrandId,
  {
    project: string;
    work: string;
    skill: string;
    tasks: string;
    process: string;
    collaborator: string;
    goal: string;
  }
> = {
  technology: {
    project: "a technology or coding project",
    work: "a program, website, or technology project",
    skill: "tool, programming concept, or technical skill",
    tasks: "technology project tasks and other responsibilities",
    process:
      "a technology project or the way your team solved a technical problem",
    collaborator: "a teammate or someone using your technology project",
    goal: "build, troubleshoot, or improve something using technology",
  },
  "health-sciences": {
    project: "a health sciences project, observation, or simulated activity",
    work: "a health sciences project or simulated care activity",
    skill:
      "health sciences concept, procedure in a simulation, or communication skill",
    tasks: "health sciences activities and other responsibilities",
    process: "a health sciences project, simulation, or team activity",
    collaborator:
      "a teammate, instructor, or person you helped during a health-related activity",
    goal: "complete a health sciences project or support a health-related activity",
  },
  "law-public-policy": {
    project: "a law, public policy, or civic project",
    work: "a policy proposal, presentation, or mock legal activity",
    skill: "legal concept, policy issue, or research skill",
    tasks: "research, presentations, and other responsibilities",
    process: "a civic project, research process, or mock legal activity",
    collaborator:
      "someone with a different opinion about a legal, policy, or community issue",
    goal: "research an issue, develop a proposal, or complete a mock legal activity",
  },
  aviation: {
    project: "an aviation, air mobility, or flight simulation project",
    work: "an aviation project, presentation, or simulated flight activity",
    skill: "aviation concept, flight simulation tool, or planning skill",
    tasks: "aviation project tasks, preparation, and other responsibilities",
    process: "an aviation project, simulation, or team planning process",
    collaborator:
      "a teammate or instructor during an aviation or air mobility activity",
    goal: "complete an aviation project, simulation, or air mobility activity",
  },
  culinary: {
    project: "a cooking activity, menu project, or culinary event",
    work: "a dish, menu, or culinary project",
    skill: "cooking technique, recipe, or kitchen organization skill",
    tasks: "food preparation, timing, cleanup, and other responsibilities",
    process: "a culinary project, kitchen workflow, or team cooking activity",
    collaborator:
      "a teammate or someone with different food preferences or ideas",
    goal: "prepare a dish, plan a menu, or carry out a culinary activity",
  },
  engineering: {
    project: "an engineering, industrial design, or prototype project",
    work: "a design, prototype, or engineering project",
    skill: "design tool, engineering concept, or prototyping technique",
    tasks: "design work, testing, and other responsibilities",
    process: "a design, prototype, or engineering team's process",
    collaborator: "a teammate or someone giving input on a design",
    goal: "design, build, or test a solution to a problem",
  },
  construction: {
    project:
      "a construction planning, building, or site-related learning project",
    work: "a project plan, model, or construction-related activity",
    skill:
      "construction concept, planning tool, or building technique in a supervised activity",
    tasks: "planning, project tasks, and other responsibilities",
    process: "a construction-related project, plan, or team workflow",
    collaborator:
      "a teammate or instructor with a different idea about a construction-related project",
    goal: "plan, organize, or complete a construction-related project",
  },
  education: {
    project: "a lesson, learner activity, or education project",
    work: "a lesson, activity, or work with learners",
    skill: "teaching strategy, learning tool, or way to support a learner",
    tasks: "lesson preparation, work with learners, and other responsibilities",
    process: "a learner activity, education project, or team's work",
    collaborator:
      "a learner, teammate, or educator who saw a situation differently",
    goal: "support learners or complete an education project",
  },
  business: {
    project: "a business, entrepreneurship, or client project",
    work: "a business proposal, presentation, or client project",
    skill: "business concept, research tool, or presentation skill",
    tasks: "client project tasks, deadlines, and other responsibilities",
    process: "a business project, team process, or customer experience",
    collaborator:
      "a teammate, client, or someone with a different business perspective",
    goal: "develop a business idea, meet a client need, or complete a business project",
  },
  "digital-media": {
    project: "a video, design, photography, or media production project",
    work: "a creative piece, media draft, or production project",
    skill: "editing tool, design technique, or media production skill",
    tasks: "creative work, production deadlines, and other responsibilities",
    process: "a creative project, production workflow, or team's work",
    collaborator:
      "a teammate, client, or someone with a different creative perspective",
    goal: "create a video, design, story, or other media project",
  },
};
export function buildQuestionBank(strand: StrandId): PracticeQuestion[] {
  const c = contexts[strand];
  const text = [
    `Tell me about a time you worked with a team to ${c.goal}. What was your contribution?`,
    `Tell me about a time you faced an unexpected challenge during ${c.project}. What did you do?`,
    `Describe a time you received feedback on ${c.work} and used it to improve.`,
    `Tell me about a time you had to learn a new ${c.skill} quickly. How did you approach it?`,
    `Describe a time you had to manage ${c.tasks} or competing deadlines. How did you handle it?`,
    `Tell me about a time you made a mistake while working on ${c.work}. How did you handle it?`,
    `Give me an example of a time you took initiative to improve ${c.process} without being asked.`,
    `Tell me about a time you had to communicate with ${c.collaborator}. How did you work through your different perspectives?`,
    strand === "education"
      ? legacyQuestions.education
      : `Describe a time ${c.project} did not go according to plan. How did you respond?`,
    `Tell me about an accomplishment you are proud of from ${c.project}. What was your contribution?`,
  ];
  return questionTopics.map(([key, topic], i) => ({
    id:
      strand === "education" && key === "adaptability"
        ? "education-primary-v1"
        : `${strand}-${key}-v1`,
    topic,
    text: text[i],
  }));
}

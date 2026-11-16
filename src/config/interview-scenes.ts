import { questionTopics, type PracticeQuestion } from "./question-bank";
import type { StrandId } from "./strands";

export type InterviewRound = "PRE" | "POST" | "TRANSFER";
export type TopicKey = (typeof questionTopics)[number][0];

export type InterviewSetting = {
  place: string;
  opportunity: string;
  arrival: string;
  detail: string;
  object: string;
  accent: string;
  atmosphere: string;
};

// These are fictional practice settings, never a claim about a real employer.
// Students are candidates: none of the scenes assumes professional credentials.
export const interviewSettings: Record<StrandId, InterviewSetting> = {
  technology: {
    place: "The product lab",
    opportunity: "Student technology internship",
    arrival:
      "You enter a product lab. A prototype display is ready for the team’s next usability test.",
    detail:
      "This imagined internship helps a team test a student-facing app. The hiring manager wants to hear how you learn, solve problems, and contribute.",
    object: "A prototype interface display",
    accent: "#a7c9ff",
    atmosphere: "Curious minds. Real possibilities.",
  },
  "health-sciences": {
    place: "The simulation briefing room",
    opportunity: "Supervised health sciences placement",
    arrival:
      "You enter a simulation briefing room, where an empty training bed is ready for supervised practice.",
    detail:
      "This placement supports supervised simulation activities, without patient-care credentials. The clinical team leader wants to understand how you learn and work with people.",
    object: "An empty simulation station",
    accent: "#a1dfd1",
    atmosphere: "Care begins with connection.",
  },
  "law-public-policy": {
    place: "The civic research room",
    opportunity: "Student civic research internship",
    arrival:
      "You enter a civic research room. A neighborhood map anchors plans for a community project.",
    detail:
      "This imagined role helps a team research community needs. The public policy director wants to hear how you listen, weigh ideas, and follow through.",
    object: "A neighborhood map",
    accent: "#c9b9ef",
    atmosphere: "Different voices. Shared purpose.",
  },
  aviation: {
    place: "The flight-training briefing room",
    opportunity: "Supervised aviation student placement",
    arrival:
      "You enter a flight-training briefing room. An aircraft is parked outside as the team plans supervised training.",
    detail:
      "This placement supports training preparation, without assuming pilot credentials. The aviation operations leader wants to hear how you prepare, communicate, and learn.",
    object: "An aircraft beyond the briefing-room window",
    accent: "#a6d7ec",
    atmosphere: "A new perspective starts here.",
  },
  culinary: {
    place: "The chef's table",
    opportunity: "Supervised culinary student placement",
    arrival:
      "You enter a teaching kitchen. The practice counters are ready for a supervised team service.",
    detail:
      "This placement joins a supervised team service. The executive chef wants to hear how you prepare, respond to feedback, and work with others.",
    object: "A teaching kitchen beyond the table",
    accent: "#efbf99",
    atmosphere: "Preparation meets possibility.",
  },
  engineering: {
    place: "The prototype workshop",
    opportunity: "Student design and engineering internship",
    arrival:
      "You enter a prototype workshop. Sketches and tools are ready for the team’s next materials review.",
    detail:
      "This imagined internship supports comparing materials and refining a physical prototype. The engineering manager wants to hear how you think through problems and learn from revisions.",
    object: "Design sketches and workshop tools",
    accent: "#bccaa0",
    atmosphere: "Every great idea starts somewhere.",
  },
  construction: {
    place: "The site-planning office",
    opportunity: "Supervised construction student placement",
    arrival:
      "You enter a site-planning office. Blueprints and a scale structure support the next project briefing.",
    detail:
      "This placement supports supervised project planning. The construction superintendent wants to hear how you take responsibility, communicate changes, and work with a team.",
    object: "A scale structure and project plans",
    accent: "#eac68e",
    atmosphere: "Build the foundation for what's next.",
  },
  education: {
    place: "The learning commons",
    opportunity: "Supervised education student placement",
    arrival:
      "You enter a learning commons, where learner projects and books set the scene for planning classroom support.",
    detail:
      "This placement supports learners under supervision, without assuming teaching credentials. The principal wants to hear what your experiences have taught you about learning and helping others.",
    object: "Learner projects on display",
    accent: "#edc995",
    atmosphere: "Your story can inspire the next one.",
  },
  business: {
    place: "The venture briefing suite",
    opportunity: "Student business internship",
    arrival:
      "You enter a venture briefing suite. A pitch display is ready for the team's next client project.",
    detail:
      "This imagined internship supports a team's client project. The business manager wants to hear how you organize work, contribute ideas, and follow through.",
    object: "A venture pitch display",
    accent: "#b7c6f2",
    atmosphere: "Big possibilities. Your first step.",
  },
  "digital-media": {
    place: "The production suite",
    opportunity: "Student creative production internship",
    arrival:
      "You enter a production suite. A storyboard and edit station are ready for a student production review.",
    detail:
      "This imagined internship supports a student production. The creative director wants to hear about your ideas, collaboration, and response to creative feedback.",
    object: "A storyboard beside the edit station",
    accent: "#dfb7de",
    atmosphere: "Find the story only you can tell.",
  },
};

type TopicStory = {
  title: string;
  beat: string;
  intention: string;
  prompts: readonly [string, string, string, string];
  takeaway: string;
};

export const topicStories: Record<TopicKey, TopicStory> = {
  teamwork: {
    title: "A place on the team",
    beat: "Your interviewer glances toward the project table. They want to hear about your place on a team.",
    intention:
      "Show the difference your own contribution made to a shared goal.",
    prompts: [
      "Which team and shared goal will you describe?",
      "What was your own responsibility?",
      "What did you do to help the team move forward?",
      "What changed because of your contribution?",
    ],
    takeaway:
      "A team story becomes your story when your contribution is clear.",
  },
  challenge: {
    title: "The unexpected moment",
    beat: "The interviewer mentions a project surprise, then gives you a moment to recall a challenge.",
    intention: "Explain how you responded when something became difficult.",
    prompts: [
      "What unexpected problem came up?",
      "What needed to happen, and what was your part?",
      "What steps did you take to deal with it?",
      "What was the outcome or lesson?",
    ],
    takeaway:
      "The challenge sets up the story. Your response is the part that matters most.",
  },
  feedback: {
    title: "A different point of view",
    beat: "A marked-up draft rests on the table. The conversation turns to how you use feedback.",
    intention: "Connect feedback you received to a specific change you made.",
    prompts: [
      "What were you working on when you received feedback?",
      "What were you trying to improve?",
      "What did you change after listening?",
      "How did the work improve, or what did you learn?",
    ],
    takeaway: "Receiving feedback is the start. Explain what you did with it.",
  },
  learning: {
    title: "Something you haven't tried yet",
    beat: "The interviewer describes joining a new team, then asks how you approach something unfamiliar.",
    intention:
      "Make your learning process visible, from first step to application.",
    prompts: [
      "What unfamiliar skill or idea did you need to learn?",
      "Why did you need it at that time?",
      "How did you practice, find help, or check your understanding?",
      "How did you use what you learned?",
    ],
    takeaway: "You do not have to know everything. Show how you learn.",
  },
  priorities: {
    title: "More than one moving piece",
    beat: "A calendar reminder appears. The interviewer silences it and turns to balancing responsibilities.",
    intention:
      "Explain the choices you made when time or resources were limited.",
    prompts: [
      "Which responsibilities were competing for your time?",
      "What deadlines or commitments were yours?",
      "How did you decide what to do first and communicate your plan?",
      "What did you complete, or what would you change next time?",
    ],
    takeaway:
      "A list of tasks is context. Your decisions show how you managed them.",
  },
  mistake: {
    title: "A moment to own",
    beat: "The interviewer closes their notebook. Everyone makes mistakes; they want to hear how you responded.",
    intention: "Show ownership, a response, and something you learned.",
    prompts: [
      "What mistake happened, and what was the context?",
      "Which part were you responsible for?",
      "What did you do to acknowledge or address the mistake?",
      "What happened, or what would you do differently next time?",
    ],
    takeaway:
      "Choose an honest example. Responsibility and learning matter more than a perfect outcome.",
  },
  initiative: {
    title: "The step nobody assigned",
    beat: "A wall of project ideas catches the interviewer's eye. The conversation turns to an improvement you noticed.",
    intention: "Explain what you noticed and the action you chose to take.",
    prompts: [
      "What opportunity or problem did you notice?",
      "What improvement did you want to make?",
      "What did you choose to do without being asked?",
      "Who benefited, or what did you learn from trying?",
    ],
    takeaway:
      "Initiative can be small. Suggesting a change or checking an idea with a teacher or supervisor can be a valid example. Explain what you chose to do.",
  },
  perspectives: {
    title: "Seeing it another way",
    beat: "The interviewer recalls two views of a project. They want to hear how you listened.",
    intention: "Describe how you listened and worked through a difference.",
    prompts: [
      "Who saw the situation differently, and why?",
      "What did you need to work out together?",
      "How did you listen, explain, or adjust your approach?",
      "What understanding or outcome did you reach?",
    ],
    takeaway:
      "You do not need to win the disagreement. Explain how you handled the conversation.",
  },
  adaptability: {
    title: "When the plan changes",
    beat: "The interviewer sets a project notebook aside. The conversation turns to a time your plan changed.",
    intention:
      "Connect a change in circumstances to a change in your approach.",
    prompts: [
      "What was the original plan, and what changed?",
      "What were you responsible for when it changed?",
      "How did you adjust your approach or help others adapt?",
      "What happened, and what would you carry forward?",
    ],
    takeaway: "Make the turning point clear, then explain what you changed.",
  },
  achievement: {
    title: "Your moment to share",
    beat: "The interviewer smiles and leans back. There’s time to share a contribution you’re proud of.",
    intention:
      "Connect something you are proud of to your own effort and impact.",
    prompts: [
      "What accomplishment will you describe?",
      "What goal or responsibility did you take on?",
      "What did you personally do to make it happen?",
      "What made the outcome meaningful to you or someone else?",
    ],
    takeaway:
      "You can be proud of a small achievement. Explain why it mattered.",
  },
};

export function getQuestionTopic(question: PracticeQuestion): TopicKey {
  return (
    questionTopics.find(([, label]) => label === question.topic)?.[0] ??
    "adaptability"
  );
}

export function getInterviewScene(
  strand: StrandId,
  question: PracticeQuestion,
  round: InterviewRound,
) {
  const setting = interviewSettings[strand];
  const topic = topicStories[getQuestionTopic(question)];
  const opening =
    round === "PRE"
      ? setting.arrival
      : round === "POST"
        ? `You return to ${setting.place.toLowerCase()} for the same question. Use your feedback to tell the story again.`
        : `In ${setting.place.toLowerCase()}, the interviewer turns to a fresh page. Try a different experience for this new question.`;
  return { ...setting, ...topic, opening, questionId: question.id, round };
}

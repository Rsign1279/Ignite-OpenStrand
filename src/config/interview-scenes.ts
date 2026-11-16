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
    place: "The product studio",
    opportunity: "Student technology internship",
    arrival:
      "You enter a product studio, where a prototype glows on a monitor.",
    detail:
      "Your interviewer closes their laptop and turns their chair toward you. For the next few minutes, the focus is on your experience.",
    object: "A prototype on the screen",
    accent: "#a7c9ff",
    atmosphere: "Curious minds. Real possibilities.",
  },
  "health-sciences": {
    place: "The learning center",
    opportunity: "Health sciences student placement",
    arrival:
      "You enter a health sciences learning center as students prepare for a supervised simulation.",
    detail:
      "The clinical team leader sets a training folder aside and welcomes you. They want to understand how you learn and work with people.",
    object: "A simulation schedule",
    accent: "#a1dfd1",
    atmosphere: "Care begins with connection.",
  },
  "law-public-policy": {
    place: "The civic meeting room",
    opportunity: "Student civic research internship",
    arrival:
      "You enter a civic meeting room, with community proposals and a neighborhood map on the wall.",
    detail:
      "The public policy director puts down a stack of research notes and offers you a seat. They are interested in the person behind your application.",
    object: "Community plans on the wall",
    accent: "#c9b9ef",
    atmosphere: "Different voices. Shared purpose.",
  },
  aviation: {
    place: "The aviation training hub",
    opportunity: "Aviation student learning opportunity",
    arrival:
      "You arrive at an aviation training hub. A simulator hums beside the quiet training apron.",
    detail:
      "The aviation operations leader checks the time, then gives you their full attention. This conversation is about your experiences as a student.",
    object: "A training flight plan",
    accent: "#a6d7ec",
    atmosphere: "A new perspective starts here.",
  },
  culinary: {
    place: "The chef's table",
    opportunity: "Supervised culinary student placement",
    arrival:
      "You enter a teaching kitchen, its workstations ready and a seasonal menu by the door.",
    detail:
      "The executive chef joins you at a small table away from the kitchen noise. They want to hear how you approach learning, preparation, and working with others.",
    object: "A seasonal menu",
    accent: "#efbf99",
    atmosphere: "Preparation meets possibility.",
  },
  engineering: {
    place: "The design workshop",
    opportunity: "Student design and engineering internship",
    arrival:
      "You enter a design workshop, with prototypes and a notebook of revisions on the project table.",
    detail:
      "The engineering manager clears a space at the project table and welcomes you. They are curious about how you think, test, and learn.",
    object: "A prototype in progress",
    accent: "#bccaa0",
    atmosphere: "Every great idea starts somewhere.",
  },
  construction: {
    place: "The project planning room",
    opportunity: "Supervised construction student placement",
    arrival:
      "You enter a planning room beside a supervised training site, with a model and plans on the table.",
    detail:
      "The construction superintendent sets the plans aside and offers you a seat. They want to know how you take responsibility and work with a team.",
    object: "Plans for the next project",
    accent: "#eac68e",
    atmosphere: "Build the foundation for what's next.",
  },
  education: {
    place: "The school meeting room",
    opportunity: "Education student learning placement",
    arrival:
      "You arrive after the school bell. Student projects line the hall outside your meeting room.",
    detail:
      "The principal places a lesson-planning notebook on the table and welcomes you. They know you are a student and want to hear what your experiences have taught you.",
    object: "Learner projects on display",
    accent: "#edc995",
    atmosphere: "Your story can inspire the next one.",
  },
  business: {
    place: "The venture studio",
    opportunity: "Student business internship",
    arrival:
      "You enter a venture studio, where the team's next client ideas fill a whiteboard.",
    detail:
      "The business manager puts their phone away and invites you to sit across the table. They want to hear what you bring to a team.",
    object: "Ideas for a new venture",
    accent: "#b7c6f2",
    atmosphere: "Big possibilities. Your first step.",
  },
  "digital-media": {
    place: "The creative studio",
    opportunity: "Student creative production internship",
    arrival:
      "You enter a creative studio, with a storyboard and a paused student production on screen.",
    detail:
      "The creative director turns away from the edit and welcomes you. They are interested in the thinking and collaboration behind your work.",
    object: "A story waiting to be told",
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

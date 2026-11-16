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
      "You step into a bright product studio. A prototype is open on a monitor, and a small team is sketching ideas beyond the glass wall.",
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
      "You arrive at a health sciences learning center. Beyond the meeting room, students are preparing for a supervised simulation.",
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
      "You walk into a civic organization's meeting room. Community proposals and a map of the neighborhood cover one wall.",
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
      "You arrive at an aviation training hub. A flight simulator hums in the next room, and the windows overlook a quiet training apron.",
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
      "You enter a culinary teaching kitchen before the afternoon session. The workstations are ready, and a seasonal menu is pinned by the door.",
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
      "You step into a design workshop. Prototypes line a shelf, and a half-built model sits next to a notebook full of revisions.",
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
      "You arrive at a project planning room beside a supervised training site. A building model sits between rolled plans and a marked-up schedule.",
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
      "You arrive at a school just after the morning bell. Student projects fill the hallway outside a small, sunlit meeting room.",
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
      "You walk into a small venture studio. A team has just finished a presentation, and a whiteboard is filled with ideas for their next client project.",
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
      "You step into a creative studio. A storyboard is spread across a table, and a recent student production is paused on a large screen.",
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
    beat: "The conversation turns to working with others. The interviewer glances at the shared project table, then back at you. They have a question about a team you have been part of.",
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
    beat: "The interviewer mentions that even well-planned projects can bring surprises. They pause, giving you space to think back to a challenge of your own.",
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
    beat: "The interviewer sets a marked-up draft on the table. They mention that ideas often get better through another person's perspective. The next part of the conversation is about feedback.",
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
    beat: "The interviewer smiles as they describe how much there is to learn when joining a new team. They are about to ask about a time you faced something unfamiliar.",
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
    beat: "A calendar reminder lights up on the interviewer's screen. They silence it and return their attention to you. The conversation moves to balancing responsibilities when several things need your attention.",
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
    beat: "The interviewer closes their notebook for a moment. They explain that everyone makes mistakes while learning. Their next question gives you a chance to talk about one of yours.",
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
    beat: "The interviewer looks toward a wall of project ideas. They mention that useful improvements sometimes begin with someone simply noticing an opportunity. They turn back to you with a question.",
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
    beat: "The interviewer mentions a recent discussion where the team saw the same problem in different ways. They are interested in a conversation you have had with someone whose perspective differed from yours.",
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
    beat: "The interviewer slides a project notebook to one side. They mention that real work rarely follows the first plan exactly. The next question asks you to draw on a time things changed.",
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
    beat: "The interviewer leans back slightly and smiles. There is time for a story you feel good about. They want to hear about something you are proud to have contributed to.",
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
        ? `You settle back into ${setting.place.toLowerCase()}. The interviewer welcomes you back for another take on the same question. You have had time to reflect; now you can tell the story again in your own words.`
        : `The conversation continues in ${setting.place.toLowerCase()}. The interviewer turns to a fresh page in their notebook. A new question is a chance to practice with a different experience.`;
  return { ...setting, ...topic, opening, questionId: question.id, round };
}

"use client";
import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  ArrowUpRight,
  Target,
  MapPin,
  ArrowLeft,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { StrandIcon } from "@/components/strand-icon";
import { AnswerRecorder } from "@/components/answer-recorder";
import { Assessment, Compare } from "@/components/assessment";
import { InterviewScene } from "@/components/interview-scene";
import { QuestionLibrary } from "@/components/question-library";
import {
  StarLesson,
  StoryNotesPanel,
  emptyStoryNotes,
  type StoryNotes,
} from "@/components/star-lesson";
import { InterviewRoom } from "@/components/interview-room";
import {
  interviewSettings,
  getQuestionTopic,
  topicStories,
} from "@/config/interview-scenes";
import { strands, getStrand, type StrandId } from "@/config/strands";
import {
  profileSchema,
  type Profile,
  type Evaluation,
  type Comparison,
  scoreChange,
} from "@/lib/validation";
import { transition, type Stage } from "@/lib/machine";
import { browserClient } from "@/lib/supabase/browser";
import { studentAccessMessage } from "@/lib/student-access-errors";
import { api } from "@/lib/client-api";
import { onSessionChange } from "@/lib/session-events";
import {
  SESSION_CHANGED_MESSAGE,
  STUDENT_SESSION_HEADER,
} from "@/lib/student-session";
import { PracticePlan } from "@/components/practice-plan";
import { RevisionGoalReminder } from "@/components/revision-goal-reminder";
import { AnswerComparison } from "@/components/answer-comparison";
import {
  readSessionMarker,
  writeSessionMarker,
  clearSessionMarkers,
} from "@/lib/session-markers";
import {
  PracticeReflection,
  QuestionGrowth,
} from "@/components/practice-reflection";
import {
  createRevisionGoal,
  recommendPracticeQuestion,
  type PracticeAttempt,
  type PracticeRevisionGoal,
} from "@/lib/practice-learning";
const subscribeToClientReady = () => () => {};
export function InterviewApp() {
  const clientReady = useSyncExternalStore(
    subscribeToClientReady,
    () => true,
    () => false,
  );
  const [stage, setStage] = useState<Stage>("PROFILE");
  const stageRef = useRef<Stage>("PROFILE");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [strand, setStrand] = useState<StrandId | "">("");
  const [year, setYear] = useState<1 | 2 | undefined>();
  const [busy, setBusy] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [pre, setPre] = useState<Evaluation>();
  const [post, setPost] = useState<Evaluation>();
  const [comparison, setComparison] = useState<Comparison>();
  const [comparisonComparable, setComparisonComparable] = useState(true);
  const [transfer, setTransfer] = useState<Evaluation>();
  const [question, setQuestion] = useState("");
  const [practiceQuestionId, setPracticeQuestionId] = useState("");
  const [storyNotes, setStoryNotes] = useState<StoryNotes>(emptyStoryNotes);
  const [completedQuestions, setCompletedQuestions] = useState<string[]>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [attemptHistory, setAttemptHistory] = useState<PracticeAttempt[]>([]);
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [firstAnswer, setFirstAnswer] = useState("");
  const [practiceRetry, setPracticeRetry] = useState(false);
  const [revisionGoal, setRevisionGoal] = useState<PracticeRevisionGoal>();
  const main = useRef<HTMLElement>(null);
  const lastStage = useRef<Stage>("PROFILE");
  const authEpoch = useRef(0);
  const studentSessionId = useRef<string | null>(null);
  const [sessionIdentity, setSessionIdentity] = useState<string>();
  const authMutation = useRef(false);
  const evaluationRequest = useRef<AbortController | null>(null);
  const preTranscript = useRef("");
  const attemptRequests = useRef<
    Record<string, { id: string; answer: string }>
  >({});
  const clearStudentState = useCallback((message = "") => {
    authEpoch.current++;
    studentSessionId.current = null;
    setSessionIdentity(undefined);
    evaluationRequest.current?.abort();
    evaluationRequest.current = null;
    preTranscript.current = "";
    attemptRequests.current = {};
    clearSessionMarkers();
    setPre(undefined);
    setPost(undefined);
    setComparison(undefined);
    setTransfer(undefined);
    setQuestion("");
    setPracticeQuestionId("");
    setStoryNotes(emptyStoryNotes);
    setCompletedQuestions([]);
    setAnswerCount(0);
    setAttemptHistory([]);
    setSubmittedAnswer("");
    setFirstAnswer("");
    setPracticeRetry(false);
    setRevisionGoal(undefined);
    setProfile(null);
    setName("");
    setStrand("");
    setYear(undefined);
    stageRef.current = "PROFILE";
    setStage("PROFILE");
    lock.current = false;
    setBusy(false);
    setEndingSession(false);
    setError(message);
    window.speechSynthesis?.cancel();
  }, []);
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("strand");
    let active = true;
    const initialEpoch = authEpoch.current;
    const controller = new AbortController();
    let unsubscribe: (() => void) | undefined;
    let observedIdentity: string | null | undefined;
    const stopSessionNotices = onSessionChange(() => {
      if (active && !authMutation.current)
        clearStudentState(SESSION_CHANGED_MESSAGE);
    });
    Promise.resolve().then(() => {
      if (active && strands.some((s) => s.id === selected))
        setStrand(selected as StrandId);
    });
    try {
      const client = browserClient();
      const { data } = client.auth.onAuthStateChange((event, session) => {
        // Register/reset intentionally changes this tab's identity. Its profile
        // write is independently pinned to the newly authenticated student.
        if (!active || authMutation.current || event === "INITIAL_SESSION")
          return;
        const nextId = session?.user.id ?? null;
        if (studentSessionId.current && studentSessionId.current !== nextId) {
          clearStudentState(SESSION_CHANGED_MESSAGE);
        } else if (
          !studentSessionId.current &&
          (event === "SIGNED_OUT" ||
            (observedIdentity !== undefined && observedIdentity !== nextId))
        ) {
          // Initial recovery may emit SIGNED_IN before INITIAL_SESSION. Only a
          // change of identity invalidates the pending server profile read.
          authEpoch.current++;
        }
        observedIdentity = nextId;
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // A missing deployment configuration is reported when starting a session.
    }
    let recoveredIdentity: string | null = null;
    api<Profile | null>("/api/profile", undefined, controller.signal, {
      onResponse: (response) => {
        recoveredIdentity = response.headers.get(STUDENT_SESSION_HEADER);
      },
    })
      .then((value) => {
        if (active && authEpoch.current === initialEpoch && value) {
          if (!recoveredIdentity)
            throw new Error("Student session could not be confirmed.");
          if (
            observedIdentity !== undefined &&
            observedIdentity !== recoveredIdentity
          ) {
            clearStudentState(SESSION_CHANGED_MESSAGE);
            return;
          }
          studentSessionId.current = recoveredIdentity;
          setSessionIdentity(recoveredIdentity);
          setProfile(profileSchema.parse(value));
          setName(value.name);
          setStrand(value.strand);
          setYear(value.ignite_year);
          const savedQuestion = readSessionMarker("ignite-question");
          if (
            getStrand(value.strand).questions.some(
              (q) => q.id === savedQuestion,
            )
          )
            setPracticeQuestionId(savedQuestion!);
          stageRef.current = "READY";
          setStage("READY");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
      unsubscribe?.();
      stopSessionNotices();
      evaluationRequest.current?.abort();
      preTranscript.current = "";
      attemptRequests.current = {};
    };
  }, [clearStudentState]);
  useEffect(() => {
    const previous = lastStage.current;
    lastStage.current = stage;
    // Recording and processing update in place. Do not move a student's focus
    // while they are typing, recording, or recovering a failed submission.
    if (stage.endsWith("RECORDING") || stage.endsWith("PROCESSING")) return;
    if (stage.endsWith("QUESTION") && !previous.endsWith("SCENE")) return;
    const heading = main.current?.querySelector("h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }, [stage]);
  function go(next: Stage) {
    stageRef.current = transition(stageRef.current, next);
    setStage(stageRef.current);
    setError("");
    writeSessionMarker("ignite-stage", next);
    if (
      !next.endsWith("RECORDING") &&
      !next.endsWith("PROCESSING") &&
      !(next.endsWith("QUESTION") && !stage.endsWith("SCENE"))
    )
      window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    const registrationEpoch = ++authEpoch.current;
    authMutation.current = true;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const value = profileSchema.parse({ name, strand, ignite_year: year });
      const client = browserClient();
      const { error: signOutError } = await client.auth.signOut({
        scope: "local",
      });
      if (signOutError)
        throw new Error(
          "The previous session could not be ended. Please retry before starting a new student session.",
        );
      const { data, error: authError } = await client.auth.signInAnonymously();
      if (authError || !data.user)
        throw new Error(studentAccessMessage(authError));
      const identity = data.user.id;
      await api("/api/profile", value, undefined, {
        studentSessionId: identity,
      });
      const { data: current } = await client.auth.getSession();
      if (
        authEpoch.current !== registrationEpoch ||
        current.session?.user.id !== identity
      )
        throw new Error(SESSION_CHANGED_MESSAGE);
      studentSessionId.current = identity;
      setSessionIdentity(identity);
      setProfile(value);
      go("READY");
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "Enter your name, choose a strand, and select your IGNITE year.",
      );
    } finally {
      authMutation.current = false;
      if (authEpoch.current === registrationEpoch) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  async function submit(transcript: string) {
    if (lock.current) return;
    const identity = studentSessionId.current;
    if (!identity) {
      clearStudentState(SESSION_CHANGED_MESSAGE);
      return;
    }
    const submissionEpoch = authEpoch.current;
    const controller = new AbortController();
    evaluationRequest.current = controller;
    lock.current = true;
    setBusy(true);
    setError("");
    const group = stageRef.current.startsWith("PRE")
      ? "PRE"
      : stageRef.current.startsWith("POST")
        ? "POST"
        : "TRANSFER";
    go(`${group}_PROCESSING` as Stage);
    try {
      {
        if (attemptRequests.current[group]?.answer !== transcript)
          attemptRequests.current[group] = {
            id: crypto.randomUUID(),
            answer: transcript,
          };
        const result = await api<{
          evaluation: Evaluation;
          comparison?: Comparison;
          comparisonComparable?: boolean;
          scoringVersion?: string;
        }>(
          "/api/interview/evaluate",
          {
            transcript,
            stage:
              group === "PRE" ? "pre" : group === "POST" ? "post" : "practice",
            requestId: attemptRequests.current[group].id,
            questionId: activeQuestion?.id,
            ...(group === "POST"
              ? {
                  preTranscript: preTranscript.current,
                  preRequestId: attemptRequests.current.PRE?.id,
                }
              : {}),
          },
          controller.signal,
          { studentSessionId: identity },
        );
        if (authEpoch.current !== submissionEpoch) return;
        setAnswerCount((count) => count + 1);
        setSubmittedAnswer(transcript);
        if (activeQuestion)
          setAttemptHistory((history) => [
            ...history,
            {
              questionId: activeQuestion.id,
              scores: result.evaluation.scores,
              scoringVersion: result.scoringVersion,
            },
          ]);
        if (group !== "PRE" && activeQuestion)
          setCompletedQuestions((ids) =>
            ids.includes(activeQuestion.id) ? ids : [...ids, activeQuestion.id],
          );
        if (group === "PRE") {
          preTranscript.current = transcript;
          setFirstAnswer(transcript);
          setPre(result.evaluation);
          if (activeQuestion)
            setRevisionGoal(
              createRevisionGoal(activeQuestion.id, result.evaluation),
            );
          go("PRE_RESULTS");
        } else if (group === "TRANSFER") {
          setTransfer(result.evaluation);
          go("TRANSFER_RESULTS");
        } else {
          setPost(result.evaluation);
          setComparison(result.comparison);
          setComparisonComparable(result.comparisonComparable !== false);
          preTranscript.current = "";
          go("POST_COMPARISON");
        }
      }
    } catch (e) {
      if (authEpoch.current !== submissionEpoch) return;
      if (e instanceof Error && e.message === SESSION_CHANGED_MESSAGE) {
        clearStudentState(SESSION_CHANGED_MESSAGE);
        return;
      }
      go(`${group}_QUESTION` as Stage);
      const message =
        e instanceof Error
          ? e.message
          : "Unable to review your answer. Please try again.";
      setError(message);
      throw new Error(message);
    } finally {
      if (authEpoch.current === submissionEpoch) {
        evaluationRequest.current = null;
        lock.current = false;
        setBusy(false);
      }
    }
  }
  async function newQuestion(requestedId?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (!selected || !activeQuestion) return;
      const current = selected.questions.findIndex(
        (q) => q.id === activeQuestion.id,
      );
      const next =
        selected.questions.find((q) => q.id === requestedId) ??
        selected.questions[(current + 1) % selected.questions.length];
      chooseQuestion(next.id);
      setQuestion(next.text);
      delete attemptRequests.current.TRANSFER;
      setTransfer(undefined);
      setStoryNotes(emptyStoryNotes);
      setPracticeRetry(false);
      setRevisionGoal(undefined);
      setSubmittedAnswer("");
      setFirstAnswer("");
      go("TRANSFER_SCENE");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function retryQuestion() {
    if (lock.current || !activeQuestion) return;
    const reviewedAnswer =
      stageRef.current === "POST_COMPARISON" ? post : transfer;
    setRevisionGoal(
      reviewedAnswer
        ? createRevisionGoal(activeQuestion.id, reviewedAnswer)
        : undefined,
    );
    delete attemptRequests.current.TRANSFER;
    setQuestion(activeQuestion.text);
    setTransfer(undefined);
    setPracticeRetry(true);
    setSubmittedAnswer("");
    setFirstAnswer("");
    go("TRANSFER_SCENE");
  }
  async function reset() {
    if (lock.current) return;
    authEpoch.current++;
    authMutation.current = true;
    setEndingSession(true);
    if (stageRef.current.endsWith("RECORDING"))
      go(`${stageRef.current.split("_")[0]}_QUESTION` as Stage);
    lock.current = true;
    setBusy(true);
    preTranscript.current = "";
    attemptRequests.current = {};
    setPre(undefined);
    setPost(undefined);
    setComparison(undefined);
    setTransfer(undefined);
    setQuestion("");
    clearSessionMarkers();
    setPracticeQuestionId("");
    setStoryNotes(emptyStoryNotes);
    setCompletedQuestions([]);
    setAnswerCount(0);
    setAttemptHistory([]);
    setSubmittedAnswer("");
    setFirstAnswer("");
    setPracticeRetry(false);
    setRevisionGoal(undefined);
    window.speechSynthesis?.cancel();
    try {
      const { error } = await browserClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      clearStudentState();
    } catch {
      setError(
        "Unable to end the session. Please retry End session before handing over this device.",
      );
    } finally {
      authMutation.current = false;
      setEndingSession(false);
      lock.current = false;
      setBusy(false);
    }
  }
  const selected = profile ? getStrand(profile.strand) : null;
  const activeQuestion =
    selected?.questions.find((q) => q.id === practiceQuestionId) ??
    selected?.questions[8];
  const activeRevisionGoal =
    revisionGoal?.questionId === activeQuestion?.id ? revisionGoal : undefined;
  function chooseQuestion(id: string) {
    setPracticeQuestionId(id);
    writeSessionMarker("ignite-question", id);
  }
  const group = stage.startsWith("PRE")
    ? "PRE"
    : stage.startsWith("POST")
      ? "POST"
      : "TRANSFER";
  const answering =
    stage.endsWith("QUESTION") ||
    stage.endsWith("RECORDING") ||
    stage.endsWith("PROCESSING");
  const displayQuestion =
    group === "TRANSFER" ? question : (activeQuestion?.text ?? "");
  const latestEvaluation = transfer ?? post ?? pre;
  const recommendation =
    selected && activeQuestion && latestEvaluation
      ? recommendPracticeQuestion(
          selected.questions,
          activeQuestion.id,
          latestEvaluation,
          attemptHistory,
        )
      : undefined;
  const progress =
    stage === "PROFILE"
      ? 0
      : stage === "READY" || stage.startsWith("PRE")
        ? 1
        : stage === "STAR_LESSON"
          ? 2
          : stage.startsWith("POST")
            ? 3
            : stage === "COMPLETE"
              ? 5
              : 4;
  return (
    <div className="studio">
      <header className="header">
        <Brand />
        <div className="session-header">
          {selected && (
            <span className="pill">
              <StrandIcon name={selected.icon} size={16} />
              {selected.shortName}
            </span>
          )}
          <Link href="/" className="quiet-link">
            Home
          </Link>
          {profile && (
            <button className="quiet-link" onClick={reset} disabled={busy}>
              End session
            </button>
          )}
        </div>
      </header>
      <main
        ref={main}
        id="main"
        className={`interview-main ${stage.endsWith("SCENE") ? "scene-main" : ""}`}
      >
        {stage.startsWith("TRANSFER") || stage === "COMPLETE" ? (
          <div className="progress ongoing-progress">
            <span>
              ONGOING SCORED PRACTICE · 10 QUESTIONS · UNLIMITED ROUNDS
            </span>
            <span>
              {completedQuestions.length} / 10 topics explored · {answerCount}{" "}
              answers reviewed
            </span>
          </div>
        ) : (
          <div className="progress">
            <span>YOUR INTERVIEW JOURNEY</span>
            <div role="list" aria-label="Interview steps">
              {[
                "Set up",
                "Enter the room",
                "Learn",
                "Try again",
                "Apply",
                "Complete",
              ].map((s, i) => (
                <span
                  key={s}
                  className={i <= progress ? "active" : ""}
                  aria-current={i === progress ? "step" : undefined}
                  role="listitem"
                  aria-label={`${i + 1}. ${s}${i === progress ? ", current step" : ""}`}
                >
                  <i>{i < progress ? <Check size={12} /> : i + 1}</i>
                  <b>{s}</b>
                </span>
              ))}
            </div>
          </div>
        )}
        {error && !answering && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {stage === "PROFILE" ? (
          <section className="onboarding">
            <div className="screen-heading">
              <span className="eyebrow">LET’S MAKE THIS YOURS</span>
              <h1>
                A little about you.
                <br />
                <em>A lot ahead of you.</em>
              </h1>
              <p>
                Set up your practice session. No email. No account to create.
              </p>
            </div>
            <form onSubmit={register} aria-busy={!clientReady || busy}>
              <label htmlFor="name">What should we call you?</label>
              <input
                id="name"
                autoComplete="off"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                disabled={!clientReady || busy}
              />
              <fieldset disabled={!clientReady || busy}>
                <legend>Choose your IGNITE strand.</legend>
                <div className="strand-choices">
                  {strands.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className={strand === s.id ? "selected" : ""}
                      aria-pressed={strand === s.id}
                      onClick={() => setStrand(s.id)}
                    >
                      <StrandIcon name={s.icon} />
                      <span>{s.shortName}</span>
                      {strand === s.id && <Check size={17} />}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset disabled={!clientReady || busy}>
                <legend>Which year of IGNITE are you in?</legend>
                <div className="year-choices">
                  {([1, 2] as const).map((y) => (
                    <button
                      type="button"
                      key={y}
                      aria-pressed={year === y}
                      className={year === y ? "selected" : ""}
                      onClick={() => setYear(y)}
                    >
                      Year {y}
                      <span>
                        {y === 1
                          ? "My first year in IGNITE"
                          : "My second year in IGNITE"}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="helper">
                  Choose your year in IGNITE, not your grade level. A senior in
                  their first year of IGNITE is Year 1.
                </p>
              </fieldset>
              <button
                className="button primary"
                disabled={busy || !clientReady}
              >
                {!clientReady
                  ? "Preparing your studio…"
                  : busy
                    ? "Preparing your session…"
                    : "Begin Interview"}
                <ArrowRight size={18} />
              </button>
              <p className="privacy-note">
                <ShieldCheck size={15} /> Your name, strand, and IGNITE year,
                rubric scores, and STAR indicators are saved for your advisor.
                Assessment answers and feedback are saved for authorized staff
                review. Recordings are never saved.
              </p>
            </form>
          </section>
        ) : stage === "READY" && selected && activeQuestion ? (
          <QuestionLibrary
            strand={selected.id}
            name={profile?.name ?? ""}
            question={activeQuestion}
            completed={completedQuestions}
            onChoose={chooseQuestion}
            onStart={() => go("PRE_SCENE")}
          />
        ) : stage === "POST_READY" ? (
          <section className="focus-card ready-card">
            <div className="persona-icon">
              <Target size={29} />
            </div>
            <span className="eyebrow">POST-ASSESSMENT</span>
            <h1>A fresh chance to tell your story.</h1>
            <p>
              You’ll meet your {selected?.interviewerTitle.toLowerCase()}.
              Choose voice or text, take the time you need, and press “I’m
              Finished” when you’re done.
            </p>
            {activeQuestion && (
              <>
                <span className="eyebrow">YOUR TOPIC</span>
                <h2>{activeQuestion.topic}</h2>
                <p className="helper">
                  The same question, the same rubric. It appears again when
                  you’re ready in the room.
                </p>
                {activeRevisionGoal && (
                  <RevisionGoalReminder goal={activeRevisionGoal} compact />
                )}
                <StoryNotesPanel notes={storyNotes} question={activeQuestion} />
              </>
            )}
            <button className="button primary" onClick={() => go("POST_SCENE")}>
              Meet your interviewer <ArrowRight size={18} />
            </button>
          </section>
        ) : stage.endsWith("SCENE") && selected && activeQuestion ? (
          <>
            <InterviewScene
              key={`${group}-${activeQuestion.id}`}
              strand={selected.id}
              question={activeQuestion}
              round={group}
              retry={practiceRetry && group === "TRANSFER"}
              revisionGoal={activeRevisionGoal}
              onEnter={() => go(`${group}_QUESTION` as Stage)}
            />
            {stage === "PRE_SCENE" && (
              <button
                className="scene-back quiet-link"
                onClick={() => go("READY")}
              >
                <ArrowLeft size={16} /> Choose a different question
              </button>
            )}
          </>
        ) : answering ? (
          <div className="interview-workspace">
            <aside className="room-sidebar">
              <div className="room-sidebar-art">
                <InterviewRoom strand={selected?.id} />
              </div>
              <span className="eyebrow">YOU’RE IN THE ROOM</span>
              <h2>{selected && interviewSettings[selected.id].place}</h2>
              <p>{selected && interviewSettings[selected.id].atmosphere}</p>
              <div className="room-sidebar-meta">
                <MapPin size={16} />
                <span>Imagined setting · real practice</span>
              </div>
              <div className="room-sidebar-note">
                <span className="live-dot" />
                <p>
                  Take your time. The microphone starts only when you choose.
                </p>
              </div>
              {group !== "PRE" && activeQuestion && (
                <StoryNotesPanel notes={storyNotes} question={activeQuestion} />
              )}
            </aside>
            <section className="focus-card question-workspace">
              <div className="interview-stage">
                <span className="eyebrow">
                  {group === "TRANSFER"
                    ? "SCORED PRACTICE"
                    : `${group}-ASSESSMENT`}
                </span>
                <span>
                  {group === "TRANSFER"
                    ? "Practice at your own pace"
                    : group === "POST"
                      ? "Same question · second take"
                      : "First take · your starting point"}
                </span>
              </div>
              <div className="interviewer">
                <div className="persona-icon">
                  <StrandIcon name={selected?.icon ?? "Code"} size={26} />
                </div>
                <div>
                  <h2>{selected?.interviewerTitle} Interview</h2>
                  <p>
                    {selected?.name} ·{" "}
                    {profile?.ignite_year === 1 ? "Year 1" : "Year 2"}
                  </p>
                </div>
              </div>
              <h1 className="question">“{displayQuestion}”</h1>
              {group !== "PRE" && activeRevisionGoal && (
                <RevisionGoalReminder goal={activeRevisionGoal} compact />
              )}
              <AnswerRecorder
                key={`${sessionIdentity}:${group}`}
                studentSessionId={sessionIdentity}
                onSessionChange={() =>
                  clearStudentState(SESSION_CHANGED_MESSAGE)
                }
                question={displayQuestion}
                busy={busy}
                disabled={endingSession}
                onRecording={() => go(`${group}_RECORDING` as Stage)}
                onCancel={() => {
                  if (stageRef.current.endsWith("RECORDING"))
                    go(`${group}_QUESTION` as Stage);
                }}
                onSubmit={submit}
              />
            </section>
          </div>
        ) : stage === "PRE_RESULTS" && pre ? (
          <section className="focus-card">
            <span className="eyebrow">PRE-ASSESSMENT</span>
            <h1>Your starting point.</h1>
            <Assessment value={pre} />
            {submittedAnswer && (
              <details className="submitted-answer-review">
                <summary>Review your first answer</summary>
                <p>{submittedAnswer}</p>
              </details>
            )}
            {activeQuestion && (
              <div className="question-insight">
                <span className="eyebrow">WHAT THIS QUESTION EXPLORES</span>
                <p>
                  {topicStories[getQuestionTopic(activeQuestion)].intention}
                </p>
              </div>
            )}
            <button
              className="button primary"
              onClick={() => go("STAR_LESSON")}
            >
              Discover the STAR method <ArrowRight size={18} />
            </button>
          </section>
        ) : stage === "STAR_LESSON" && activeQuestion ? (
          <StarLesson
            question={activeQuestion}
            feedback={pre?.improvementArea}
            notes={storyNotes}
            onNotes={setStoryNotes}
            onContinue={() => go("POST_READY")}
          />
        ) : stage === "POST_COMPARISON" && pre && post && comparison ? (
          <section className="focus-card wide">
            <span className="eyebrow">POST-ASSESSMENT COMPARISON</span>
            <h1>
              {!comparisonComparable
                ? "A new review of your story."
                : scoreChange(pre, post) > 0
                  ? "Look how far you’ve come."
                  : scoreChange(pre, post) === 0
                    ? "Same score. A clearer next step."
                    : "Every take teaches you something."}
            </h1>
            <Compare
              pre={pre}
              post={post}
              comparison={comparison}
              comparable={comparisonComparable}
            />
            <AnswerComparison before={firstAnswer} after={submittedAnswer} />
            {activeQuestion && (
              <PracticeReflection
                key={answerCount}
                evaluation={post}
                question={activeQuestion}
                answer={submittedAnswer}
                onRetry={retryQuestion}
                busy={busy}
              />
            )}
            {recommendation && (
              <div className="recommended-practice">
                <span className="eyebrow">RECOMMENDED FOR YOUR NEXT STEP</span>
                <h2>{recommendation.question.topic}</h2>
                <p>{recommendation.reason}</p>
                <button
                  className="button secondary"
                  onClick={() => newQuestion(recommendation.question.id)}
                  disabled={busy}
                >
                  Practice this skill <ArrowRight size={17} />
                </button>
              </div>
            )}
            <button
              className="button primary"
              disabled={busy}
              onClick={() => newQuestion()}
            >
              {busy
                ? "Preparing your new question…"
                : "Try a New Interview Question"}
              <ArrowRight size={18} />
            </button>
          </section>
        ) : (stage === "TRANSFER_RESULTS" || stage === "COMPLETE") &&
          transfer ? (
          <section className="focus-card completion">
            <div className="completion-check">
              <Check size={34} />
            </div>
            <span className="eyebrow">
              {stage === "COMPLETE" ? "YOU DID IT" : "PRACTICE RESULTS"}
            </span>
            <h1>
              {stage === "COMPLETE"
                ? "Interview Practice Complete"
                : "Your practice results."}
            </h1>
            <p>Every answer is scored using the same four-category rubric.</p>
            <p className="question-preview">“{question}”</p>
            <Assessment value={transfer} />
            {stage === "COMPLETE" && selected && (
              <PracticePlan
                strand={selected.id}
                attempts={attemptHistory}
                evaluation={transfer}
              />
            )}
            {activeQuestion && (
              <>
                <QuestionGrowth
                  attempts={attemptHistory}
                  question={activeQuestion}
                />
                <PracticeReflection
                  key={answerCount}
                  evaluation={transfer}
                  question={activeQuestion}
                  answer={submittedAnswer}
                  onRetry={
                    stage === "TRANSFER_RESULTS" ? retryQuestion : undefined
                  }
                  busy={busy}
                />
              </>
            )}
            {recommendation && stage !== "COMPLETE" && (
              <div className="recommended-practice">
                <span className="eyebrow">RECOMMENDED FOR YOUR NEXT STEP</span>
                <h2>{recommendation.question.topic}</h2>
                <p>{recommendation.reason}</p>
                <button
                  className="button secondary"
                  onClick={() => newQuestion(recommendation.question.id)}
                  disabled={busy}
                >
                  Practice this skill <ArrowRight size={17} />
                </button>
              </div>
            )}
            <button
              className="button primary"
              onClick={() => newQuestion()}
              disabled={busy}
            >
              Try a New Question <ArrowRight size={18} />
            </button>
            {stage === "TRANSFER_RESULTS" ? (
              <button className="button primary" onClick={() => go("COMPLETE")}>
                Continue to completion <ArrowRight size={18} />
              </button>
            ) : (
              <>
                <a
                  className="button primary"
                  href={
                    process.env.NEXT_PUBLIC_RESULTS_FORM_URL ||
                    "https://forms.gle/oXsPai5qjkUb5okw9"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Complete Results Form <ArrowUpRight size={18} />
                </a>
                <p className="helper">
                  The results form opens in a new tab. No information is sent
                  automatically.
                </p>
                <button
                  className="button secondary"
                  onClick={reset}
                  disabled={busy}
                >
                  {busy ? "Ending this session…" : "Next Student"}
                </button>
              </>
            )}
          </section>
        ) : null}
      </main>
      <div className="session-footer">
        <ShieldCheck size={16} /> Recordings are never saved. Assessment answers
        and feedback are available to authorized staff.
      </div>
    </div>
  );
}

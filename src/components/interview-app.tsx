"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  ArrowUpRight,
  Target,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { StrandIcon } from "@/components/strand-icon";
import { AnswerRecorder } from "@/components/answer-recorder";
import { Assessment, Compare } from "@/components/assessment";
import { strands, getStrand, type StrandId } from "@/config/strands";
import {
  profileSchema,
  type Profile,
  type Evaluation,
  type Comparison,
  type Transfer,
} from "@/lib/validation";
import { transition, type Stage } from "@/lib/machine";
import { browserClient } from "@/lib/supabase/browser";
import { api } from "@/lib/client-api";
export function InterviewApp() {
  const [stage, setStage] = useState<Stage>("PROFILE");
  const stageRef = useRef<Stage>("PROFILE");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [strand, setStrand] = useState<StrandId | "">("");
  const [year, setYear] = useState<1 | 2 | undefined>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [pre, setPre] = useState<Evaluation>();
  const [post, setPost] = useState<Evaluation>();
  const [comparison, setComparison] = useState<Comparison>();
  const [transfer, setTransfer] = useState<Transfer>();
  const [question, setQuestion] = useState("");
  const preTranscript = useRef("");
  const attemptRequests = useRef<
    Record<string, { id: string; answer: string }>
  >({});
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("strand");
    let active = true;
    Promise.resolve().then(() => {
      if (active && strands.some((s) => s.id === selected))
        setStrand(selected as StrandId);
    });
    api<Profile | null>("/api/profile")
      .then((value) => {
        if (active && value) {
          setProfile(profileSchema.parse(value));
          setName(value.name);
          setStrand(value.strand);
          setYear(value.ignite_year);
          stageRef.current = "READY";
          setStage("READY");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      preTranscript.current = "";
      attemptRequests.current = {};
    };
  }, []);
  function go(next: Stage) {
    stageRef.current = transition(stageRef.current, next);
    setStage(stageRef.current);
    setError("");
    sessionStorage.setItem("ignite-stage", next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const value = profileSchema.parse({ name, strand, ignite_year: year });
      const client = browserClient();
      await client.auth.signOut();
      const { error: authError } = await client.auth.signInAnonymously();
      if (authError)
        throw new Error(
          "Student access is unavailable. Please contact your advisor.",
        );
      await api("/api/profile", value);
      setProfile(value);
      go("READY");
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "Enter your name, choose a strand, and select your IGNITE year.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit(transcript: string) {
    if (lock.current) return;
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
      if (group === "TRANSFER") {
        const value = await api<Transfer>("/api/interview/transfer-evaluate", {
          transcript,
          question,
        });
        setTransfer(value);
        go("TRANSFER_RESULTS");
      } else {
        if (attemptRequests.current[group]?.answer !== transcript)
          attemptRequests.current[group] = {
            id: crypto.randomUUID(),
            answer: transcript,
          };
        const result = await api<{
          evaluation: Evaluation;
          comparison?: Comparison;
        }>("/api/interview/evaluate", {
          transcript,
          stage: group === "PRE" ? "pre" : "post",
          requestId: attemptRequests.current[group].id,
          ...(group === "POST" ? { preTranscript: preTranscript.current } : {}),
        });
        if (group === "PRE") {
          preTranscript.current = transcript;
          setPre(result.evaluation);
          go("PRE_RESULTS");
        } else {
          setPost(result.evaluation);
          setComparison(result.comparison);
          preTranscript.current = "";
          go("POST_COMPARISON");
        }
      }
    } catch (e) {
      go(`${group}_QUESTION` as Stage);
      const message =
        e instanceof Error
          ? e.message
          : "Unable to review your answer. Please try again.";
      setError(message);
      throw new Error(message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function newQuestion() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await api<{ question: string }>(
        "/api/interview/transfer-question",
        {},
      );
      setQuestion(result.question);
      go("TRANSFER_QUESTION");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function reset() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    preTranscript.current = "";
    attemptRequests.current = {};
    setPre(undefined);
    setPost(undefined);
    setComparison(undefined);
    setTransfer(undefined);
    setQuestion("");
    sessionStorage.removeItem("ignite-stage");
    window.speechSynthesis?.cancel();
    try {
      const { error } = await browserClient().auth.signOut();
      if (error) throw error;
      setProfile(null);
      setName("");
      setStrand("");
      setYear(undefined);
      stageRef.current = "PROFILE";
      setStage("PROFILE");
      setError("");
    } catch {
      setError(
        "Unable to end the session. Please retry Next Student before handing over this device.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const selected = profile ? getStrand(profile.strand) : null;
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
    group === "TRANSFER" ? question : (selected?.primaryQuestion ?? "");
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
    <>
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
      <main id="main" className="interview-main">
        <div className="progress">
          <span>YOUR INTERVIEW JOURNEY</span>
          <div>
            {[
              "Set up",
              "Practice",
              "Learn",
              "Try again",
              "Apply",
              "Complete",
            ].map((s, i) => (
              <span key={s} className={i <= progress ? "active" : ""}>
                <i>{i < progress ? <Check size={12} /> : i + 1}</i>
                <b>{s}</b>
              </span>
            ))}
          </div>
        </div>
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
            <form onSubmit={register}>
              <label htmlFor="name">What should we call you?</label>
              <input
                id="name"
                autoComplete="off"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Rahul Viswanath"
                required
              />
              <fieldset>
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
              <fieldset>
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
              <button className="button primary" disabled={busy}>
                {busy ? "Preparing your session…" : "Begin Interview"}
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
        ) : stage === "READY" || stage === "POST_READY" ? (
          <section className="focus-card ready-card">
            <div className="persona-icon">
              <Target size={29} />
            </div>
            <span className="eyebrow">
              {stage === "READY" ? "YOUR FIRST INTERVIEW" : "POST-ASSESSMENT"}
            </span>
            <h1>
              {stage === "READY"
                ? `Ready, ${profile?.name}?`
                : "A fresh chance to tell your story."}
            </h1>
            <p>
              You’ll meet your {selected?.interviewerTitle.toLowerCase()}.
              Choose voice or text, take the time you need, and press “I’m
              Finished” when you’re done.
            </p>
            {stage === "READY" && (
              <p className="helper">
                You can use experiences from IGNITE, school, projects,
                leadership, volunteering, or employment. Professional experience
                is not expected.
              </p>
            )}
            <button
              className="button primary"
              onClick={() =>
                go(stage === "READY" ? "PRE_QUESTION" : "POST_QUESTION")
              }
            >
              Meet your interviewer <ArrowRight size={18} />
            </button>
          </section>
        ) : answering ? (
          <section className="focus-card">
            <div className="interview-stage">
              <span className="eyebrow">
                {group === "TRANSFER"
                  ? "TRANSFER INTERVIEW"
                  : `${group}-ASSESSMENT`}
              </span>
              <span>Question 1 of 1</span>
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
            <AnswerRecorder
              key={group}
              question={displayQuestion}
              busy={busy}
              onRecording={() => go(`${group}_RECORDING` as Stage)}
              onCancel={() => {
                if (stageRef.current.endsWith("RECORDING"))
                  go(`${group}_QUESTION` as Stage);
              }}
              onSubmit={submit}
            />
          </section>
        ) : stage === "PRE_RESULTS" && pre ? (
          <section className="focus-card">
            <span className="eyebrow">PRE-ASSESSMENT</span>
            <h1>Your starting point.</h1>
            <Assessment value={pre} />
            <button
              className="button primary"
              onClick={() => go("STAR_LESSON")}
            >
              Discover the STAR method <ArrowRight size={18} />
            </button>
          </section>
        ) : stage === "STAR_LESSON" ? (
          <section className="lesson">
            <div className="screen-heading">
              <span className="eyebrow">A FRAMEWORK, NOT A SCRIPT</span>
              <h1>
                Give your story
                <br />
                <em>a little structure.</em>
              </h1>
              <p>
                STAR helps an interviewer follow what happened—and understand
                your part in it.
              </p>
            </div>
            <div className="star-grid">
              {[
                {
                  letter: "S",
                  title: "Situation",
                  question: "What was happening?",
                  text: "Set the scene. A little context goes a long way.",
                },
                {
                  letter: "T",
                  title: "Task",
                  question: "What were you responsible for?",
                  text: "Make your goal or responsibility clear.",
                },
                {
                  letter: "A",
                  title: "Action",
                  question: "What specifically did YOU do?",
                  text: "Explain the steps you took, not just what the team did.",
                },
                {
                  letter: "R",
                  title: "Result",
                  question: "What happened or what did you learn?",
                  text: "Share an outcome, feedback, impact, or a lesson.",
                },
              ].map((s) => (
                <article key={s.letter}>
                  <span>{s.letter}</span>
                  <h2>{s.title}</h2>
                  <strong>{s.question}</strong>
                  <p>{s.text}</p>
                </article>
              ))}
            </div>
            <div className="example-card">
              <span className="eyebrow">
                A SMALL EXAMPLE · A DIFFERENT STORY
              </span>
              <div>
                <article>
                  <h3>Before</h3>
                  <p>
                    “We ran a club fundraiser. It was busy, but it went well.”
                  </p>
                </article>
                <article>
                  <h3>With STAR</h3>
                  <p>
                    “Our club needed funds for supplies <b>(S)</b>. I was
                    responsible for organizing a bake sale <b>(T)</b>. I
                    assigned shifts, made a supply checklist, and promoted it at
                    school <b>(A)</b>. We met our goal, and I learned to
                    delegate earlier <b>(R)</b>.”
                  </p>
                </article>
              </div>
            </div>
            <button className="button primary" onClick={() => go("POST_READY")}>
              I understand STAR — Start Post-Assessment <ArrowRight size={18} />
            </button>
          </section>
        ) : stage === "POST_COMPARISON" && pre && post && comparison ? (
          <section className="focus-card wide">
            <span className="eyebrow">POST-ASSESSMENT COMPARISON</span>
            <h1>Look how far you’ve come.</h1>
            <Compare pre={pre} post={post} comparison={comparison} />
            <button
              className="button primary"
              disabled={busy}
              onClick={newQuestion}
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
              {stage === "COMPLETE" ? "YOU DID IT" : "TRANSFER RESULTS"}
            </span>
            <h1>Interview Practice Complete</h1>
            <p>Here’s how you applied the framework to a new question.</p>
            <div className="star-status">
              {(["situation", "task", "action", "result"] as const).map((k) => (
                <div key={k}>
                  <strong>{k}</strong>
                  <span>{transfer[k] ? "✓ Present" : "Missing"}</span>
                </div>
              ))}
            </div>
            <h2>
              {transfer.situation &&
              transfer.task &&
              transfer.action &&
              transfer.result
                ? "All four STAR components were present."
                : "You’re building your STAR toolkit."}
            </h2>
            <p>{transfer.observation}</p>
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
        <ShieldCheck size={16} /> A private space to practice. Interview content
        stays out of our database.
      </div>
    </>
  );
}

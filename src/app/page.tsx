import Link from "next/link";
import {
  ArrowRight,
  Mic,
  ShieldCheck,
  Check,
  AudioLines,
  Lightbulb,
  Target,
  ArrowUpRight,
} from "lucide-react";
import { Header, Brand } from "@/components/brand";
import { strands } from "@/config/strands";
import { StrandIcon } from "@/components/strand-icon";
export default function Home() {
  return (
    <>
      <Header />
      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" /> BUILT FOR IGNITE PROFESSIONAL
              STUDIES
            </div>
            <h1>
              Your next chapter
              <br />
              starts with a<br />
              <em>stronger story.</em>
            </h1>
            <p className="hero-description">
              You have the experiences. Learn how to share them.
              <br className="desktop-break" /> Build interview confidence with
              practice that feels real.
            </p>
            <div className="hero-actions">
              <Link href="/interview" className="button primary">
                Start Student Interview <ArrowRight size={19} />
              </Link>
              <span className="time-note">
                3 interviews. One confident you.
              </span>
            </div>
            <div className="hero-trust">
              <span>
                <ShieldCheck size={17} /> No student email needed
              </span>
              <span>
                <Mic size={17} /> Voice or text answers
              </span>
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="Preview of the interview experience"
          >
            <div className="preview-label">
              <span className="live-dot" /> YOUR PRACTICE SPACE
            </div>
            <div className="preview-card">
              <div className="preview-top">
                <div className="persona-icon">
                  <BriefcaseIcon />
                </div>
                <div>
                  <strong>Your interviewer</strong>
                  <span>Real questions. Room to grow.</span>
                </div>
                <span className="pill">PRE-ASSESSMENT</span>
              </div>
              <div className="preview-question">
                “Tell me about a time when a project or plan didn’t go as
                expected. What did you do?”
              </div>
              <div className="preview-mic">
                <div className="mic-ring">
                  <Mic size={34} />
                </div>
                <div className="waveform" aria-hidden="true">
                  {Array.from({ length: 25 }, (_, i) => (
                    <i
                      key={i}
                      style={{
                        height: `${[9, 16, 26, 12, 35, 22, 43, 18, 29, 49, 24, 39, 55, 27, 44, 20, 35, 47, 19, 31, 14, 26, 18, 12, 7][i]}px`,
                      }}
                    />
                  ))}
                </div>
                <span>Your story deserves to be heard.</span>
              </div>
              <div className="preview-bottom">
                <span>
                  <span className="live-dot" /> A space to practice, not perform
                </span>
                <AudioLines size={19} />
              </div>
            </div>
            <div className="growth-card">
              <span className="growth-icon">
                <Lightbulb size={21} />
              </span>
              <div>
                <strong>A little practice. A lot of possibility.</strong>
                <span>Find your voice, one answer at a time.</span>
              </div>
            </div>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
          </div>
        </section>
        <section className="strand-section">
          <div className="section-line">
            <span>YOUR STRAND. YOUR FUTURE.</span>
            <span>10 pathways. Endless possibilities.</span>
          </div>
          <div className="strand-strip">
            {strands.map((s) => (
              <Link href={`/interview?strand=${s.id}`} key={s.id}>
                <StrandIcon name={s.icon} />
                <span>{s.shortName}</span>
              </Link>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="how-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">CONFIDENCE IS A SKILL</div>
              <h2>
                Practice. Reflect. <em>Improve.</em>
              </h2>
            </div>
            <p>
              A focused experience that turns your everyday
              <br /> experiences into stronger interview answers.
            </p>
          </div>
          <div className="steps-grid">
            {[
              {
                icon: Mic,
                n: "01",
                title: "Meet your interviewer",
                text: "Answer a realistic question tailored to your IGNITE strand. Speak naturally, or type your response.",
              },
              {
                icon: Target,
                n: "02",
                title: "Build a stronger answer",
                text: "Get thoughtful feedback, discover the STAR method, and try the same question with a fresh perspective.",
              },
              {
                icon: Lightbulb,
                n: "03",
                title: "Put it into practice",
                text: "See your progress. Take on a new question. Walk away with a framework you can use anywhere.",
              },
            ].map((s) => (
              <article key={s.n} className="step-card">
                <div className="step-top">
                  <s.icon size={25} />
                  <span>{s.n}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="privacy-banner">
          <ShieldCheck size={26} />
          <div>
            <strong>Your practice stays yours.</strong>
            <p>
              We save your name, strand, IGNITE year, rubric scores, STAR indicators,
              assessment answers, and feedback for authorized staff review.
              Recordings are never saved.
            </p>
          </div>
          <Check size={22} />
        </section>
      </main>
      <footer>
        <Brand />
        <span>Built for the next generation of professionals.</span>
        <Link href="/staff/login">
          Advisor access <ArrowUpRight size={14} />
        </Link>
      </footer>
    </>
  );
}
function BriefcaseIcon() {
  return <Target size={24} />;
}

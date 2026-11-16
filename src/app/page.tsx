import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  ArrowUpRight,
  MessageCircle,
  BookOpen,
  Compass,
} from "lucide-react";
import { Header, Brand } from "@/components/brand";
import { OrbitalHero } from "@/components/orbital-hero";
import { StudioPreview } from "@/components/studio-preview";
import { strands } from "@/config/strands";
import { StrandIcon } from "@/components/strand-icon";

export default function Home() {
  return (
    <div className="studio landing">
      <Header />
      <main id="main" className="landing-main">
        <OrbitalHero />
        <section className="landing-metrics" aria-label="Practice at a glance">
          <div>
            <strong>10</strong>
            <span>career pathways</span>
          </div>
          <div>
            <strong>100</strong>
            <span>strand-specific questions</span>
          </div>
          <div>
            <strong>1</strong>
            <span>story only you can tell</span>
          </div>
          <p>
            Made for where you are.
            <br />
            <em>And where you’re going.</em>
          </p>
        </section>
        <section
          className="experience-preview-section"
          aria-labelledby="preview-title"
        >
          <div>
            <span className="eyebrow">THE MOMENT BEFORE YOUR ANSWER</span>
            <h2 id="preview-title">
              Make the room
              <br />
              <em>feel familiar.</em>
            </h2>
            <p>
              Meet your practice interviewer. Turn your experience into a clear
              story.
            </p>
            <Link className="button secondary" href="/interview">
              Choose your practice <ArrowRight size={18} />
            </Link>
          </div>
          <StudioPreview />
        </section>
        <section
          id="how-it-works"
          className="landing-method"
          aria-labelledby="method-title"
        >
          <div className="landing-section-heading">
            <div>
              <span className="eyebrow">CONFIDENCE COMES FROM DOING</span>
              <h2 id="method-title">
                Practice the moment.
                <br />
                <em>Not just the answer.</em>
              </h2>
            </div>
            <p>Answer. Get feedback. Try again.</p>
          </div>
          <div className="method-grid">
            {[
              {
                icon: Compass,
                n: "01",
                title: "Enter the scene",
                text: "Settle into a fictional interview setting from your strand.",
                note: "Get comfortable",
              },
              {
                icon: MessageCircle,
                n: "02",
                title: "Tell your story",
                text: "Answer an IGNITE question by voice or text. Get feedback on four criteria.",
                note: "Find your strengths",
              },
              {
                icon: BookOpen,
                n: "03",
                title: "Make it stronger",
                text: "Learn STAR, plan a revision, retry, then practice a new question.",
                note: "Choose your next step",
              },
            ].map((step) => (
              <article key={step.n}>
                <div className="method-card-top">
                  <step.icon size={23} strokeWidth={1.5} />
                  <span>{step.n}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <span className="method-card-note">
                  {step.note} <ArrowUpRight size={14} />
                </span>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-pathways" aria-labelledby="pathways-title">
          <div className="landing-section-heading">
            <div>
              <span className="eyebrow">YOUR STRAND. YOUR STARTING POINT.</span>
              <h2 id="pathways-title">
                A room for <em>your ambition.</em>
              </h2>
            </div>
            <p>Ten questions per pathway. Your student experiences count.</p>
          </div>
          <div className="pathway-grid">
            {strands.map((s, i) => (
              <Link key={s.id} href={`/interview?strand=${s.id}`}>
                <span className="pathway-icon">
                  <StrandIcon name={s.icon} size={21} />
                </span>
                <div>
                  <strong>{s.name}</strong>
                  <span>{s.interviewerTitle}</span>
                </div>
                <span className="pathway-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
        </section>
        <section className="landing-manifesto">
          <span className="eyebrow">SMALL EXPERIENCES. REAL POTENTIAL.</span>
          <p>
            Share <em>what you’ve learned.</em>
          </p>
          <Link href="/interview" className="button primary">
            Find your first scene <ArrowRight size={18} />
          </Link>
          <span>
            School. IGNITE. Clubs. Volunteering. No work experience needed.
          </span>
        </section>
        <section className="landing-privacy">
          <ShieldCheck size={24} strokeWidth={1.5} />
          <div>
            <strong>Your practice, your privacy.</strong>
            <p>
              We save your name, strand, IGNITE year, answers, feedback, scores,
              and STAR indicators for authorized staff review. Audio is
              transcribed, never saved by this app.
            </p>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>Real, relevant learning.</span>
        <Link href="/staff/login">
          Advisor access <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}

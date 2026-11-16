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
              Step into a setting from your strand. Meet your interviewer, take
              a breath, and practice turning your own experience into a story
              someone can follow.
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
            <p>
              The room. The pause. The question.
              <br />
              Make it familiar, one story at a time.
            </p>
          </div>
          <div className="method-grid">
            {[
              {
                icon: Compass,
                n: "01",
                title: "Enter the scene",
                text: "A studio, a school, a workshop. Meet your practice interviewer in an imagined setting connected to your strand.",
                note: "Get a feel for the conversation",
              },
              {
                icon: MessageCircle,
                n: "02",
                title: "Tell your story",
                text: "Answer a question from the actual IGNITE bank. Speak or type, then see feedback across four clear rubric categories.",
                note: "Find what’s already working",
              },
              {
                icon: BookOpen,
                n: "03",
                title: "Make it stronger",
                text: "Learn STAR, sketch your story, and answer the same question again. Then carry the skill into a new scene.",
                note: "Take something useful with you",
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
            <p>
              Ten questions in every pathway.
              <br />
              Examples from your own student experience.
            </p>
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
            You don’t need years of experience.
            <br />
            You need a way to share <em>what you’ve learned.</em>
          </p>
          <Link href="/interview" className="button primary">
            Find your first scene <ArrowRight size={18} />
          </Link>
          <span>School. IGNITE. Clubs. Volunteering. Your story counts.</span>
        </section>
        <section className="landing-privacy">
          <ShieldCheck size={24} strokeWidth={1.5} />
          <div>
            <strong>A practice space with clear boundaries.</strong>
            <p>
              Your name, strand, IGNITE year, rubric scores, STAR indicators,
              assessment answers, and feedback are saved for authorized staff
              review. Your recordings are processed for transcription and never
              saved by this app.
            </p>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>Real, relevant learning. A future that’s yours.</span>
        <Link href="/staff/login">
          Advisor access <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}

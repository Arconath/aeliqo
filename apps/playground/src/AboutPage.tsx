import { AeliqoLogo, SiteFrame } from "./site-chrome";
import "./about-page.css";

const aboutSections = [
  {
    id: "story",
    number: "01",
    title: "Our Story",
    body: "Aeliqo began as a proof of concept for interfaces that understand semantic intent, not just input. The framework keeps that idea explicit: application-owned data, trusted semantic components, and a Workspace that composes presentation without generating arbitrary executable UI.",
  },
  {
    id: "mission",
    number: "02",
    title: "Our Mission",
    body: "Aeliqo makes adaptive interfaces practical for developers. A framework-agnostic core, a first-class React renderer, and shared capability contracts let the same semantics work across direct usage and agent-assisted workflows.",
  },
  {
    id: "build",
    number: "03",
    title: "What We Build",
    body: "Aeliqo brings together a headless core, semantic components, an adaptive Workspace, and protocol adapters for MCP, BYOK, and experimental WebMCP. The runtime applies trusted operations while rendering stays deterministic and application data remains application-owned.",
  },
] as const;

function ChevronIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="m4.25 2.25 3.5 3.75-3.5 3.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function PageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.25 3.75h8.5l3 3v13.5h-11.5V3.75Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M14.75 3.75v3h3M9.25 11h5.5M9.25 14.5h5.5M9.25 18h3.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="5.25"
        width="17"
        height="13.5"
        rx="1.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m4.5 7 7.5 5.5L19.5 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M3.5 9h10.25M9.75 4.75 14 9l-4.25 4.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function AboutSection({
  id,
  number,
  title,
  body,
}: (typeof aboutSections)[number]) {
  return (
    <section className="about-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="about-section-marker" aria-hidden="true">
        <span>{number}</span>
        <i />
      </div>
      <div className="about-section-copy">
        <h2 id={`${id}-title`}>{title}</h2>
        <p>{body}</p>
      </div>
    </section>
  );
}

export function AboutPage() {
  return (
    <SiteFrame active="about" footer={true}>
      <main className="about-page">
        <div className="about-page-inner">
          <div className="about-layout">
            <div className="about-primary">
              <nav className="about-breadcrumb" aria-label="Breadcrumb">
                <a href="/">Home</a>
                <ChevronIcon />
                <span aria-current="page">About</span>
              </nav>

              <header className="about-hero">
                <h1>
                  About <span>Aeliqo</span>
                </h1>
                <p>
                  A framework for building adaptive interfaces with explicit
                  semantics. Explore the core, renderer, and trusted
                  capabilities behind Aeliqo.
                </p>
                <div className="about-meta">
                  <span>Framework overview</span>
                  <b aria-hidden="true">•</b>
                  <span>Aeliqo 0.2.0</span>
                </div>
              </header>

              <div className="about-sections">
                {aboutSections.map((section) => (
                  <AboutSection key={section.id} {...section} />
                ))}
              </div>
            </div>

            <aside className="about-sidebar">
              <nav className="about-card about-toc" aria-label="On this page">
                <div className="about-card-heading">
                  <PageIcon />
                  <h2>On this page</h2>
                </div>
                <div className="about-toc-links">
                  {aboutSections.map((section, index) => (
                    <a
                      className={index === 0 ? "is-active" : undefined}
                      href={`#${section.id}`}
                      key={section.id}
                    >
                      {section.title}
                    </a>
                  ))}
                </div>
              </nav>

              <section
                className="about-card about-contact"
                aria-labelledby="about-contact-title"
              >
                <div className="about-contact-icon">
                  <MailIcon />
                </div>
                <h2 id="about-contact-title">Need to reach us?</h2>
                <p>
                  Questions, feedback, or framework discussions? Open the
                  repository to inspect the source and share an issue.
                </p>
                <a
                  className="about-button"
                  href="https://github.com/aeliqo/aeliqo"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open GitHub
                  <ArrowIcon />
                </a>
              </section>
            </aside>
          </div>

          <section className="about-cta" aria-labelledby="about-cta-title">
            <div className="about-cta-content">
              <AeliqoLogo compact />
              <div>
                <h2 id="about-cta-title">Build what’s next with Aeliqo</h2>
                <p>
                  Read the docs and compose adaptive interfaces with
                  application-owned data.
                </p>
              </div>
            </div>
            <a className="about-cta-button" href="/docs/">
              Get started
              <ArrowIcon />
            </a>
          </section>
        </div>
      </main>
    </SiteFrame>
  );
}

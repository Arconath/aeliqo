import { useState, type ReactNode } from "react";
import "./site-chrome.css";

export type SitePage = "home" | "docs" | "playground" | "blog" | "about";

interface SiteHeaderProps {
  readonly active?: SitePage;
  readonly compact?: boolean;
  readonly dark?: boolean;
  readonly onThemeToggle?: () => void;
}

interface SiteFrameProps extends SiteHeaderProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly footer?: boolean;
}

export function AeliqoLogo({ compact = false }: { readonly compact?: boolean }) {
  return (
    <span className={`aeliqo-logo${compact ? " aeliqo-logo-compact" : ""}`}>
      <img className="aeliqo-logo-mark" src="/aeliqo-logo.png" alt="" width="31" height="31" />
      {!compact && <span className="aeliqo-logo-word">Aeliqo</span>}
    </span>
  );
}

function MoonIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 10.9A5.6 5.6 0 0 1 5.1 2.5 5.9 5.9 0 1 0 13.5 10.9Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}

function SunIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>;
}

function GithubIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M10 1.7a8.3 8.3 0 0 0-2.6 16.2c.4.1.5-.2.5-.4v-1.5c-2.1.5-2.5-1-2.5-1-.4-.9-.9-1.1-.9-1.1-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.8.9 2.2.7.1-.5.3-.9.5-1.1-1.7-.2-3.5-.8-3.5-3.7 0-.8.3-1.5.8-2-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.1.8A7.2 7.2 0 0 1 10 8.5c.7 0 1.4.1 2 .3 1.4-1 2.1-.8 2.1-.8.5 1.1.2 1.9.1 2.1.5.5.8 1.2.8 2 0 2.9-1.8 3.5-3.5 3.7.3.3.5.7.5 1.4v2.1c0 .2.1.5.5.4A8.3 8.3 0 0 0 10 1.7Z" /></svg>;
}

export function SiteHeader({ active, compact = false, dark: controlledDark, onThemeToggle }: SiteHeaderProps) {
  const [localDark, setLocalDark] = useState(true);
  const dark = controlledDark ?? localDark;
  const handleThemeToggle = onThemeToggle ?? (() => setLocalDark(value => !value));
  const theme = dark ? "dark" : "light";
  return (
    <header className={`site-header${compact ? " site-header-compact" : ""}`} data-site-theme={theme}>
      <a className="site-brand" href="/" aria-label="Aeliqo home"><AeliqoLogo /></a>
      <nav className="site-nav" aria-label="Primary navigation">
        <a className={active === "docs" ? "is-active" : undefined} href="/docs/">Docs</a>
        <a className={active === "playground" ? "is-active" : undefined} href="/playground/">Playground</a>
        <a className={active === "blog" ? "is-active" : undefined} href="/blog/">Blog</a>
      </nav>
      <div className="site-header-actions">
        <a className="github-link" href="https://github.com/aeliqo/aeliqo" target="_blank" rel="noreferrer"><GithubIcon /> <span>GitHub</span></a>
        <span className="site-header-divider" aria-hidden="true" />
        <button className="theme-toggle" type="button" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={handleThemeToggle}>
          <span className={!dark ? "is-selected" : undefined}><MoonIcon /></span>
          <span className={dark ? "is-selected" : undefined}><SunIcon /></span>
        </button>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-brand"><AeliqoLogo /><p>Build interfaces that understand intent.</p></div>
      <div className="site-footer-links"><a href="/docs/">Docs</a><a href="/blog/">Blog</a><a href="/about/">About</a></div>
      <p className="site-footer-meta">Open source · Apache-2.0 · React-first</p>
    </footer>
  );
}

export function SiteFrame({ active, compact, children, className = "", footer = false }: SiteFrameProps) {
  const [dark, setDark] = useState(true);
  return <div className={`aeliqo-design-site ${className}`} data-site-theme={dark ? "dark" : "light"}><SiteHeader active={active} compact={compact} dark={dark} onThemeToggle={() => setDark(value => !value)} />{children}{footer && <SiteFooter />}</div>;
}

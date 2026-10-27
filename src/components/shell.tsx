"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  FlaskConical,
  GitBranch,
  History,
  Layers3,
  ShieldCheck,
} from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="PERSONA LAB home">
      <span className="brand-symbol">
        <GitBranch size={23} strokeWidth={1.8} />
      </span>
      <span>
        PERSONA<span className="brand-lab">LAB</span>
        <small>THE DECISION STUDIO</small>
      </span>
    </Link>
  );
}
export function Shell({
  children,
  page,
  mode = "pending",
}: {
  children: React.ReactNode;
  page: string;
  mode?: string;
}) {
  const pathname = usePathname();
  const historyActive = page === "Practice history";
  const studioActive = pathname === "/" && !historyActive;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">
          <span className="workspace-dot" /> PERSONAL WORKSPACE
        </div>
        <nav aria-label="Main navigation">
          <Link
            href="/"
            className={studioActive ? "nav-item active" : "nav-item"}
            aria-current={studioActive ? "page" : undefined}
          >
            <Layers3 size={18} /> Scenario studio{" "}
            <span className="nav-count">01</span>
          </Link>
          <Link
            href="/?view=history"
            className={historyActive ? "nav-item active" : "nav-item"}
            aria-current={historyActive ? "page" : undefined}
          >
            <History size={18} /> Practice history
          </Link>
          {pathname.startsWith("/sessions") && (
            <div className="nav-item active">
              <GitBranch size={18} /> Your simulation
            </div>
          )}
        </nav>
        <div className="sidebar-note">
          <FlaskConical size={23} />
          <p>
            A little practice.
            <br />
            <strong>A different possibility.</strong>
          </p>
          <span>Explore what happens when you choose another way.</span>
          <div className="mini-path">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="fictional-note">
            <ShieldCheck size={16} />
            <span>
              Fictional scenarios.
              <br />
              Real room to grow.
            </span>
          </div>
          <a
            className="guide-link"
            href="https://github.com/kranthikumark/Persona-Lab"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={15} /> About the project <ArrowUpRight size={14} />
          </a>
          <div className="user-row">
            <span className="user-avatar">Y</span>
            <div>
              <strong>Your workspace</strong>
              <small>Personal practice</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <Link href="/" className="mobile-brand" aria-label="PERSONA LAB home">
            <GitBranch size={18} />
            <span>
              PERSONA <b>LAB</b>
            </span>
          </Link>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{page}</strong>
          </div>
          <div className={`mode-badge ${mode === "meta" ? "live" : ""}`}>
            <span />
            {mode === "meta"
              ? "Meta · Live model"
              : mode === "mock"
                ? "Mock mode · Local practice"
                : "Connecting studio…"}
          </div>
        </header>
        <nav className="compact-nav" aria-label="Workspace navigation">
          <Link href="/" aria-current={studioActive ? "page" : undefined}>
            <Layers3 size={15} /> Studio
          </Link>
          <Link
            href="/?view=history"
            aria-current={historyActive ? "page" : undefined}
          >
            <History size={15} /> History
          </Link>
          {pathname.startsWith("/sessions/") && (
            <Link
              href={pathname.replace(/\/compare$/, "")}
              aria-current={page === "Practice workspace" ? "page" : undefined}
            >
              <GitBranch size={15} /> Practice
            </Link>
          )}
        </nav>
        {children}
        <footer className="app-footer">
          <span>
            PERSONA LAB <span className="footer-dot">·</span> Practice
            Decisions. Explore Consequences. Master Reality.
          </span>
          <span>Simulated outcomes, never predictions.</span>
        </footer>
      </div>
    </div>
  );
}

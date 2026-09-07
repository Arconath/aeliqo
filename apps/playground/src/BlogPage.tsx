import { useMemo, useState } from "react";
import { SiteFrame } from "./site-chrome";
import "./blog-page.css";

const topics = [
  "All",
  "Intent-driven UI",
  "Components",
  "Adaptive UI",
  "Design Systems",
  "Charts",
  "Integrations",
  "BYOK",
  "MCP",
  "Engineering",
  "Product",
  "Tutorials",
] as const;

type Topic = (typeof topics)[number];
type ArticleTopic = Exclude<Topic, "All">;
type ArtworkKind = "intent" | "layers" | "workspace" | "design" | "charts" | "integrations" | "byok";
type SortOrder = "latest" | "shortest";

interface Article {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly topics: readonly ArticleTopic[];
  readonly date: string;
  readonly minutes: number;
  readonly publishedOrder: number;
  readonly artwork: ArtworkKind;
  readonly wide?: boolean;
}

// Static authored examples for the design reference; this page does not claim to be a live feed.
const articles: readonly Article[] = [
  {
    id: "intent-to-interface",
    title: "From intent to interface",
    summary: "How Aeliqo turns natural language into production-ready, adaptive interfaces.",
    topics: ["Intent-driven UI", "Product"],
    date: "Aug 12, 2024",
    minutes: 8,
    publishedOrder: 7,
    artwork: "intent",
    wide: true,
  },
  {
    id: "semantic-components",
    title: "Semantic components for adaptive applications",
    summary: "Go beyond traditional UI libraries with components that understand intent.",
    topics: ["Components", "Intent-driven UI"],
    date: "Aug 8, 2024",
    minutes: 6,
    publishedOrder: 6,
    artwork: "layers",
    wide: true,
  },
  {
    id: "adaptive-workspaces",
    title: "Adaptive workspaces: Interfaces that adapt to your users",
    summary: "How Aeliqo creates context-aware workspaces that evolve with real usage.",
    topics: ["Adaptive UI", "Product"],
    date: "Aug 5, 2024",
    minutes: 7,
    publishedOrder: 5,
    artwork: "workspace",
    wide: true,
  },
  {
    id: "design-system",
    title: "Building a design system with Aeliqo",
    summary: "Composable, intent-driven design systems for the AI era.",
    topics: ["Design Systems", "Tutorials"],
    date: "Aug 1, 2024",
    minutes: 6,
    publishedOrder: 4,
    artwork: "design",
  },
  {
    id: "charts-powered-by-intent",
    title: "Beautiful charts, powered by intent",
    summary: "Generate stunning, interactive charts with simple natural language.",
    topics: ["Charts", "Intent-driven UI"],
    date: "Jul 28, 2024",
    minutes: 5,
    publishedOrder: 3,
    artwork: "charts",
  },
  {
    id: "mcp-integrations",
    title: "MCP integrations: Connect Aeliqo to your tools",
    summary: "Use the Model Context Protocol (MCP) to integrate with your stack.",
    topics: ["Integrations", "MCP", "Engineering"],
    date: "Jul 24, 2024",
    minutes: 7,
    publishedOrder: 2,
    artwork: "integrations",
  },
  {
    id: "byok-with-aeliqo",
    title: "Bring your own keys (BYOK) with Aeliqo",
    summary: "Use your own model keys for full control, privacy, and flexibility.",
    topics: ["BYOK", "Engineering"],
    date: "Jul 20, 2024",
    minutes: 5,
    publishedOrder: 1,
    artwork: "byok",
  },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12.5 12.5 4.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="M2 9h12M10 4l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IntentInterfaceVisual() {
  return (
    <div className="blog-hero-visual" aria-hidden="true">
      <div className="blog-visual-note">Ideas to<br />interfaces.<span /></div>

      <div className="blog-intent-panel">
        <div className="blog-visual-panel-heading"><strong>Your intent</strong><span>⌁</span></div>
        <p>Create a dashboard to monitor product metrics with charts, filters, and a modern layout.</p>
        <div className="blog-visual-chips">
          <span>dashboard</span><span>charts</span><span>filters</span><span>analytics</span><span>ui</span><span>responsive</span>
        </div>
      </div>

      <span className="blog-visual-arrow">→</span>

      <div className="blog-dashboard">
        <div className="blog-dashboard-sidebar">
          <div className="blog-dashboard-brand"><img className="blog-dashboard-brand-mark" src="/aeliqo-logo.png" alt="" width="17" height="17" /><strong>Aeliqo</strong><span className="blog-dashboard-brand-chevron">›</span></div>
          <span className="blog-dashboard-nav is-active"><i>⌂</i>Dashboard</span>
          <span className="blog-dashboard-nav"><i>⌁</i>Analytics</span>
          <span className="blog-dashboard-nav"><i>□</i>Orders</span>
          <span className="blog-dashboard-nav"><i>♙</i>Customers</span>
          <span className="blog-dashboard-nav"><i>◇</i>Products</span>
          <span className="blog-dashboard-nav"><i>⚙</i>Settings</span>
        </div>

        <div className="blog-dashboard-content">
          <div className="blog-dashboard-toolbar"><strong>Concept dashboard</strong><span>Last 30 days⌄</span></div>
          <div className="blog-dashboard-stats">
            <div><small>Total Users</small><strong>12,480</strong><em>↗ 12%</em></div>
            <div><small>Revenue</small><strong>$248,320</strong><em>↗ 8%</em></div>
            <div><small>Active Projects</small><strong>1,429</strong><em>↗ 16%</em></div>
            <div><small>Conversion Rate</small><strong>3.4%</strong><em>↗ 6%</em></div>
          </div>
          <div className="blog-dashboard-panels">
            <div className="blog-dashboard-chart-panel">
              <div><strong>Revenue Trend</strong><span>Last 6 months⌄</span></div>
              <svg viewBox="0 0 330 126" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="blog-chart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#526fff" stopOpacity=".52" />
                    <stop offset="1" stopColor="#526fff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M4 99H326M4 68H326M4 37H326" stroke="#6c84bd" strokeOpacity=".16" />
                <path d="M4 101C22 96 28 103 47 91S75 98 92 82s30 7 48-4 26 8 42-2 24-9 41-4 25-13 43-8 29-19 41-24 13-11 19-13v75H4Z" fill="url(#blog-chart-fill)" />
                <path d="M4 101C22 96 28 103 47 91S75 98 92 82s30 7 48-4 26 8 42-2 24-9 41-4 25-13 43-8 29-19 41-24 13-11 19-13" fill="none" stroke="#6c70ff" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="326" cy="27" r="3.5" fill="#9e8cff" />
              </svg>
              <div className="blog-dashboard-axis"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span></div>
            </div>
            <div className="blog-dashboard-products">
              <strong>Top Products</strong>
              <span><small>Aeliqo Core</small><i><b style={{ width: "75%" }} /></i><em>42%</em></span>
              <span><small>UI Components</small><i><b style={{ width: "52%" }} /></i><em>28%</em></span>
              <span><small>Charts</small><i><b style={{ width: "38%" }} /></i><em>18%</em></span>
              <span><small>Integrations</small><i><b style={{ width: "24%" }} /></i><em>12%</em></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleArtwork({ kind }: { readonly kind: ArtworkKind }) {
  if (kind === "intent") {
    return <div className="blog-card-art blog-card-art-intent" aria-hidden="true"><span /><span /><span><b>Describe.<br />Compose.<br />Ship.</b></span></div>;
  }
  if (kind === "layers") {
    return <div className="blog-card-art blog-card-art-layers" aria-hidden="true"><span /><span /><span /><b /></div>;
  }
  if (kind === "workspace") {
    return <div className="blog-card-art blog-card-art-workspace" aria-hidden="true"><span /><span /><span /></div>;
  }
  if (kind === "design") {
    return <div className="blog-card-art blog-card-art-design" aria-hidden="true"><span /><span /><span /><span /><span /></div>;
  }
  if (kind === "charts") {
    return <div className="blog-card-art blog-card-art-charts" aria-hidden="true"><i /><i /><i /><i /><b /></div>;
  }
  if (kind === "integrations") {
    return <div className="blog-card-art blog-card-art-integrations" aria-hidden="true"><span>◉</span><i>✦</i><b>△</b><em>▦</em></div>;
  }
  return <div className="blog-card-art blog-card-art-byok" aria-hidden="true"><span /><b /><i /><em /></div>;
}

function ArticleMeta({ article }: { readonly article: Article }) {
  return (
    <div className="blog-article-meta">
      <span>Aeliqo Team</span><span aria-hidden="true">·</span><span>{article.date}</span><span aria-hidden="true">·</span><span>{article.minutes} min read</span>
    </div>
  );
}

function ArticleCard({ article }: { readonly article: Article }) {
  return (
    <article className={`blog-article-card${article.wide ? " blog-article-card-wide" : ""}`} aria-labelledby={`article-title-${article.id}`}>
      <ArticleArtwork kind={article.artwork} />
      <div className="blog-article-card-body">
        <span className="blog-article-topic">{article.topics[0]}</span>
        <h3 id={`article-title-${article.id}`}>{article.title}</h3>
        <p>{article.summary}</p>
        <ArticleMeta article={article} />
        <span className="blog-article-arrow" aria-hidden="true"><ArrowIcon /></span>
      </div>
    </article>
  );
}

export function BlogPage() {
  const [selectedTopic, setSelectedTopic] = useState<Topic>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");

  const visibleArticles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = articles.filter((article) => {
      const topicMatches = selectedTopic === "All" || article.topics.includes(selectedTopic);
      const searchMatches = query.length === 0 || [article.title, article.summary, ...article.topics].join(" ").toLowerCase().includes(query);
      return topicMatches && searchMatches;
    });

    return [...filtered].sort((left, right) => sortOrder === "latest" ? right.publishedOrder - left.publishedOrder : left.minutes - right.minutes);
  }, [searchTerm, selectedTopic, sortOrder]);

  return (
    <SiteFrame active="blog" className="blog-page" footer>
      <main className="blog-page-main">
        <section className="blog-featured" id="featured-article" aria-labelledby="blog-featured-title">
          <div className="blog-featured-copy">
            <p className="blog-eyebrow">FEATURED ARTICLE</p>
            <h1 id="blog-featured-title">From intent<br /><span>to interface</span></h1>
            <p className="blog-featured-summary">How Aeliqo turns natural language into production-ready, adaptive interfaces — and what it means for the next generation of development.</p>
            <a className="blog-primary-action" href="#blog-articles">Read the full article <ArrowIcon /></a>
            <div className="blog-featured-meta"><span className="blog-author-mark">A</span><strong>Aeliqo Team</strong><span aria-hidden="true">|</span><span>Aug 12, 2024</span><span aria-hidden="true">·</span><span>8 min read</span></div>
          </div>
          <IntentInterfaceVisual />
        </section>

        <section className="blog-explore" aria-labelledby="blog-explore-title">
          <div className="blog-explore-label" id="blog-explore-title">EXPLORE BY TOPIC</div>
          <div className="blog-explore-controls">
            <div className="blog-topic-list" role="group" aria-label="Filter articles by topic">
              {topics.map((topic) => (
                <button key={topic} type="button" className={selectedTopic === topic ? "is-selected" : undefined} aria-pressed={selectedTopic === topic} onClick={() => setSelectedTopic(topic)}>{topic}</button>
              ))}
            </div>
            <label className="blog-search">
              <span className="blog-visually-hidden">Search articles</span>
              <SearchIcon />
              <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search articles..." />
              <kbd>⌘ K</kbd>
            </label>
          </div>
        </section>

        <section className="blog-articles" id="blog-articles" aria-labelledby="blog-articles-title">
          <div className="blog-articles-heading">
            <div>
              <h2 id="blog-articles-title">Latest from the Aeliqo Blog</h2>
              <p>Tutorials, deep dives, and ideas on building the next generation of adaptive interfaces.</p>
            </div>
            <label className="blog-sort">
              <span>Sort by</span>
              <span className="blog-select-wrap"><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} aria-label="Sort articles"><option value="latest">Latest</option><option value="shortest">Shortest read</option></select><ChevronIcon /></span>
            </label>
          </div>

          <p className="blog-visually-hidden" aria-live="polite">Showing {visibleArticles.length} authored example {visibleArticles.length === 1 ? "article" : "articles"}.</p>
          {visibleArticles.length > 0 ? <div className="blog-article-grid">{visibleArticles.map((article) => <ArticleCard key={article.id} article={article} />)}</div> : <div className="blog-empty-state"><strong>No articles found</strong><p>Try another topic or search term.</p></div>}
        </section>
      </main>
    </SiteFrame>
  );
}

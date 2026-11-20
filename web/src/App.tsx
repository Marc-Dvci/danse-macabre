import { useEffect, useState } from "react";
import { Watch } from "./Watch";
import { About } from "./About";
import { Capture } from "./Capture";
import { Search } from "./Search";

type Tab = "watch" | "video" | "search" | "about";

const TABS: Array<[Tab, string]> = [
  ["watch", "Watch"],
  ["video", "From video"],
  ["search", "Search"],
  ["about", "About"],
];

function tabFromHash(): Tab {
  const h = window.location.hash.replace("#", "");
  return TABS.some(([t]) => t === h) ? (h as Tab) : "watch";
}

export function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const on = () => setTab(tabFromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const params = new URLSearchParams(window.location.search);
  const [clip, setClip] = useState<string | undefined>(params.get("dance") ?? undefined);
  const [at, setAt] = useState<number | undefined>(params.has("at") ? Number(params.get("at")) : undefined);

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1>
            Danse Macabre<span className="tag">Labanotation, 1928</span>
          </h1>
          <p>Dance, written down and read aloud.</p>
        </div>
        <nav className="tabs" role="tablist" aria-label="Sections">
          {TABS.map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                window.location.hash = t;
                setTab(t);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main style={{ minHeight: 0, display: "grid" }}>
        {tab === "watch" && <Watch key={`${clip}-${at}`} initial={clip} startBeat={at} />}
        {tab === "video" && (
          <Capture
            onOpen={(id) => {
              setClip(id);
              window.location.hash = "watch";
              setTab("watch");
            }}
          />
        )}
        {tab === "search" && (
          <Search
            onOpen={(id, beat) => {
              setClip(id);
              setAt(beat);
              window.location.hash = "watch";
              setTab("watch");
            }}
          />
        )}
        {tab === "about" && <About />}
      </main>
    </div>
  );
}

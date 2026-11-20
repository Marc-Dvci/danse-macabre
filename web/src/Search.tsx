// Search: cut a phrase out of one dance and find it, or its mirror image, in every dance.
import { useEffect, useMemo, useState } from "react";
import { CLIPS, loadClip } from "./clips";
import { cutPhrase, findInScore, notateClip, countLabel, type Score } from "./engine";
import { centreClip } from "./pose";
import { layoutStaff, BEAT_HEIGHT } from "./staff";
import { ScoreView } from "./ScoreView";

interface Hit {
  clipId: string;
  title: string;
  beat: number;
  mirrored: boolean;
  label: string;
}

export function Search({ onOpen }: { onOpen: (clipId: string, beat: number) => void }) {
  const [scores, setScores] = useState<Record<string, Score>>({});
  // The opening example: two arm moves from the Russian dance, found in three other dances, once as a mirror image.
  const [source, setSource] = useState(CLIPS.some((c) => c.id === "russian-dance") ? "russian-dance" : CLIPS[0]!.id);
  const [bar, setBar] = useState(CLIPS.some((c) => c.id === "russian-dance") ? 5 : 1);
  const [bars, setBars] = useState(1);
  const [part, setPart] = useState<"arms" | "all">("arms");
  const [mirror, setMirror] = useState(true);
  const [hits, setHits] = useState<Hit[] | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all(CLIPS.map((c) => loadClip(c.id))).then((clips) => {
      if (!live) return;
      const out: Record<string, Score> = {};
      for (const c of clips) out[c.id] = notateClip(centreClip(c.frames), c.title);
      setScores(out);
    });
    return () => {
      live = false;
    };
  }, []);

  const sourceScore = scores[source];
  const totalBars = sourceScore
    ? Math.max(1, Math.ceil(Math.max(0, ...sourceScore.symbols.map((s) => s.start + s.duration)) / sourceScore.beatsPerBar))
    : 1;
  const phrase = useMemo(
    () => (sourceScore ? cutPhrase(sourceScore, (bar - 1) * sourceScore.beatsPerBar, bars * sourceScore.beatsPerBar, part) : null),
    [sourceScore, bar, bars, part],
  );
  const layout = useMemo(() => (phrase ? layoutStaff(phrase) : null), [phrase]);

  function run() {
    if (!phrase || phrase.symbols.length === 0) {
      setHits([]);
      return;
    }
    const found: Hit[] = [];
    for (const c of CLIPS) {
      const s = scores[c.id];
      if (!s) continue;
      const plain = new Set(findInScore(s, phrase, false).map((m) => m.beat));
      for (const m of findInScore(s, phrase, mirror)) {
        if (c.id === source && m.beat === phrase.at && !m.mirrored) continue;
        // A symmetric phrase is its own mirror image: report that place once, as a plain match.
        if (m.mirrored && plain.has(m.beat)) continue;
        const cl = countLabel(s, m.beat);
        found.push({ clipId: c.id, title: c.title, beat: m.beat, mirrored: m.mirrored, label: `bar ${cl.bar}, count ${cl.count}${cl.and ? " and" : ""}` });
      }
    }
    setHits(found);
  }

  return (
    <div className="page">
      <div className="search-grid">
        <section className="prose" aria-label="Phrase">
          <h2>Find a phrase in every dance</h2>
          <p>
            Cut a phrase out of one dance. The search reads the scores, not the videos: it finds every place where the same
            symbols follow each other in the same columns, and, if you ask, where the mirror image does.
          </p>
          <div className="form">
            <label className="field">
              Dance
              <select value={source} onChange={(e) => { setSource(e.target.value); setBar(1); setHits(null); }}>
                {CLIPS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              From bar
              <input type="number" min={1} max={totalBars} value={bar} onChange={(e) => { setBar(Math.max(1, Math.min(totalBars, Number(e.target.value)))); setHits(null); }} />
            </label>
            <label className="field">
              Length in bars
              <input type="number" min={1} max={4} value={bars} onChange={(e) => { setBars(Math.max(1, Math.min(4, Number(e.target.value)))); setHits(null); }} />
            </label>
            <label className="field">
              Body
              <select value={part} onChange={(e) => { setPart(e.target.value as "arms" | "all"); setHits(null); }}>
                <option value="arms">Arms only</option>
                <option value="all">Arms and legs</option>
              </select>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Also find the mirror image
            </label>
          </div>
          <button className="action" onClick={run} disabled={!phrase}>
            Search {CLIPS.length} dances
          </button>
          <div aria-live="polite" className="status">
            {phrase && phrase.symbols.length === 0 && <p>This bar holds no movement in the chosen columns. Pick another bar.</p>}
            {hits && phrase && phrase.symbols.length > 0 && (
              <>
                <p>
                  <strong>{hits.length}</strong> {hits.length === 1 ? "match" : "matches"} for a phrase of {phrase.symbols.length}{" "}
                  {phrase.symbols.length === 1 ? "symbol" : "symbols"}.
                </p>
                <ol className="hits">
                  {hits.map((h, i) => (
                    <li key={i}>
                      <button className="link" onClick={() => onOpen(h.clipId, h.beat)}>
                        {h.title}, {h.label}
                      </button>
                      {h.mirrored && <span className="badge">mirrored</span>}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </section>
        <section aria-label="The phrase as a score" className="phrase-score">
          {layout && phrase && (
            <ScoreView layout={layout} beat={0} beatHeight={BEAT_HEIGHT} selected={null} onSelect={() => undefined} height={520} width={330} />
          )}
        </section>
      </div>
    </div>
  );
}

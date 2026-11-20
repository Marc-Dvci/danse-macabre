// Watch: pick a dance, see the recording as a ghost and the score danced by the skeleton, hear it on the count.
import { useEffect, useMemo, useRef, useState } from "react";
import { CLIPS, CLIP_SOURCE, customClips, loadClip, onCustomClips, type Clip } from "./clips";
import { ScoreView } from "./ScoreView";
import { SymbolEditor } from "./SymbolEditor";
import { BEAT_HEIGHT, layoutStaff } from "./staff";
import { Stage, type View } from "./stage/stage";
import { centreClip, lastTime, sample } from "./pose";
import { bell, hush, say, speechAvailable } from "./audio";
import {
  countLabel,
  describeScore,
  mirror,
  mirrorClip,
  notateClip,
  performScore,
  secondsToBeats,
  type Frame,
  type LessonLine,
  type Score,
} from "./engine";

type Show = "both" | "score" | "recording";

export function Watch({ initial }: { initial?: string }) {
  const [clipId, setClipId] = useState(initial ?? CLIPS[0]!.id);
  const [clip, setClip] = useState<Clip | null>(null);
  const [mirrored, setMirrored] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<View>("front");
  const [show, setShow] = useState<Show>("both");
  const [readAloud, setReadAloud] = useState(false);
  const [countBell, setCountBell] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [scoreHeight, setScoreHeight] = useState(600);
  const [scoreWidth, setScoreWidth] = useState(330);
  const [panel, setPanel] = useState<"score" | "lesson">("score");
  const [edits, setEdits] = useState<Record<string, { direction: string; level: string }>>({});
  const [extra, setExtra] = useState(customClips);
  useEffect(() => onCustomClips(() => setExtra(customClips())), []);
  const all = [...CLIPS, ...extra];

  const stageHost = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const scoreBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setPlaying(false);
    setTime(0);
    setEdits({});
    setSelected(null);
    loadClip(clipId).then((c) => live && setClip(c));
    return () => {
      live = false;
    };
  }, [clipId]);

  const recording: Frame[] = useMemo(() => {
    if (!clip) return [];
    const centred = centreClip(clip.frames);
    return mirrored ? mirrorClip(centred) : centred;
  }, [clip, mirrored]);

  const notated: Score | null = useMemo(() => {
    if (!clip) return null;
    const s = notateClip(centreClip(clip.frames), clip.title);
    return mirrored ? mirror(s) : s;
  }, [clip, mirrored]);

  // The reader's edits, applied on top of the written score.
  const score: Score | null = useMemo(() => {
    if (!notated) return null;
    if (Object.keys(edits).length === 0) return notated;
    return {
      ...notated,
      symbols: notated.symbols.map((s) => {
        const e = edits[s.id];
        return e ? { ...s, direction: e.direction as typeof s.direction, level: e.level as typeof s.level } : s;
      }),
    };
  }, [notated, edits]);
  const selectedSymbol = score?.symbols.find((s) => s.id === selected) ?? null;

  const performed = useMemo(() => (score ? performScore(score) : []), [score]);
  const lesson: LessonLine[] = useMemo(() => (score ? describeScore(score) : []), [score]);
  const layout = useMemo(() => (score ? layoutStaff(score) : null), [score]);
  const duration = Math.max(lastTime(recording), lastTime(performed));
  const beat = score ? secondsToBeats(score, time) : 0;

  useEffect(() => {
    if (!stageHost.current) return;
    const s = new Stage(stageHost.current);
    stage.current = s;
    return () => s.dispose();
  }, []);

  useEffect(() => {
    if (!scoreBox.current) return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      setScoreHeight(e.contentRect.height);
      setScoreWidth(e.contentRect.width);
    });
    ro.observe(scoreBox.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => stage.current?.setView(view), [view]);

  // Draw the current time.
  useEffect(() => {
    const s = stage.current;
    if (!s) return;
    const scorePose = sample(performed, time);
    const recPose = sample(recording, time);
    if (show !== "recording" && scorePose) s.show(scorePose);
    s.showBones(show !== "recording");
    s.showGhost(show !== "score" ? recPose : null);
    if (show === "recording" && recPose) s.show(recPose);
    s.showBones(show !== "recording");
  }, [time, performed, recording, show]);

  // Playback clock, bell on each count, spoken lesson on each line.
  const lastBeat = useRef(-1);
  const lastLine = useRef(-1);
  useEffect(() => {
    if (!playing || !score) return;
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = ((now - prev) / 1000) * speed;
      prev = now;
      setTime((t) => {
        const next = t + dt;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        const b = Math.floor(secondsToBeats(score, next));
        if (b !== lastBeat.current) {
          lastBeat.current = b;
          if (countBell) bell(b % score.beatsPerBar === 0);
        }
        const li = lesson.findIndex((l, i) => {
          const nb = lesson[i + 1]?.beat ?? Infinity;
          const cur = secondsToBeats(score, next);
          return cur >= l.beat && cur < nb;
        });
        if (li !== lastLine.current) {
          lastLine.current = li;
          if (readAloud && li >= 0) say(lesson[li]!.text, Math.min(1.4, Math.max(0.8, speed)));
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, score, speed, duration, countBell, readAloud, lesson]);

  useEffect(() => {
    if (!playing) hush();
  }, [playing]);

  // Keyboard: space plays or pauses, arrows step one count, M mirrors.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, select, textarea, [contenteditable]")) return;
      if (!score) return;
      const beatSec = 60 / score.tempo;
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight") {
        setTime((t) => Math.min(duration, (Math.floor(t / beatSec + 1e-6) + 1) * beatSec));
      } else if (e.key === "ArrowLeft") {
        setTime((t) => Math.max(0, (Math.ceil(t / beatSec - 1e-6) - 1) * beatSec));
      } else if (e.key === "m" || e.key === "M") {
        setMirrored((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [score, duration]);

  const current = lesson.findLast((l) => l.beat <= beat + 1e-6);
  const c = score ? countLabel(score, beat) : null;
  const info = all.find((x) => x.id === clipId) ?? CLIPS[0]!;

  return (
    <div className="watch">
      <nav className="dances" aria-label="Dances">
        <h2>Dances</h2>
        {all.map((d) => (
          <button key={d.id} className="dance" aria-current={d.id === clipId} onClick={() => setClipId(d.id)}>
            <span className="name">{d.title}</span>
            <span className="meta">
              {d.subject === "video" ? `${d.seconds} s · read from video` : `${d.seconds} s · CMU subject ${d.subject}, trial ${d.trial}`}
            </span>
          </button>
        ))}
      </nav>

      <section className="stage-wrap" aria-label="Stage">
        <div className="stage" ref={stageHost}>
          <div className="views" role="group" aria-label="Camera">
            {(
              [
                ["front", "Front"],
                ["behind", "Behind (learner's view)"],
                ["side", "Side"],
                ["above", "Above"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} className="chip" aria-pressed={view === v} onClick={() => setView(v)}>
                {label}
              </button>
            ))}
          </div>
          <div className="legend">
            <div className="views" role="group" aria-label="Show" style={{ position: "static", justifyContent: "flex-end" }}>
              {(
                [
                  ["both", "Score + ghost"],
                  ["score", "Score"],
                  ["recording", "Recording"],
                ] as const
              ).map(([v, label]) => (
                <button key={v} className="chip" aria-pressed={show === v} onClick={() => setShow(v)}>
                  {label}
                </button>
              ))}
            </div>
            <p style={{ margin: "8px 0 0" }}>
              Bones: the score, danced. Pale ghost: the recording.
            </p>
          </div>
        </div>
        <div className="caption" aria-live="polite">
          {current ? (
            <>
              <span className="count">{current.label}</span>
              <span className="line">{current.text}</span>
            </>
          ) : (
            <span className="line">{lesson[0]?.text ?? "Loading the dance."}</span>
          )}
        </div>
      </section>

      <aside className="score-panel" aria-label="Score">
        <header>
          <div className="tabs" role="tablist" aria-label="Score or lesson">
            <button role="tab" aria-selected={panel === "score"} onClick={() => setPanel("score")}>
              Score
            </button>
            <button role="tab" aria-selected={panel === "lesson"} onClick={() => setPanel("lesson")}>
              Lesson
            </button>
          </div>
          <span style={{ fontSize: 13, color: "var(--bone-3)" }}>
            {score ? `${score.symbols.length} symbols · ${score.tempo}/min` : ""}
          </span>
        </header>
        <div ref={scoreBox} style={{ minHeight: 0, position: "relative", overflow: "hidden" }}>
          {panel === "score" && layout && score && (
            <ScoreView
              layout={layout}
              beat={beat}
              beatHeight={BEAT_HEIGHT}
              selected={selected}
              onSelect={(id) => setSelected(id.startsWith("start-") ? null : id)}
              height={scoreHeight}
              width={scoreWidth}
            />
          )}
          {panel === "score" && selectedSymbol && (
            <SymbolEditor
              symbol={selectedSymbol}
              edited={selectedSymbol.id in edits}
              onChange={(direction, level) => setEdits((e) => ({ ...e, [selectedSymbol.id]: { direction, level } }))}
              onReset={() =>
                setEdits((e) => {
                  const { [selectedSymbol.id]: _, ...rest } = e;
                  return rest;
                })
              }
              onClose={() => setSelected(null)}
            />
          )}
          {panel === "lesson" && (
            <ol className="lesson-list" style={{ overflowY: "auto", height: "100%", padding: "0 18px" }}>
              {lesson.map((l, i) => (
                <li key={i} aria-current={current === l}>
                  <span className="count">{l.label}</span>
                  {l.text}
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>

      <div className="transport" style={{ gridColumn: "1 / -1" }}>
        <button
          className="play"
          aria-pressed={playing}
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => {
            if (!playing && time >= duration) setTime(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div className="clock" aria-live="off">
          {c ? `Bar ${c.bar} · count ${c.count}${c.and ? " and" : ""}` : "—"}
        </div>
        <input
          type="range"
          aria-label="Position"
          min={0}
          max={duration || 1}
          step={0.01}
          value={time}
          onChange={(e) => setTime(Number(e.target.value))}
          style={{ width: 220 }}
        />
        <label className="field">
          Tempo
          <input type="range" min={0.5} max={1.5} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          <span>{Math.round((score?.tempo ?? 100) * speed)}</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={mirrored} onChange={(e) => setMirrored(e.target.checked)} /> Mirror
        </label>
        <label className="toggle">
          <input type="checkbox" checked={countBell} onChange={(e) => setCountBell(e.target.checked)} /> Count bell
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={readAloud}
            disabled={!speechAvailable()}
            onChange={(e) => setReadAloud(e.target.checked)}
          />{" "}
          Read aloud
        </label>
        <span className="source">
          {info.description} · {CLIP_SOURCE.split(" (")[0]}
        </span>
      </div>
    </div>
  );
}

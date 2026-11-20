// The Labanotation staff, read from bottom to top. The candle playhead stays still; the score moves under it.
import { useMemo } from "react";
import type { StaffLayout } from "./staff";

interface Props {
  layout: StaffLayout;
  beat: number;
  /** Counts per bar: the candle flares on every count, and harder on the first count of a bar. */
  beatsPerBar?: number;
  beatHeight: number;
  selected: string | null;
  onSelect: (symbolId: string) => void;
  height: number;
  width: number;
}

const PLAYHEAD_FROM_TOP = 0.62;

export function ScoreView({ layout, beat, beatsPerBar = 4, beatHeight, selected, onSelect, height, width }: Props) {
  const count = Math.floor(beat + 1e-6);
  const SCALE = Math.min(2.4, Math.max(1.2, (width - 24) / layout.width));
  const flip = (y: number) => layout.height - y;
  const originY = layout.origin;
  const playY = flip(originY + beat * beatHeight);
  const offsetY = height * PLAYHEAD_FROM_TOP - playY * SCALE;

  const active = useMemo(() => {
    const on = new Set<string>();
    for (const g of layout.glyphs) {
      const start = (g.y - originY) / beatHeight;
      const end = start + g.h / beatHeight;
      if (beat >= start && beat < end) on.add(g.symbolId);
    }
    return on;
  }, [layout, beat, beatHeight, originY]);

  return (
    <div className="score-scroll" style={{ height }}>
      <svg
        role="img"
        aria-label={`Labanotation score, ${layout.glyphs.length} symbols`}
        width={layout.width * SCALE}
        height={layout.height * SCALE}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{ transform: `translate(${(-layout.width * SCALE) / 2}px, ${offsetY}px)` }}
      >
        <defs>
          <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1.1" />
          </pattern>
        </defs>
        {layout.lines.map((l, i) => (
          <line
            key={`l${i}`}
            x1={l.x1}
            x2={l.x2}
            y1={flip(l.y1)}
            y2={flip(l.y2)}
            stroke="rgba(236,230,214,0.5)"
            strokeWidth={0.6}
          />
        ))}
        {layout.bars.map((b, i) => (
          <g key={`b${i}`}>
            <line x1={layout.left} x2={layout.right} y1={flip(b.y)} y2={flip(b.y)} stroke="rgba(236,230,214,0.45)" strokeWidth={0.6} />
            {b.double && (
              <line
                x1={layout.left}
                x2={layout.right}
                y1={flip(b.y) + 2.2}
                y2={flip(b.y) + 2.2}
                stroke="rgba(236,230,214,0.45)"
                strokeWidth={0.6}
              />
            )}
            {b.label && (
              <text x={layout.right + 4} y={flip(b.y) - 3} fontSize={7} fill="#e2553f" textAnchor="start" fontFamily="IM Fell English SC">
                {b.label}
              </text>
            )}
          </g>
        ))}
        {layout.counts.map((c, i) => (
          <text key={`c${i}`} x={layout.left - 3} y={flip(c.y) + 2} fontSize={5} fill="rgba(236,230,214,0.55)" textAnchor="end">
            {c.label}
          </text>
        ))}
        {layout.glyphs.map((g) => {
          const pts = g.polygon.map(([x, y]) => `${x},${flip(y)}`).join(" ");
          const on = active.has(g.symbolId) || selected === g.symbolId;
          const color = on ? "#e2553f" : "#ece6d6";
          const cx = g.x + g.w / 2;
          const cy = flip(g.y + g.h / 2);
          return (
            <g
              key={g.symbolId}
              data-symbol-id={g.symbolId}
              style={{ color, cursor: "pointer" }}
              onClick={() => onSelect(g.symbolId)}
            >
              <title>{g.label}</title>
              <polygon
                points={pts}
                fill={g.kind === "turn" ? "none" : g.level === "low" ? color : g.level === "high" ? "url(#hatch)" : "none"}
                stroke={color}
                strokeWidth={0.8}
                strokeLinejoin="round"
                pointerEvents="all"
              />
              {g.level === "middle" && <circle cx={cx} cy={cy} r={1.3} fill={color} />}
              {g.kind === "turn" && g.amount && (
                <text x={cx} y={cy + 1.8} fontSize={4.5} fill={color} textAnchor="middle">
                  {g.amount}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="playhead" style={{ top: height * PLAYHEAD_FROM_TOP }} aria-hidden="true">
        {/* Keyed by the count, so its flare restarts on every count, like the bell. */}
        <span key={count} className={`flame${count % beatsPerBar === 0 ? " down" : ""}`} />
      </div>
    </div>
  );
}

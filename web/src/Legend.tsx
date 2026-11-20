// The 27 direction symbols: nine directions (laid out as they point around the dancer) at three levels.
import { unitShape } from "./staff";

const GRID = [
  ["left-forward", "forward", "right-forward"],
  ["left", "place", "right"],
  ["left-backward", "backward", "right-backward"],
] as const;
const LEVELS = [
  ["high", "High: stripes"],
  ["middle", "Middle: a dot"],
  ["low", "Low: solid"],
] as const;

function Glyph({ direction, level }: { direction: string; level: string }) {
  const w = 22;
  const h = 34;
  const pts = unitShape(direction)
    .map(([x, y]) => `${3 + x * w},${3 + (1 - y) * h}`)
    .join(" ");
  return (
    <svg width={w + 6} height={h + 6} viewBox={`0 0 ${w + 6} ${h + 6}`} role="img" aria-label={`${direction.replace("-", " ")}, ${level}`}>
      <defs>
        <pattern id={`lg-${direction}-${level}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#ece6d6" strokeWidth="1.1" />
        </pattern>
      </defs>
      <polygon
        points={pts}
        fill={level === "low" ? "#ece6d6" : level === "high" ? `url(#lg-${direction}-${level})` : "none"}
        stroke="#ece6d6"
        strokeWidth="1.2"
      />
      {level === "middle" && <circle cx={3 + w / 2} cy={3 + h / 2} r="2" fill="#ece6d6" />}
    </svg>
  );
}

export function Legend() {
  return (
    <div className="legend-grid" role="group" aria-label="The 27 direction symbols">
      {LEVELS.map(([level, label]) => (
        <figure key={level}>
          <div className="compass">
            {GRID.flat().map((d) => (
              <span key={d} className="glyph-cell" title={`${d.replace("-", " ")} ${level}`}>
                <Glyph direction={d} level={level} />
              </span>
            ))}
          </div>
          <figcaption>{label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

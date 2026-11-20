// Edit one symbol: pick a new direction and level. The skeleton dances the edited score at once.
import { durationWords, type DirectionSymbol } from "./engine";

const DIRECTIONS = [
  ["left-forward", "forward", "right-forward"],
  ["left", "place", "right"],
  ["left-backward", "backward", "right-backward"],
] as const;
const LEVELS = ["high", "middle", "low"] as const;

const ICON: Record<string, string> = {
  "left-forward": "M2 2 L14 6 L14 18 L2 18 Z",
  forward: "M2 2 L8 2 L8 6 L14 6 L14 18 L2 18 Z",
  "right-forward": "M2 6 L14 2 L14 18 L2 18 Z",
  left: "M14 2 L14 18 L2 10 Z",
  place: "M2 2 L14 2 L14 18 L2 18 Z",
  right: "M2 2 L14 10 L2 18 Z",
  "left-backward": "M2 2 L14 2 L14 14 L2 18 Z",
  backward: "M2 2 L14 2 L14 18 L8 18 L8 14 L2 14 Z",
  "right-backward": "M2 2 L14 2 L14 18 L2 14 Z",
};

interface Props {
  symbol: DirectionSymbol;
  /** Where the symbol starts, as "bar 2, count 3 and". */
  when: string;
  edited: boolean;
  onChange: (direction: string, level: string) => void;
  onReset: () => void;
  onClose: () => void;
}

export function SymbolEditor({ symbol, when, edited, onChange, onReset, onClose }: Props) {
  const gesture = !symbol.column.endsWith("support");
  const part = symbol.column.replace("-", " ").replace("support", "foot (step)");
  return (
    <div className="editor" role="dialog" aria-label={`Edit ${part} symbol`}>
      <div className="editor-head">
        <strong>{part}</strong>
        <span>
          {when}, {durationWords(symbol.duration)}
        </span>
        <button className="chip" onClick={onClose} aria-label="Close editor">
          Close
        </button>
      </div>
      {/* The nine directions, each drawn at the symbol's level, as on the staff: high striped, middle a dot, low solid. */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs>
          <pattern id="editor-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="3" stroke="currentColor" strokeWidth="1.1" />
          </pattern>
        </defs>
      </svg>
      <div className="editor-grid" role="group" aria-label="Direction">
        {DIRECTIONS.flat().map((d) => (
          <button
            key={d}
            className="glyph-btn"
            aria-pressed={symbol.direction === d}
            aria-label={d.replace("-", " ")}
            disabled={gesture && d === "place" && symbol.level === "middle"}
            onClick={() => onChange(d, symbol.level)}
          >
            <svg viewBox="0 0 16 20" width="22" height="28" aria-hidden="true">
              <path
                d={ICON[d]}
                fill={symbol.level === "low" ? "currentColor" : symbol.level === "high" ? "url(#editor-hatch)" : "none"}
                stroke="currentColor"
                strokeWidth="1.2"
              />
              {symbol.level === "middle" && <circle cx="8" cy="10.5" r="1.6" fill="currentColor" />}
            </svg>
          </button>
        ))}
      </div>
      <div className="editor-levels" role="group" aria-label="Level">
        {LEVELS.map((l) => (
          <button
            key={l}
            className="chip"
            aria-pressed={symbol.level === l}
            disabled={gesture && symbol.direction === "place" && l === "middle"}
            onClick={() => onChange(symbol.direction, l)}
          >
            {l}
          </button>
        ))}
      </div>
      {edited && (
        <button className="chip" onClick={onReset}>
          Undo my edit
        </button>
      )}
    </div>
  );
}

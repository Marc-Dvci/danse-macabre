"""Write a 16-bar waltz score for the finale, arms only, so the finale scene can be built before the composed version.

    python tools/placeholder_finale.py data/scores/danse-macabre.score.json
"""

from __future__ import annotations

import json
import sys

# Each bar is 3 counts. Arms sweep on count 1 and answer on count 3, the way Holbein's skeletons fling their arms.
PATTERN = [
    (("right-arm", "right", "high", 2), ("left-arm", "left", "low", 2)),
    (("right-arm", "forward", "middle", 2), ("left-arm", "left-forward", "high", 2)),
    (("right-arm", "place", "high", 2), ("left-arm", "left", "middle", 2)),
    (("right-arm", "right-backward", "low", 2), ("left-arm", "place", "high", 2)),
]


def main() -> int:
    symbols = []
    n = 0
    for bar in range(16):
        right, left = PATTERN[bar % 4]
        if bar % 2:
            right, left = (left[0].replace("left", "right"), *left[1:]), (right[0].replace("right", "left"), *right[1:])
        for col, direction, level, dur in (right, left):
            if col.startswith("left") and direction.startswith("right"):
                direction = direction.replace("right", "left")
            elif col.startswith("right") and direction.startswith("left"):
                direction = direction.replace("left", "right")
            symbols.append(
                {"id": f"{col}-{n}", "column": col, "start": bar * 3, "duration": dur, "direction": direction, "level": level}
            )
            n += 1
    score = {
        "version": 1,
        "title": "Danse macabre: the finale",
        "tempo": 204,
        "beatsPerBar": 3,
        "grid": 1,
        "startPosition": {
            "left-arm": {"direction": "place", "level": "low"},
            "right-arm": {"direction": "place", "level": "low"},
            "left-leg": {"direction": "place", "level": "low"},
            "right-leg": {"direction": "place", "level": "low"},
        },
        "symbols": symbols,
        "source": "Placeholder arms-only waltz, replaced by the composed finale.",
    }
    with open(sys.argv[1], "w", encoding="utf-8") as f:
        json.dump(score, f, indent=1)
    print(len(symbols), "symbols")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

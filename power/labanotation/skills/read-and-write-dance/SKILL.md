---
name: read-and-write-dance
description: Write a dance phrase in Labanotation, check it, play it, and describe it as a count-by-count lesson. Use when the user asks to choreograph, notate or describe a dance, or to turn a motion-capture clip into a score.
---

# Read and write dance with the Labanotation server

The `danse-macabre` MCP server writes dance as a Labanotation score. Use its tools; do not invent notation by hand.

## Tools

- `compose_score`: write a phrase from moves. Use this first.
- `validate_score`: check a score. It returns `{ ok, errors }`.
- `describe_score`: the spoken lesson, one line per count.
- `perform_score`: frames for the 3D skeleton. Pass `outPath` to write a file.
- `render_score_svg`: the staff as SVG. Pass `outPath` to write a file.
- `notate_clip`: a clip under `data/clips/` to a score.
- `mirror_score`, `retime_score`, `find_phrase`: mirror, change speed, search for a phrase.

## Compose a phrase

1. Fix the metre and tempo: `tempo` in beats per minute, `beatsPerBar` (3 for a waltz, 4 for a march), and `grid` in beats. Use `grid: 1` for whole counts.
2. Write one move per symbol. A move has:
   - `count`: the count it starts on, 1-based across the whole phrase. Count 1 is the first beat.
   - `column`: `left-arm`, `right-arm`, `left-leg`, `right-leg`, `left-support` or `right-support`.
   - `direction` and `level`: for an arm or leg, where the free end goes and how high. For a foot, the way the weight travels and how low the knee is.
   - `counts`: how many counts the move lasts. A move that lasts 3 counts sweeps the limb across the whole bar.
   - A turn move uses `turn` ("cw" or "ccw"), `amount` (0.25, 0.5, 0.75 or 1) and `column` set to a support foot.
3. Set `startPosition` when the dance does not start with the arms down. Arms down is `place` with level `low`.
4. Moves in one column must not overlap in time. Give each limb one move per count, or a longer move that covers the counts.

Example move: `{ "count": 1, "column": "right-arm", "direction": "forward", "level": "middle", "counts": 1 }`.

Directions: `place`, `forward`, `backward`, `left`, `right`, `left-forward`, `right-forward`, `left-backward`, `right-backward`.
Levels: `high`, `middle`, `low`. `place high` is straight up. `place low` on an arm is arms down by the sides.
A gesture cannot use `place middle`. A foot step can.

## Check and describe

1. Pass the score to `validate_score`. Fix every error it lists, then compose again.
2. Pass the valid score to `describe_score`. Read the lines back to the user, or check that a line says what you meant.
3. For a visual check, call `render_score_svg` with an `outPath` and give the path to the user.

## Rules to keep

- Every spoken word must come from a symbol in the score. Do not add counts, sides or body parts the score does not contain.
- Describe a clip by its source: CMU subject and trial, or the name of the generator. Do not claim a clip is a notation you did not run.
- Write files only inside the workspace. The server refuses other paths.

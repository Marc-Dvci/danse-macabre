---
inclusion: always
---

# Danse Macabre: product

Danse Macabre writes dance down. It turns a motion-capture clip or a webcam take into a Labanotation score (the
dance notation Rudolf Laban published in 1928), plays any score back on a 3D skeleton, and reads the score aloud on
the count so a blind or low-vision dancer can learn the dance.

One score, three outputs:

- **The score**: a Labanotation staff, edited symbol by symbol, searchable by movement phrase.
- **The skeleton**: the score drives a skeleton from any angle and at any tempo. It dances exactly what the score says.
- **The spoken lesson**: every symbol becomes an instruction on the count, for example
  "Count 3: right arm moves forward, high."

Users: dance teachers and students, choreographers who want a written record, archives, and blind or low-vision
learners. Tutorial narration rarely says what the body does in enough detail (Das et al., arXiv 2511.09658).

Hackathon: Kiroween 2026, Costume Contest category ("a haunting user interface that's polished and unforgettable;
spooky design elements that enhance your app's function"). The skeleton is the spooky element and it is also the
check: it performs exactly what the score says.

## Principles

- Deterministic first. Symbols, timing, playback and the spoken lesson come from code in `packages/core`. No language
  model decides anything in the product.
- Every spoken word traces to a symbol. A lesson line that names a count, side, body part, direction or level the
  score does not contain is a bug.
- Plain words first: say "right arm, forward high" before any Halloween wording. Theme names are decoration.

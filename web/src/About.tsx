import { CLIP_SOURCE } from "./clips";

export function About() {
  return (
    <div className="page">
      <article className="prose">
        <figure className="plate">
          <img src="./art/the-trumpeters-of-death.webp" alt="Woodcut: skeletons blowing trumpets and beating drums" />
          <figcaption>Hans Holbein the Younger, Dance of Death: The Trumpeters of Death (1520s). Cleveland Museum of Art, CC0.</figcaption>
        </figure>
        <h2>What it does</h2>
        <p>
          Danse Macabre writes dance down. It turns a motion-capture recording into a Labanotation score, the dance
          notation Rudolf Laban published in 1928, plays any score back on a skeleton, and reads it aloud on the count so
          a blind or low-vision dancer can learn it.
        </p>
        <h2>How to read the score</h2>
        <p>
          The staff reads from bottom to top: time runs upward, and a symbol's length is how long the movement takes. The
          centre line splits the body. Next to it are the supports (steps), then the legs, then the arms. A symbol's shape
          gives the direction: a rectangle is place, a triangle is a side, a notched rectangle is forward or backward, a
          slanted one is a diagonal. Its shading gives the level: stripes are high, a dot is middle, solid is low.
        </p>
        <h2>Where the dances come from</h2>
        <p>{CLIP_SOURCE}.</p>
      </article>
    </div>
  );
}

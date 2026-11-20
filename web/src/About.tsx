import { CLIP_SOURCE } from "./clips";
import { Legend } from "./Legend";

export function About() {
  return (
    <div className="page" tabIndex={0} role="region" aria-label="About Danse Macabre">
      <article className="prose">
        <figure className="plate">
          <img src="./art/the-trumpeters-of-death.webp" alt="Woodcut: skeletons blowing trumpets and beating drums under an arch" />
          <figcaption>Hans Holbein the Younger, Dance of Death: The Trumpeters of Death. Cleveland Museum of Art, CC0.</figcaption>
        </figure>

        <h2>What it does</h2>
        <p>
          Danse Macabre writes dance down. It turns a motion-capture recording or a video into a Labanotation score, the
          dance notation Rudolf Laban published in 1928, plays any score back on a skeleton, and reads it aloud on the count
          so that a blind or low-vision dancer can learn the dance.
        </p>

        <h2>Why write a dance down</h2>
        <p>
          Vaslav Nijinsky made <em>L'après-midi d'un faune</em> in 1912 and wrote it down a few years later in a notation of
          his own. Nobody could read it for seventy years. In the late 1980s Ann Hutchinson Guest and Claudia Jeschke
          deciphered it, and the ballet was danced again from the score. A dance survives when it is written down.
        </p>
        <p>
          Laban's notation does for movement what sheet music does for sound, and the Dance Notation Bureau in New York has
          kept more than 800 theatrical scores in it since 1940. Few people can still write it. Today a dance lives in a phone
          video, which a computer cannot read and a blind dancer cannot follow: a 2025 study of remote dance teaching found
          that tutorial narration rarely says what the body does in enough detail to learn from (Das et al., arXiv
          2511.09658).
        </p>

        <h2>How to read the score</h2>
        <p>
          The staff reads from bottom to top: time runs upward, and a symbol's length is how long the movement takes. The
          centre line splits the body. Next to it are the supports (where the weight goes, so the steps), then the legs,
          then, past an empty column for the torso, the arms. Counts are numbered on the left and bars are marked by lines;
          the starting position sits under the double line.
        </p>
        <p>
          A symbol's shape gives the direction, laid out below as the directions point around the dancer. Its shading
          gives the level.
        </p>
        <Legend />

        <h2>Why skeletons</h2>
        <p>
          The skeleton does a job. Bones show every limb's direction with nothing in the way, so you can check the score
          against the dance. The pale figure behind it is the recording; the bones dance only what the score says. The
          engraved ring on the floor carries Laban's eight directions and turns with the dancer, because in this notation
          "forward" is wherever the dancer faces. The view from behind puts your left where the dancer's left is.
        </p>

        <h2>Where everything comes from</h2>
        <ul>
          <li>Dances: {CLIP_SOURCE}.</li>
          <li>Woodcuts: Hans Holbein the Younger, Dance of Death (1520s), scans by the Cleveland Museum of Art, CC0.</li>
          <li>
            Music: Camille Saint-Saëns, Danse macabre (1874), played by the Orchestre des Concerts Colonne under Louis
            Fourestier (1953), public domain, from the Bibliothèque nationale de France via Wikimedia Commons.
          </li>
          <li>Pose reading from video: MediaPipe Pose Landmarker (Apache 2.0).</li>
        </ul>
      </article>
    </div>
  );
}

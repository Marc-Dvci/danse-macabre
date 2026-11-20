// First visit: a woodcut, the title and two sentences, then the dance.
import { useEffect, useRef } from "react";

const KEY = "danse-macabre:prologue-seen";

export function prologueSeen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1" || new URLSearchParams(window.location.search).has("dance");
  } catch {
    return false;
  }
}

export function Prologue({ onEnter }: { onEnter: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);
  const enter = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* private mode: show it again next time */
    }
    onEnter();
  };
  return (
    <div className="prologue" role="dialog" aria-modal="true" aria-labelledby="prologue-title">
      <img src="./art/the-trumpeters-of-death.webp" alt="Woodcut: skeletons blowing trumpets and beating drums" />
      <div className="prologue-text">
        <h1 id="prologue-title">Danse Macabre</h1>
        <p className="lead">Dance, written down and read aloud.</p>
        <p>
          In 1928 Rudolf Laban gave dance its sheet music. This app brings it back: it writes a dance down as a
          Labanotation score, a skeleton dances the score back, and every movement is read aloud on its count.
        </p>
        <button ref={button} className="action" onClick={enter}>
          Enter the dance
        </button>
      </div>
    </div>
  );
}

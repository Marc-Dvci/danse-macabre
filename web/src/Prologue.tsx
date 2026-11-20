// First visit: a woodcut, the title and two sentences, then the dance.
import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "./effects";

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
  // The page behind stays covered from the first frame; the woodcut and the words fade in once the fonts are ready,
  // so nothing is seen in a fallback font. On Enter, they dissolve upward like smoke before the dance appears.
  const [phase, setPhase] = useState<"wait" | "in" | "out">("wait");
  useEffect(() => {
    let live = true;
    const show = () => live && setPhase((p) => (p === "wait" ? "in" : p));
    void document.fonts?.ready.then(show);
    const fallback = window.setTimeout(show, 1200);
    return () => {
      live = false;
      window.clearTimeout(fallback);
    };
  }, []);
  useEffect(() => {
    if (phase === "in") button.current?.focus();
  }, [phase]);
  const enter = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* private mode: show it again next time */
    }
    if (reducedMotion()) {
      onEnter();
      return;
    }
    setPhase("out");
    window.setTimeout(onEnter, 900);
  };
  return (
    <div className={`prologue ${phase}`} role="dialog" aria-modal="true" aria-labelledby="prologue-title">
      <img src="./art/the-trumpeters-of-death.webp" alt="Woodcut: skeletons blowing trumpets and beating drums" />
      <div className="prologue-text">
        <h1 id="prologue-title">Danse Macabre</h1>
        <p className="lead">Dance, written down and read aloud.</p>
        <p>
          In 1928 Rudolf Laban gave dance its sheet music. This app brings it back: it writes a dance down as a
          Labanotation score, a skeleton dances the score back, and every movement is read aloud on its count.
        </p>
        <button ref={button} className="action" onClick={enter} disabled={phase === "out"}>
          Enter the dance
        </button>
      </div>
    </div>
  );
}

// Small Halloween touches that answer a click: a pale wisp rises where a control is pressed. Nothing here carries
// information, so every effect is skipped when the reader asks for reduced motion.

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

const CONTROLS = "button, a, [role='tab'], input, select, label, g[data-symbol-id]";

/** A ring of pale ectoplasm and a few motes of bone dust at (x, y), gone after a second. */
export function wisp(x: number, y: number): void {
  if (reducedMotion()) return;
  const host = document.createElement("div");
  host.className = "wisp";
  host.setAttribute("aria-hidden", "true");
  host.style.left = `${x}px`;
  host.style.top = `${y}px`;
  const ring = document.createElement("span");
  ring.className = "wisp-ring";
  host.appendChild(ring);
  for (let i = 0; i < 6; i++) {
    const mote = document.createElement("span");
    mote.className = "wisp-mote";
    const angle = -Math.PI / 2 + (i - 2.5) * 0.42 + (Math.random() - 0.5) * 0.3;
    const reach = 26 + Math.random() * 22;
    mote.style.setProperty("--dx", `${Math.cos(angle) * reach}px`);
    mote.style.setProperty("--dy", `${Math.sin(angle) * reach - 10}px`);
    mote.style.animationDelay = `${i * 25}ms`;
    host.appendChild(mote);
  }
  document.body.appendChild(host);
  window.setTimeout(() => host.remove(), 1100);
}

/** Every press on a control leaves a wisp. Returns a function that removes the listener. */
export function installClickWisps(): () => void {
  const on = (e: PointerEvent) => {
    const el = e.target as Element | null;
    if (!el?.closest?.(CONTROLS)) return;
    wisp(e.clientX, e.clientY);
  };
  document.addEventListener("pointerdown", on);
  return () => document.removeEventListener("pointerdown", on);
}

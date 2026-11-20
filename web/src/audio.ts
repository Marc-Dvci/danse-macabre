// Sound: a small synthesised bell on each count, and the spoken lesson through the browser's speech engine.

let ctx: AudioContext | null = null;

/** A short bell strike. `accent` marks the first count of a bar with a lower, longer tone. */
export function bell(accent: boolean): void {
  ctx ??= new AudioContext();
  const now = ctx.currentTime;
  const base = accent ? 392 : 523.25;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.12, now + 0.005);
  out.gain.exponentialRampToValueAtTime(0.0001, now + (accent ? 1.6 : 0.7));
  out.connect(ctx.destination);
  // Bell partials (hum, prime, tierce, quint, nominal).
  for (const [ratio, amp] of [
    [0.5, 0.35],
    [1, 1],
    [1.2, 0.5],
    [1.5, 0.3],
    [2, 0.4],
  ] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = base * ratio;
    g.gain.value = amp * 0.3;
    osc.connect(g).connect(out);
    osc.start(now);
    osc.stop(now + 1.8);
  }
}

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak a lesson line, interrupting any line still being spoken. Resolves when the line has been said. */
export function say(text: string, rate = 1): Promise<void> {
  if (!speechAvailable()) return Promise.resolve();
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  u.lang = "en-GB";
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  return new Promise((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export function hush(): void {
  if (speechAvailable()) window.speechSynthesis.cancel();
}

// Property tests for supports-and-turns: validity of generated and notated scores (P8.5) and the leg filter of
// Requirement 1.5 (P8.7).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canonicalScore, notate, perform, validateScore } from '../src/index';
import { footContacts } from '../src/contact';
import { runOptions } from './generators';
import { genStepTurnScore } from './supports-generators';

const RUNS = runOptions(200);

describe('P8.5: validity', () => {
  it('generated step-and-turn scores are valid and stay valid after canonicalScore', () => {
    fc.assert(
      fc.property(genStepTurnScore, (s) => {
        expect(validateScore(s)).toEqual({ ok: true });
        expect(validateScore(canonicalScore(s))).toEqual({ ok: true });
      }),
      RUNS,
    );
  });

  it('notate(perform(s)) is a valid score', () => {
    fc.assert(
      fc.property(genStepTurnScore, (s) => {
        const out = notate(perform(s), { tempo: s.tempo, beatsPerBar: s.beatsPerBar, grid: s.grid, title: 'round trip' });
        expect(validateScore(out)).toEqual({ ok: true });
      }),
      RUNS,
    );
  });
});

describe('P8.7: leg gestures only while their foot is off the floor (Requirement 1.5)', () => {
  it('every leg symbol of notate(perform(s)) arrives with its foot off the floor', () => {
    fc.assert(
      fc.property(genStepTurnScore, (s) => {
        const frames = perform(s);
        const out = notate(frames, { tempo: s.tempo, beatsPerBar: s.beatsPerBar, grid: s.grid, title: 'legs' });
        const contacts = footContacts(frames);
        const secondsPerBeat = 60 / s.tempo;
        for (const sym of out.symbols) {
          if (sym.kind === 'turn') continue;
          if (sym.column !== 'left-leg' && sym.column !== 'right-leg') continue;
          const onFloor = sym.column === 'left-leg' ? contacts.left : contacts.right;
          // Requirement 1.5 (revised): the foot is off the floor at the last frame of the window, where the leg arrives.
          const to = (sym.start + sym.duration) * secondsPerBeat;
          let arrival = -1;
          for (let k = 0; k < frames.length; k++) if (frames[k]!.t - frames[0]!.t < to) arrival = k;
          expect(arrival).toBeGreaterThanOrEqual(0);
          expect(onFloor[arrival]).toBe(false);
        }
      }),
      RUNS,
    );
  });
});

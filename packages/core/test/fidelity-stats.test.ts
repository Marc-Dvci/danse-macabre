import { describe, expect, it } from 'vitest';
import { mean, median, percentile } from '../src/fidelity-stats';

describe('fidelity statistics', () => {
  it('mean and median of a short list', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('percentile interpolates between order statistics', () => {
    expect(percentile([0, 10], 0.9)).toBeCloseTo(9, 12);
    expect(percentile([5], 0.9)).toBe(5);
    expect(percentile([4, 1, 3, 2], 0)).toBe(1);
    expect(percentile([4, 1, 3, 2], 1)).toBe(4);
  });

  it('returns NaN for an empty list', () => {
    expect(mean([])).toBeNaN();
    expect(median([])).toBeNaN();
    expect(percentile([], 0.9)).toBeNaN();
  });

  it('does not change its input', () => {
    const xs = [3, 1, 2];
    median(xs);
    percentile(xs, 0.9);
    expect(xs).toEqual([3, 1, 2]);
  });
});

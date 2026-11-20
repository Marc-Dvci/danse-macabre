/** Arithmetic mean. Returns NaN for an empty list. The list is not modified. */
export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  let total = 0;
  for (const v of values) total += v;
  return total / values.length;
}

/** Median. Returns NaN for an empty list. The list is not modified. */
export function median(values: number[]): number {
  return percentile(values, 0.5);
}

/**
 * Percentile by linear interpolation between order statistics (the R type 7 rule). `p` is in [0, 1].
 * Returns NaN for an empty list. The list is not modified.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = Math.min(1, Math.max(0, p)) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

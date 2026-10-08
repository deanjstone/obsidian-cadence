export type PctBand = 'rose' | 'warn' | 'mint' | 'emerald';

/* Map a 0-100 % to a colour band — drives progress bar tint. */
export function pctBand(pct: number): PctBand {
  if (pct < 25) return 'rose';
  if (pct < 50) return 'warn';
  if (pct < 75) return 'mint';
  return 'emerald';
}

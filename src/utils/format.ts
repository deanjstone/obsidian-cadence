export type PctBand = 'rose' | 'warn' | 'mint' | 'emerald';

/* Map a 0-100 % to a colour band — drives progress bar tint. */
export function pctBand(pct: number): PctBand {
  if (pct < 25) return 'rose';
  if (pct < 50) return 'warn';
  if (pct < 75) return 'mint';
  return 'emerald';
}

/* Module-level — kept in sync by the plugin so the standalone fmtValue helper
   can format currency without each caller threading settings through. */
let CURRENT_CURRENCY = 'USD';

export function setCurrentCurrency(code: string): void {
  CURRENT_CURRENCY = code;
}

export function fmtValue(val: unknown, type?: string): string {
  if (val == null || val === '') return '';
  if (type === 'tags' && Array.isArray(val)) return val.map((t) => `#${t}`).join(' ');
  if (type === 'date') {
    const d = new Date(val as string);
    if (!isNaN(d.getTime())) return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    return String(val);
  }
  if (type === 'currency') {
    const n = Number(val);
    if (!isNaN(n)) {
      try {
        return n.toLocaleString(undefined, { style: 'currency', currency: CURRENT_CURRENCY, maximumFractionDigits: 0 });
      } catch (_) {
        return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
      }
    }
    return String(val);
  }
  if (type === 'number') return String(val);
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}

export type PctBand = 'rose' | 'warn' | 'mint' | 'emerald';

/* Map a 0-100 % to a colour band — drives progress bar tint. */
export function pctBand(pct: number): PctBand {
  if (pct < 25) return 'rose';
  if (pct < 50) return 'warn';
  if (pct < 75) return 'mint';
  return 'emerald';
}

/* A plural label's likely singular, the guess a new custom page's singular
   prompt is pre-filled with: Categories → Category, Classes → Class,
   Products → Product. A word ending in ss, us or is is already singular
   (Status, Class, Bus, Analysis). An all-caps label drops one trailing S
   (KPIS → KPI) unless it ends in SS. */
export function guessSingular(plural: string): string {
  if (plural.length <= 1) return plural;
  if (plural === plural.toUpperCase()) return /[^S]S$/.test(plural) ? plural.slice(0, -1) : plural;
  if (/[^aeiou]ies$/i.test(plural)) return plural.slice(0, -3) + 'y';
  if (/(ss|x|z|ch|sh)es$/i.test(plural)) return plural.slice(0, -2);
  if (/(ss|us|is)$/i.test(plural)) return plural;
  if (/s$/i.test(plural)) return plural.slice(0, -1);
  return plural;
}

/* A singular label's plural: Company → Companies, Status → Statuses,
   Role → Roles. */
export function pluralize(singular: string): string {
  if (/[^aeiou]y$/i.test(singular)) return singular.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/i.test(singular)) return singular + 'es';
  return singular + 's';
}

/* `1 deal`, `0 deals`, `3 activities`: the singular for exactly one. */
export function countLabel(count: number, singular: string, plural: string = pluralize(singular)): string {
  return `${count} ${count === 1 ? singular : plural}`;
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

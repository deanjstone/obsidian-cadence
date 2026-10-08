import type { EntityDef } from '../types/entities';

/* State logic of CadenceImportModal, lifted out of the modal so it can be
   tested without a DOM. The modal (still in src/legacy/cadence.js) calls
   these from _autoDetectMapping and _submitImport. */

/** CSV header → entity field key, or null when the column is skipped. */
export type CsvMapping = Record<string, string | null>;

export function autoDetectCsvMapping(def: EntityDef | undefined, headers: string[]): CsvMapping {
  const mapping: CsvMapping = {};
  if (!def || !headers.length) return mapping;

  const norm = (s: unknown) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const keyByNorm: Record<string, string> = {};
  def.fields.forEach((f) => {
    keyByNorm[norm(f.key)] = f.key;
    keyByNorm[norm(f.label)] = f.key;
  });
  // Common synonyms
  const synonyms: Record<string, string> = {
    'fullname': 'name', 'displayname': 'name', 'contact': 'name',
    'companyname': 'company', 'organisation': 'company', 'organization': 'company',
    'phone': 'name', // not great — leave unmapped
    'mail': 'email', 'emailaddress': 'email',
    'amount': 'value', 'price': 'value', 'mrr': 'value', 'arr': 'value',
    'closedate': 'closeBy', 'expectedclose': 'closeBy',
    'lastcontacted': 'lastContact', 'lastcontact': 'lastContact',
  };

  headers.forEach((h) => {
    const n = norm(h);
    if (!n) { mapping[h] = null; return; }
    if (keyByNorm[n]) { mapping[h] = keyByNorm[n]; return; }
    // Synonyms — only take if the target key is a real field
    if (synonyms[n] && def.fields.some((f) => f.key === synonyms[n])) {
      mapping[h] = synonyms[n]; return;
    }
    // Fuzzy contains
    const fuzzy = def.fields.find((f) => n.includes(norm(f.key)) || norm(f.key).includes(n));
    mapping[h] = fuzzy ? fuzzy.key : null;
  });
  return mapping;
}

/* Frontmatter values for one CSV row, excluding the primary field (which
   names the note). Numbers/currency are parsed, tags split on , or ;,
   dates normalised to YYYY-MM-DD when parseable; empty cells are skipped. */
export function csvRowExtras(
  def: EntityDef,
  mapping: CsvMapping,
  headers: string[],
  row: string[],
  primaryKey: string,
): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  Object.entries(mapping).forEach(([header, key]) => {
    if (!key || key === primaryKey) return;
    const idx = headers.indexOf(header);
    let val: unknown = String(row[idx] || '').trim();
    if (!val) return;
    const fdef = def.fields.find((f) => f.key === key);
    if (fdef) {
      if (fdef.type === 'number' || fdef.type === 'currency') {
        const cleaned = (val as string).replace(/[^\d.\-]/g, '');
        const n = Number(cleaned);
        if (isNaN(n)) return;
        val = n;
      } else if (fdef.type === 'tags') {
        val = (val as string).split(/[,;]/).map((s) => s.trim()).filter(Boolean);
        if (!(val as string[]).length) return;
      } else if (fdef.type === 'date') {
        // Try to normalise to YYYY-MM-DD
        const d = new Date(val as string);
        if (!isNaN(d.getTime())) val = d.toISOString().slice(0, 10);
      }
    }
    extras[key] = val;
  });
  return extras;
}

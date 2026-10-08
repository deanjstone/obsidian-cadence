/* ─────────── CSV parser (handles quoted fields, escaped quotes, newlines) ─────────── */
export function parseCSV(text: string | null | undefined): string[][] {
  if (!text) return [];
  // Strip BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuote = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuote = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuote = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') {
      row.push(field); rows.push(row); row = []; field = '';
      i += (text[i + 1] === '\n') ? 2 : 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
      i++; continue;
    }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  // Drop trailing empty row(s)
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

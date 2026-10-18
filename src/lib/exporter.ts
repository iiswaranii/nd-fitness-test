/** Saves a generated file: through the viewer's download prompt when running inside a claude.ai link, otherwise a normal browser download. */
export async function saveFile(filename: string, data: string | Blob, mime: string): Promise<void> {
  const host = (window as unknown as { claude?: { use: (n: string) => Promise<{ save: (r: { filename: string; data: string | Blob }) => Promise<unknown> } | null> } }).claude;
  if (host?.use) {
    const dl = await host.use('downloads').catch(() => null);
    if (dl) { await dl.save({ filename, data }); return; }
  }
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function toCsv(rows: (string | number | null)[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

export async function saveCsv(filename: string, rows: (string | number | null)[][]) {
  await saveFile(filename, toCsv(rows), 'text/csv;charset=utf-8');
}

/** One workbook, several sheets. SheetJS loads only when someone exports. */
export async function saveXlsx(filename: string, sheets: { name: string; rows: (string | number | null)[][] }[]) {
  const X = await import('xlsx');
  const wb = X.utils.book_new();
  for (const s of sheets) {
    const ws = X.utils.aoa_to_sheet(s.rows);
    ws['!cols'] = (s.rows[0] ?? []).map((_, i) => ({ wch: Math.min(40, Math.max(...s.rows.slice(0, 300).map((r) => String(r[i] ?? '').length)) + 2) }));
    X.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const buf = X.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  await saveFile(filename, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

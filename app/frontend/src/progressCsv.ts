export interface ProgressCsvSession {
  date: string;
  status: 'planned' | 'completed' | 'skipped';
  score?: number;
  notes?: string;
}

function escapeCell(value: string | number | undefined): string {
  let text = value == null ? '' : String(value);

  // Prevent user-authored notes from being interpreted as spreadsheet formulas.
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export function buildProgressCsv(
  sessions: ProgressCsvSession[],
  dogName: string,
  trainingName: string,
): string {
  const rows: (string | number | undefined)[][] = [
    ['Date', 'Dog', 'Training', 'Status', 'Score', 'Notes'],
    ...sessions.map((session) => [
      session.date,
      dogName,
      trainingName,
      session.status,
      session.score,
      session.notes,
    ]),
  ];

  // The BOM helps spreadsheet software recognize UTF-8 while remaining valid CSV.
  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')}`;
}

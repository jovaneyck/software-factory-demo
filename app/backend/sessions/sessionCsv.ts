export interface SessionCsvRow {
  date: string;
  training: string;
  status: string;
  score?: number;
  notes?: string;
}

export interface SessionCsvOptions {
  dogName: string;
  from: string;
  to: string;
  rows: SessionCsvRow[];
}

/**
 * Quote a CSV field only when it contains a comma, a double quote, or a line
 * break, escaping embedded double quotes by doubling them (RFC 4180).
 */
export function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Build the CSV body for a dog's session results. The file carries the dog
 * name and the exported date range as a metadata preamble, followed by the
 * session table.
 */
export function buildSessionCsv({ dogName, from, to, rows }: SessionCsvOptions): string {
  const lines: string[] = [
    `Dog,${escapeCsv(dogName)}`,
    `From,${escapeCsv(from)}`,
    `To,${escapeCsv(to)}`,
    '',
    ['Date', 'Training', 'Status', 'Score', 'Notes'].join(','),
    ...rows.map((row) =>
      [
        row.date,
        row.training,
        row.status,
        row.score != null ? String(row.score) : '',
        row.notes ?? '',
      ]
        .map(escapeCsv)
        .join(','),
    ),
  ];

  return `${lines.join('\r\n')}\r\n`;
}

/** Slugify a dog name for use in the download filename. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
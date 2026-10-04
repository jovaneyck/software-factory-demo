import type { Session } from '../shared/types.js';

const CSV_HEADER = ['Date', 'Training', 'Status', 'Score', 'Notes'];

/**
 * RFC 4180 field escaping: wrap in double quotes when the value contains a
 * comma, a double quote, or a line break; double any embedded quotes.
 */
const escapeField = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/**
 * Build a CSV document for a dog's logged sessions. The result is prefixed
 * with a UTF-8 BOM and uses CRLF line endings so it opens cleanly in Excel.
 * Rows are sorted by date ascending.
 */
export function sessionsToCsv(sessions: Session[], trainingNames: Map<string, string>): string {
  const rows = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((session) => [
      session.date,
      trainingNames.get(session.trainingId) ?? session.trainingId,
      session.status,
      session.score != null ? String(session.score) : '',
      session.notes ?? '',
    ]);

  const lines = [CSV_HEADER, ...rows].map((row) => row.map(escapeField).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** Slugify a dog's name into a safe, descriptive download filename. */
export function sessionsFilename(dogName: string): string {
  const slug = dogName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'dog'}-sessions.csv`;
}

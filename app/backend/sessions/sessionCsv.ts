import type { Session, Training } from '../shared/types.js';

const CSV_HEADER = ['date', 'training', 'status', 'score', 'notes'];

/**
 * Escape a single CSV field per RFC 4180: wrap in double quotes if it contains
 * a comma, double quote, or newline, and double any embedded quotes.
 */
export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Build a CSV document (with header row) from the given sessions. Sessions are
 * sorted by date ascending. Training ids are resolved to their names via the
 * provided lookup; unknown trainings fall back to the raw id.
 */
export function sessionsToCsv(sessions: Session[], trainings: Training[]): string {
  const nameById = new Map(trainings.map((t) => [t.id, t.name]));

  const rows = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => {
      const fields = [
        s.date,
        nameById.get(s.trainingId) ?? s.trainingId,
        s.status,
        s.score !== undefined ? String(s.score) : '',
        s.notes ?? '',
      ];
      return fields.map(escapeCsvField).join(',');
    });

  return [CSV_HEADER.join(','), ...rows].join('\r\n');
}

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'dog';

/**
 * Build a filename of the form `{dog-name}-progress-{date-range}.csv`. The date
 * range is derived from the earliest and latest session dates. When there are no
 * sessions the range portion is omitted.
 */
export function csvFilename(dogName: string, sessions: Session[]): string {
  const slug = slugify(dogName);
  if (sessions.length === 0) {
    return `${slug}-progress.csv`;
  }
  const dates = sessions.map((s) => s.date).sort((a, b) => a.localeCompare(b));
  const from = dates[0];
  const to = dates[dates.length - 1];
  const range = from === to ? from : `${from}-to-${to}`;
  return `${slug}-progress-${range}.csv`;
}

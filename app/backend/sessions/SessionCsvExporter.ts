import type { DogRepository } from '../dogs/DogRepository.js';
import type { TrainingRepository } from '../trainings/TrainingRepository.js';
import type { SessionRepository } from './SessionRepository.js';

export type CsvExportResult = { filename: string; csv: string } | { error: string };

const COLUMNS = ['Date', 'Training', 'Status', 'Score', 'Notes'];

// Characters that make a spreadsheet interpret a cell as a formula.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * RFC 4180 field escaping: wrap in double quotes when the value contains a
 * comma, quote, CR or LF, and double any embedded quotes. Cells that begin
 * with a formula trigger are prefixed with a single quote to prevent CSV
 * formula injection (CWE-1236) when opened in Excel/LibreOffice/Sheets.
 */
function escapeCsvValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  let str = String(value);
  if (str.length > 0 && FORMULA_TRIGGERS.includes(str[0])) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'dog';
}

export class SessionCsvExporter {
  constructor(
    private readonly dogs: DogRepository,
    private readonly trainings: TrainingRepository,
    private readonly sessions: SessionRepository,
  ) {}

  export(dogId: string, from: Date, to: Date): CsvExportResult {
    const dog = this.dogs.getById(dogId);
    if (!dog) return { error: 'Dog not found' };

    const trainingNames = new Map(this.trainings.getAll().map((t) => [t.id, t.name]));

    const records = this.sessions
      .getByDogIdInRange(dogId, from, to)
      // Only recorded history is exported; computed "planned" sessions are never persisted.
      .filter((s) => s.status === 'completed' || s.status === 'skipped')
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        const aName = trainingNames.get(a.trainingId) ?? a.trainingId;
        const bName = trainingNames.get(b.trainingId) ?? b.trainingId;
        return aName.localeCompare(bName);
      });

    const lines = [COLUMNS.join(',')];
    for (const session of records) {
      lines.push(
        [
          escapeCsvValue(session.date),
          escapeCsvValue(trainingNames.get(session.trainingId) ?? session.trainingId),
          escapeCsvValue(session.status),
          escapeCsvValue(session.score),
          escapeCsvValue(session.notes),
        ].join(','),
      );
    }

    // Leading BOM so Excel opens the file as UTF-8; CRLF per RFC 4180.
    const csv = `\uFEFF${lines.join('\r\n')}\r\n`;
    return { filename: `${slugify(dog.name)}-sessions.csv`, csv };
  }
}

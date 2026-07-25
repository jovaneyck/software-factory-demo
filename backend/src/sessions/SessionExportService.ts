import type { DogRepository } from '../dogs/DogRepository.js';
import type { TrainingRepository } from '../trainings/TrainingRepository.js';
import type { SessionRepository } from './SessionRepository.js';
import type { Session } from '../shared/types.js';
import { toCsv, type ExportRow } from './sessionCsv.js';

export type ExportResult = { csv: string; filename: string } | { error: string };

const PERSISTED_STATUSES = ['completed', 'skipped'];

const slugify = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'dog';

export class SessionExportService {
  constructor(
    private readonly dogs: DogRepository,
    private readonly trainings: TrainingRepository,
    private readonly sessions: SessionRepository,
  ) { }

  export(dogId: string, from?: string, to?: string): ExportResult {
    const dog = this.dogs.getById(dogId);
    if (!dog) return { error: 'Dog not found' };

    const inRange = (session: Session) =>
      (from === undefined || session.date >= from) && (to === undefined || session.date <= to);

    const rows: ExportRow[] = this.sessions.getByDogId(dogId)
      .filter(session => PERSISTED_STATUSES.includes(session.status))
      .filter(inRange)
      .map(session => ({
        date: session.date,
        dog: dog.name,
        training: this.trainings.getById(session.trainingId)?.name ?? session.trainingId,
        status: session.status,
        score: session.score,
        notes: session.notes
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.training.localeCompare(b.training));

    const fromPart = from ?? rows[0]?.date ?? 'all';
    const toPart = to ?? rows[rows.length - 1]?.date ?? 'all';

    return {
      csv: toCsv(rows),
      filename: `${slugify(dog.name)}-session-history-${fromPart}-${toPart}.csv`
    };
  }
}

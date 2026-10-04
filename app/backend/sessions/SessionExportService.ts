import type { DogRepository } from '../dogs/DogRepository.js';
import type { TrainingRepository } from '../trainings/TrainingRepository.js';
import type { Session, ListedSession } from '../shared/types.js';
import type { SessionListingService } from './SessionListingService.js';
import { sessionsFilename, sessionsToCsv } from './sessionCsv.js';

export type SessionExportResult = { filename: string; csv: string } | { error: string };

// All-time window for exports, matching the Progress report's range.
const EXPORT_FROM = new Date('2000-01-01T00:00:00');
const EXPORT_TO = new Date('2099-12-31T00:00:00');

const isLoggedSession = (session: ListedSession): session is Session =>
  session.status === 'completed' || session.status === 'skipped';

/**
 * Builds a CSV export of a single dog's logged (completed/skipped) sessions.
 * Owns the selection rules — the all-time window and the exclusion of
 * schedule-derived `planned` sessions — so route adapters stay thin.
 */
export class SessionExportService {
  constructor(
    private readonly dogs: DogRepository,
    private readonly listing: SessionListingService,
    private readonly trainings: TrainingRepository,
  ) {}

  export(dogId: string): SessionExportResult {
    const dog = this.dogs.getById(dogId);
    if (!dog) return { error: 'Dog not found' };

    const result = this.listing.list(dogId, EXPORT_FROM, EXPORT_TO);
    if ('error' in result) return { error: result.error };

    const logged = result.sessions.filter(isLoggedSession);
    const trainingNames = new Map(this.trainings.getAll().map((t) => [t.id, t.name]));

    return {
      filename: sessionsFilename(dog.name),
      csv: sessionsToCsv(logged, trainingNames),
    };
  }
}

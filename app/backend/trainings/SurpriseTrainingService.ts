import type { Training } from '../shared/types.js';
import type { TrainingRepository } from './TrainingRepository.js';
import type { SessionRepository } from '../sessions/SessionRepository.js';

/**
 * Picks the training that a dog has not performed for the longest time.
 *
 * Only `completed` sessions count as performed — a `skipped` session means the
 * training was scheduled but not actually done. Trainings with no completed
 * session are treated as the most overdue (infinitely long ago). Ties are
 * broken deterministically by name, then id.
 */
export class SurpriseTrainingService {
  constructor(
    private readonly trainings: TrainingRepository,
    private readonly sessions: SessionRepository,
  ) {}

  find(dogId: string): Training | null {
    const all = this.trainings.getAll();
    if (all.length === 0) return null;

    const lastPerformed = new Map<string, string>();
    for (const session of this.sessions.getByDogId(dogId)) {
      if (session.status !== 'completed') continue;
      const previous = lastPerformed.get(session.trainingId);
      if (!previous || session.date > previous) {
        lastPerformed.set(session.trainingId, session.date);
      }
    }

    const sorted = [...all].sort((a, b) => {
      // Missing date sorts first, i.e. never-performed wins.
      const aDate = lastPerformed.get(a.id) ?? '';
      const bDate = lastPerformed.get(b.id) ?? '';
      if (aDate !== bDate) return aDate < bDate ? -1 : 1;
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });

    return sorted[0];
  }
}

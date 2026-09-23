import { describe, it, expect, beforeEach } from 'vitest';
import { SurpriseTrainingService } from './SurpriseTrainingService.js';
import { FakeTrainingRepository } from './FakeTrainingRepository.js';
import { FakeSessionRepository } from '../sessions/FakeSessionRepository.js';
import type { Training } from '../shared/types.js';

const training = (id: string, name: string): Training => ({ id, name, procedure: '', tips: '' });

interface SessionSeed {
  trainingId: string;
  date: string;
  status?: 'completed' | 'skipped';
  dogId?: string;
}

describe('SurpriseTrainingService', () => {
  let trainings: FakeTrainingRepository;
  let sessions: FakeSessionRepository;
  let service: SurpriseTrainingService;
  const dogId = 'dog-1';

  beforeEach(() => {
    trainings = new FakeTrainingRepository();
    sessions = new FakeSessionRepository();
    service = new SurpriseTrainingService(trainings, sessions);
  });

  const seed = (
    trainingDefs: Array<[id: string, name: string]>,
    sessionDefs: SessionSeed[] = [],
  ) => {
    for (const [id, name] of trainingDefs) {
      trainings.save(training(id, name));
    }
    sessionDefs.forEach((seedSession, index) => {
      sessions.save({
        id: `s${index}`,
        dogId: seedSession.dogId ?? dogId,
        trainingId: seedSession.trainingId,
        date: seedSession.date,
        status: seedSession.status ?? 'completed',
      });
    });
  };

  it('returns null when there are no trainings', () => {
    expect(service.find(dogId)).toBeNull();
  });

  it('returns the only training when there are no sessions', () => {
    seed([['t1', 'Sit']]);
    expect(service.find(dogId)?.id).toBe('t1');
  });

  it('picks the training whose last completed session is oldest', () => {
    seed(
      [
        ['t1', 'Sit'],
        ['t2', 'Stay'],
        ['t3', 'Roll'],
      ],
      [
        { trainingId: 't1', date: '2026-05-01' },
        { trainingId: 't2', date: '2026-01-01' },
        { trainingId: 't3', date: '2026-03-01' },
      ],
    );

    expect(service.find(dogId)?.id).toBe('t2');
  });

  it('treats a never-performed training as the most overdue', () => {
    seed(
      [
        ['t1', 'Sit'],
        ['t2', 'Stay'],
      ],
      [{ trainingId: 't1', date: '2020-01-01' }],
    );

    expect(service.find(dogId)?.id).toBe('t2');
  });

  it('uses the most recent completed session per training', () => {
    seed(
      [
        ['t1', 'Sit'],
        ['t2', 'Stay'],
      ],
      [
        { trainingId: 't1', date: '2026-01-01' },
        { trainingId: 't1', date: '2026-06-01' },
        { trainingId: 't2', date: '2026-03-01' },
      ],
    );

    expect(service.find(dogId)?.id).toBe('t2');
  });

  it('ignores skipped sessions when computing the last performed date', () => {
    seed(
      [
        ['t1', 'Sit'],
        ['t2', 'Stay'],
      ],
      [
        { trainingId: 't1', date: '2026-01-01' },
        { trainingId: 't2', date: '2026-06-01', status: 'skipped' },
      ],
    );

    // t2 was only ever skipped, so it counts as never performed and wins.
    expect(service.find(dogId)?.id).toBe('t2');
  });

  it('ignores sessions belonging to other dogs', () => {
    seed(
      [
        ['t1', 'Sit'],
        ['t2', 'Stay'],
      ],
      [
        { trainingId: 't1', date: '2026-06-01' },
        { trainingId: 't2', date: '2020-01-01', dogId: 'other-dog' },
      ],
    );

    // t2 has no completed session for this dog, so it is the most overdue.
    expect(service.find(dogId)?.id).toBe('t2');
  });

  it('breaks ties deterministically by name', () => {
    seed([
      ['b-id', 'Zeta'],
      ['a-id', 'Alpha'],
    ]);

    expect(service.find(dogId)?.id).toBe('a-id');
  });
});

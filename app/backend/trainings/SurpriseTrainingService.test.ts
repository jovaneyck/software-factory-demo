import { describe, it, expect, beforeEach } from 'vitest';
import { SurpriseTrainingService } from './SurpriseTrainingService.js';
import { FakeTrainingRepository } from './FakeTrainingRepository.js';
import { FakeSessionRepository } from '../sessions/FakeSessionRepository.js';
import type { Training } from '../shared/types.js';

const training = (id: string, name: string): Training => ({ id, name, procedure: '', tips: '' });

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

  it('returns null when there are no trainings', () => {
    expect(service.find(dogId)).toBeNull();
  });

  it('returns the only training when there are no sessions', () => {
    trainings.save(training('t1', 'Sit'));
    expect(service.find(dogId)?.id).toBe('t1');
  });

  it('picks the training whose last completed session is oldest', () => {
    trainings.save(training('t1', 'Sit'));
    trainings.save(training('t2', 'Stay'));
    trainings.save(training('t3', 'Roll'));
    sessions.save({ id: 's1', dogId, trainingId: 't1', date: '2026-05-01', status: 'completed' });
    sessions.save({ id: 's2', dogId, trainingId: 't2', date: '2026-01-01', status: 'completed' });
    sessions.save({ id: 's3', dogId, trainingId: 't3', date: '2026-03-01', status: 'completed' });

    expect(service.find(dogId)?.id).toBe('t2');
  });

  it('treats a never-performed training as the most overdue', () => {
    trainings.save(training('t1', 'Sit'));
    trainings.save(training('t2', 'Stay'));
    sessions.save({ id: 's1', dogId, trainingId: 't1', date: '2020-01-01', status: 'completed' });

    expect(service.find(dogId)?.id).toBe('t2');
  });

  it('uses the most recent completed session per training', () => {
    trainings.save(training('t1', 'Sit'));
    trainings.save(training('t2', 'Stay'));
    sessions.save({ id: 's1', dogId, trainingId: 't1', date: '2026-01-01', status: 'completed' });
    sessions.save({ id: 's2', dogId, trainingId: 't1', date: '2026-06-01', status: 'completed' });
    sessions.save({ id: 's3', dogId, trainingId: 't2', date: '2026-03-01', status: 'completed' });

    expect(service.find(dogId)?.id).toBe('t2');
  });

  it('ignores skipped sessions when computing the last performed date', () => {
    trainings.save(training('t1', 'Sit'));
    trainings.save(training('t2', 'Stay'));
    sessions.save({ id: 's1', dogId, trainingId: 't1', date: '2026-01-01', status: 'completed' });
    sessions.save({ id: 's2', dogId, trainingId: 't2', date: '2026-06-01', status: 'skipped' });

    // t2 was only ever skipped, so it counts as never performed and wins.
    expect(service.find(dogId)?.id).toBe('t2');
  });

  it('ignores sessions belonging to other dogs', () => {
    trainings.save(training('t1', 'Sit'));
    trainings.save(training('t2', 'Stay'));
    sessions.save({ id: 's1', dogId, trainingId: 't1', date: '2026-06-01', status: 'completed' });
    sessions.save({
      id: 's2',
      dogId: 'other-dog',
      trainingId: 't2',
      date: '2020-01-01',
      status: 'completed',
    });

    // t2 has no completed session for this dog, so it is the most overdue.
    expect(service.find(dogId)?.id).toBe('t2');
  });

  it('breaks ties deterministically by name', () => {
    trainings.save(training('b-id', 'Zeta'));
    trainings.save(training('a-id', 'Alpha'));

    expect(service.find(dogId)?.id).toBe('a-id');
  });
});

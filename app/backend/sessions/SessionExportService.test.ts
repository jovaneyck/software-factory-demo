import { describe, it, expect, beforeEach } from 'vitest';
import { SessionExportService } from './SessionExportService.js';
import { SessionListingService } from './SessionListingService.js';
import { FakeDogRepository } from '../dogs/FakeDogRepository.js';
import { FakePlanRepository } from '../plans/FakePlanRepository.js';
import { FakeSessionRepository } from './FakeSessionRepository.js';
import { FakeTrainingRepository } from '../trainings/FakeTrainingRepository.js';

describe('SessionExportService', () => {
  let dogs: FakeDogRepository;
  let sessions: FakeSessionRepository;
  let trainings: FakeTrainingRepository;
  let service: SessionExportService;

  const dogId = 'dog-00000000-0000-0000-0000-000000000001';
  const trainingId = 'trn-00000000-0000-0000-0000-000000000001';
  const planId = 'pln-00000000-0000-0000-0000-000000000001';
  const plan = {
    id: planId,
    name: 'Puppy Basics',
    schedule: {
      monday: [trainingId],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    },
  };

  beforeEach(() => {
    dogs = new FakeDogRepository();
    sessions = new FakeSessionRepository();
    trainings = new FakeTrainingRepository();
    const plans = new FakePlanRepository();
    plans.save(plan);
    const listing = new SessionListingService(dogs, plans, sessions);
    service = new SessionExportService(dogs, listing, trainings);
  });

  it('returns an error when the dog does not exist', () => {
    expect(service.export('missing-dog')).toEqual({ error: 'Dog not found' });
  });

  it('names the file after the dog and includes only logged sessions', () => {
    dogs.save({ id: dogId, name: 'Buddy', picture: 'buddy.jpg', planId });
    trainings.save({ id: trainingId, name: 'Sit', procedure: '', tips: '' });
    sessions.save({
      id: 'ses-1',
      dogId,
      trainingId,
      planId,
      date: '2026-02-09',
      status: 'completed',
      score: 8,
    });

    const result = service.export(dogId);

    expect('csv' in result).toBe(true);
    if (!('csv' in result)) return;
    expect(result.filename).toBe('buddy-sessions.csv');
    expect(result.csv).toContain('2026-02-09,Sit,completed,8,');
    expect(result.csv).not.toContain('planned');
  });
});

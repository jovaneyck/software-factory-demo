import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import crypto from 'crypto';
import request from 'supertest';
import { surpriseTrainingRoutes } from './surpriseTrainingRoutes.js';
import { SurpriseTrainingService } from './SurpriseTrainingService.js';
import { FakeDogRepository } from '../dogs/FakeDogRepository.js';
import { FakeTrainingRepository } from './FakeTrainingRepository.js';
import { FakeSessionRepository } from '../sessions/FakeSessionRepository.js';

describe('Surprise training API', () => {
  let app: Express;
  let dogs: FakeDogRepository;
  let trainings: FakeTrainingRepository;
  let sessions: FakeSessionRepository;
  const dogId = crypto.randomUUID();

  beforeEach(() => {
    dogs = new FakeDogRepository();
    trainings = new FakeTrainingRepository();
    sessions = new FakeSessionRepository();
    const service = new SurpriseTrainingService(trainings, sessions);
    app = express();
    app.use(express.json());
    app.use('/api', surpriseTrainingRoutes(dogs, service));

    dogs.save({ id: dogId, name: 'Buddy', picture: 'buddy.jpg' });
  });

  it('returns the most overdue training for the dog', async () => {
    const trainingA = crypto.randomUUID();
    const trainingB = crypto.randomUUID();
    trainings.save({ id: trainingA, name: 'Sit', procedure: '', tips: '' });
    trainings.save({ id: trainingB, name: 'Stay', procedure: '', tips: '' });
    sessions.save({
      id: crypto.randomUUID(),
      dogId,
      trainingId: trainingA,
      date: '2026-05-01',
      status: 'completed',
    });
    sessions.save({
      id: crypto.randomUUID(),
      dogId,
      trainingId: trainingB,
      date: '2026-01-01',
      status: 'completed',
    });

    const res = await request(app).get(`/api/dogs/${dogId}/trainings/surprise`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(trainingB);
    expect(res.body.name).toBe('Stay');
  });

  it('returns 404 when the dog does not exist', async () => {
    const fakeDogId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/dogs/${fakeDogId}/trainings/surprise`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Dog not found');
  });

  it('returns 404 when there are no trainings', async () => {
    const res = await request(app).get(`/api/dogs/${dogId}/trainings/surprise`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('No trainings available');
  });

  it('returns 400 when dogId is not a valid UUID', async () => {
    const res = await request(app).get('/api/dogs/not-a-uuid/trainings/surprise');
    expect(res.status).toBe(400);
  });
});

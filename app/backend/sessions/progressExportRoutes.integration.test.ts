import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import crypto from 'crypto';
import request from 'supertest';
import { FakeDogRepository } from '../dogs/FakeDogRepository.js';
import { FakeTrainingRepository } from '../trainings/FakeTrainingRepository.js';
import { FakeSessionRepository } from './FakeSessionRepository.js';
import { TrainingProgressExportService } from './TrainingProgressExportService.js';
import { progressExportRoutes } from './progressExportRoutes.js';

const dogId = crypto.randomUUID();
const sitTrainingId = crypto.randomUUID();
const stayTrainingId = crypto.randomUUID();

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    dogId,
    trainingId: sitTrainingId,
    date: '1999-01-01',
    status: 'completed',
    ...overrides,
  };
}

describe('Training progress CSV export endpoint', () => {
  let app: Express;
  let dogs: FakeDogRepository;
  let trainings: FakeTrainingRepository;
  let sessions: FakeSessionRepository;

  beforeEach(() => {
    dogs = new FakeDogRepository();
    trainings = new FakeTrainingRepository();
    sessions = new FakeSessionRepository();
    dogs.save({ id: dogId, name: 'Buddy', picture: 'buddy.jpg' });
    trainings.save({ id: sitTrainingId, name: 'Sit', procedure: '', tips: '' });
    trainings.save({ id: stayTrainingId, name: 'Stay', procedure: '', tips: '' });
    app = express();
    app.use(
      '/api',
      progressExportRoutes(new TrainingProgressExportService(dogs, trainings, sessions)),
    );
  });

  it('exports all completed and skipped sessions for the selected dog as an attachment', async () => {
    sessions.save(session({ date: '2100-03-10', status: 'completed', score: 8 }));
    sessions.save(
      session({
        trainingId: stayTrainingId,
        date: '2026-01-02',
        status: 'skipped',
        notes: 'Could not, due to "weather"',
      }),
    );
    sessions.save(session({ date: '2026-01-03', status: 'planned' }));

    const otherDogId = crypto.randomUUID();
    dogs.save({ id: otherDogId, name: 'Rex', picture: 'rex.jpg' });
    sessions.save(session({ dogId: otherDogId, date: '2026-01-04', score: 4 }));

    const response = await request(app).get(`/api/dogs/${dogId}/progress.csv`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="buddy-training-progress.csv"',
    );
    expect(response.text).toBe(
      [
        '"Date","Dog","Training","Status","Score","Notes"',
        '"2026-01-02","Buddy","Stay","skipped","","Could not, due to ""weather"""',
        '"2100-03-10","Buddy","Sit","completed","8",""',
        '',
      ].join('\r\n'),
    );
  });

  it('escapes spreadsheet formulas in user-provided fields', async () => {
    sessions.save(session({ notes: '=HYPERLINK("https://example.com")' }));

    const response = await request(app).get(`/api/dogs/${dogId}/progress.csv`);

    expect(response.status).toBe(200);
    expect(response.text).toContain(`'=HYPERLINK(""https://example.com"")`);
  });

  it('returns an empty CSV with headers when the dog has no completed or skipped sessions', async () => {
    sessions.save(session({ status: 'planned' }));

    const response = await request(app).get(`/api/dogs/${dogId}/progress.csv`);

    expect(response.status).toBe(200);
    expect(response.text).toBe('"Date","Dog","Training","Status","Score","Notes"\r\n');
  });

  it('returns 404 when the dog does not exist', async () => {
    const response = await request(app).get(`/api/dogs/${crypto.randomUUID()}/progress.csv`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Dog not found' });
  });

  it('returns 400 when the dog id is not a UUID', async () => {
    const response = await request(app).get('/api/dogs/not-a-uuid/progress.csv');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid ID format' });
  });
});

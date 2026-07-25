import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import crypto from 'crypto';
import request from 'supertest';
import { sessionRoutes } from './sessionRoutes.js';
import { FakeDogRepository } from '../dogs/FakeDogRepository.js';
import { FakeSessionRepository } from './FakeSessionRepository.js';
import { FakePlanRepository } from '../plans/FakePlanRepository.js';
import { FakeTrainingRepository } from '../trainings/FakeTrainingRepository.js';
import { SessionListingService } from './SessionListingService.js';
import { SessionExportService } from './SessionExportService.js';

describe('Sessions API', () => {
  let app: Express;
  let dogs: FakeDogRepository;
  let sessions: FakeSessionRepository;
  let plans: FakePlanRepository;
  let trainings: FakeTrainingRepository;
  const dogId = crypto.randomUUID();
  const trainingId = crypto.randomUUID();

  beforeEach(() => {
    dogs = new FakeDogRepository();
    sessions = new FakeSessionRepository();
    plans = new FakePlanRepository();
    trainings = new FakeTrainingRepository();
    const service = new SessionListingService(dogs, plans, sessions);
    const exportService = new SessionExportService(dogs, trainings, sessions);
    app = express();
    app.use(express.json());
    app.use('/api', sessionRoutes(dogs, sessions, service, exportService));

    dogs.save({ id: dogId, name: 'Buddy', picture: 'buddy.jpg' });
  });

  describe('POST /api/dogs/:dogId/sessions', () => {
    it('creates a session for a dog', async () => {
      const res = await request(app)
        .post(`/api/dogs/${dogId}/sessions`)
        .send({ trainingId, date: '2026-02-14', status: 'completed', score: 8 });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.dogId).toBe(dogId);
      expect(res.body.trainingId).toBe(trainingId);
      expect(res.body.date).toBe('2026-02-14');
      expect(res.body.status).toBe('completed');
      expect(res.body.score).toBe(8);
    });

    it('creates a session with optional planId and notes', async () => {
      const planId = crypto.randomUUID();
      const res = await request(app)
        .post(`/api/dogs/${dogId}/sessions`)
        .send({ trainingId, planId, date: '2026-02-14', status: 'completed', score: 7, notes: 'Good boy' });

      expect(res.status).toBe(201);
      expect(res.body.planId).toBe(planId);
      expect(res.body.notes).toBe('Good boy');
    });

    it('creates a skipped session without score', async () => {
      const res = await request(app)
        .post(`/api/dogs/${dogId}/sessions`)
        .send({ trainingId, date: '2026-02-14', status: 'skipped' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('skipped');
      expect(res.body.score).toBeUndefined();
    });

    it('returns 404 for non-existent dog', async () => {
      const fakeDogId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post(`/api/dogs/${fakeDogId}/sessions`)
        .send({ trainingId, date: '2026-02-14', status: 'completed' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when dogId is not a valid UUID', async () => {
      const res = await request(app)
        .post('/api/dogs/not-a-uuid/sessions')
        .send({ trainingId, date: '2026-02-14', status: 'completed' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post(`/api/dogs/${dogId}/sessions`)
        .send({ trainingId });

      expect(res.status).toBe(400);
    });

    it('returns 400 when status is invalid', async () => {
      const res = await request(app)
        .post(`/api/dogs/${dogId}/sessions`)
        .send({ trainingId, date: '2026-02-14', status: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when score is provided for skipped session', async () => {
      const res = await request(app)
        .post(`/api/dogs/${dogId}/sessions`)
        .send({ trainingId, date: '2026-02-14', status: 'skipped', score: 5 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when score is out of range', async () => {
      const res = await request(app)
        .post(`/api/dogs/${dogId}/sessions`)
        .send({ trainingId, date: '2026-02-14', status: 'completed', score: 11 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when score is 0', async () => {
      const res = await request(app)
        .post(`/api/dogs/${dogId}/sessions`)
        .send({ trainingId, date: '2026-02-14', status: 'completed', score: 0 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/dogs/:dogId/sessions/:id', () => {
    it('returns a session by id', async () => {
      const sessionId = crypto.randomUUID();
      sessions.save({ id: sessionId, dogId, trainingId, date: '2026-02-14', status: 'completed', score: 9 });

      const res = await request(app).get(`/api/dogs/${dogId}/sessions/${sessionId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(sessionId);
      expect(res.body.dogId).toBe(dogId);
    });

    it('returns 404 for non-existent session', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app).get(`/api/dogs/${dogId}/sessions/${fakeId}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 when session belongs to a different dog', async () => {
      const sessionId = crypto.randomUUID();
      sessions.save({ id: sessionId, dogId, trainingId, date: '2026-02-14', status: 'completed' });

      const dog2Id = crypto.randomUUID();
      dogs.save({ id: dog2Id, name: 'Rex', picture: 'rex.jpg' });

      const res = await request(app).get(`/api/dogs/${dog2Id}/sessions/${sessionId}`);
      expect(res.status).toBe(404);
    });

    it('returns 400 when session id is not a valid UUID', async () => {
      const res = await request(app).get(`/api/dogs/${dogId}/sessions/not-a-uuid`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/dogs/:dogId/sessions/export', () => {
    const BOM = '﻿';
    const HEADER = 'date,dog,training,status,score,notes';
    const bodyLines = (text: string) => text.slice(BOM.length).split('\r\n');

    beforeEach(() => {
      trainings.save({ id: trainingId, name: 'Sit', procedure: '', tips: '' });
    });

    it('exports completed and skipped sessions as CSV, date ascending', async () => {
      const heelId = crypto.randomUUID();
      trainings.save({ id: heelId, name: 'Heel', procedure: '', tips: '' });
      sessions.save({ id: crypto.randomUUID(), dogId, trainingId: heelId, date: '2026-02-15', status: 'skipped' });
      sessions.save({ id: crypto.randomUUID(), dogId, trainingId, date: '2026-02-14', status: 'completed', score: 8, notes: 'Good boy' });

      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export`);

      expect(res.status).toBe(200);
      expect(bodyLines(res.text)).toEqual([
        HEADER,
        '2026-02-14,Buddy,Sit,completed,8,Good boy',
        '2026-02-15,Buddy,Heel,skipped,,'
      ]);
    });

    it('responds with CSV content type and an attachment filename', async () => {
      sessions.save({ id: crypto.randomUUID(), dogId, trainingId, date: '2026-02-14', status: 'completed' });

      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export`);

      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition'])
        .toBe('attachment; filename="buddy-session-history-2026-02-14-2026-02-14.csv"');
    });

    it('names the file after the requested range', async () => {
      const res = await request(app)
        .get(`/api/dogs/${dogId}/sessions/export`)
        .query({ from: '2026-01-01', to: '2026-12-31' });

      expect(res.headers['content-disposition'])
        .toBe('attachment; filename="buddy-session-history-2026-01-01-2026-12-31.csv"');
    });

    it('returns 200 with a header row only when the dog has no sessions', async () => {
      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export`);

      expect(res.status).toBe(200);
      expect(bodyLines(res.text)).toEqual([HEADER]);
    });

    it('returns 200 with a header row only when only planned sessions exist', async () => {
      const planId = crypto.randomUUID();
      plans.save({ id: planId, name: 'Weekly', schedule: { monday: [trainingId] } });
      dogs.save({ id: dogId, name: 'Buddy', picture: 'buddy.jpg', planId });

      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export`);

      expect(bodyLines(res.text)).toEqual([HEADER]);
    });

    it('returns 200 with a header row only when the range matches nothing', async () => {
      sessions.save({ id: crypto.randomUUID(), dogId, trainingId, date: '2026-02-14', status: 'completed' });

      const res = await request(app)
        .get(`/api/dogs/${dogId}/sessions/export`)
        .query({ from: '2027-01-01', to: '2027-12-31' });

      expect(bodyLines(res.text)).toEqual([HEADER]);
    });

    it('returns 200 with a header row only when from is after to', async () => {
      sessions.save({ id: crypto.randomUUID(), dogId, trainingId, date: '2026-02-14', status: 'completed' });

      const res = await request(app)
        .get(`/api/dogs/${dogId}/sessions/export`)
        .query({ from: '2026-12-31', to: '2026-01-01' });

      expect(res.status).toBe(200);
      expect(bodyLines(res.text)).toEqual([HEADER]);
    });

    it('serves UTF-8 content for non-ascii names and notes', async () => {
      dogs.save({ id: dogId, name: 'Rüdiger', picture: 'r.jpg' });
      sessions.save({ id: crypto.randomUUID(), dogId, trainingId, date: '2026-02-14', status: 'completed', notes: 'Café 🐕' });

      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export`);

      expect(res.text).toContain('Rüdiger');
      expect(res.text).toContain('Café 🐕');
      expect(res.headers['content-disposition'])
        .toBe('attachment; filename="r-diger-session-history-2026-02-14-2026-02-14.csv"');
    });

    it('returns 404 for an unknown dog', async () => {
      const res = await request(app).get(`/api/dogs/${crypto.randomUUID()}/sessions/export`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Dog not found');
    });

    it('returns 400 for a malformed dogId', async () => {
      const res = await request(app).get('/api/dogs/not-a-uuid/sessions/export');
      expect(res.status).toBe(400);
    });

    it.each(['not-a-date', '2026-13-45', '14/02/2026'])('returns 400 for malformed from=%s', async (from) => {
      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export`).query({ from });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('from and to must be YYYY-MM-DD dates');
    });

    it('returns 400 for a malformed to', async () => {
      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export`).query({ to: 'nope' });
      expect(res.status).toBe(400);
    });

    it('does not let the :id route swallow the export path', async () => {
      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    });
  });

  describe('PUT /api/dogs/:dogId/sessions/:id', () => {
    it('updates session status, score and notes', async () => {
      const sessionId = crypto.randomUUID();
      sessions.save({ id: sessionId, dogId, trainingId, date: '2026-02-14', status: 'completed', score: 5 });

      const res = await request(app)
        .put(`/api/dogs/${dogId}/sessions/${sessionId}`)
        .send({ status: 'completed', score: 9, notes: 'Improved!' });

      expect(res.status).toBe(200);
      expect(res.body.score).toBe(9);
      expect(res.body.notes).toBe('Improved!');
      expect(res.body.trainingId).toBe(trainingId);
    });

    it('returns 404 for non-existent session', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .put(`/api/dogs/${dogId}/sessions/${fakeId}`)
        .send({ status: 'skipped' });

      expect(res.status).toBe(404);
    });

    it('returns 404 when session belongs to a different dog', async () => {
      const sessionId = crypto.randomUUID();
      sessions.save({ id: sessionId, dogId, trainingId, date: '2026-02-14', status: 'completed' });

      const dog2Id = crypto.randomUUID();
      dogs.save({ id: dog2Id, name: 'Rex', picture: 'rex.jpg' });

      const res = await request(app)
        .put(`/api/dogs/${dog2Id}/sessions/${sessionId}`)
        .send({ status: 'skipped' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when score provided for skipped status', async () => {
      const sessionId = crypto.randomUUID();
      sessions.save({ id: sessionId, dogId, trainingId, date: '2026-02-14', status: 'completed', score: 5 });

      const res = await request(app)
        .put(`/api/dogs/${dogId}/sessions/${sessionId}`)
        .send({ status: 'skipped', score: 5 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when score is out of range', async () => {
      const sessionId = crypto.randomUUID();
      sessions.save({ id: sessionId, dogId, trainingId, date: '2026-02-14', status: 'completed' });

      const res = await request(app)
        .put(`/api/dogs/${dogId}/sessions/${sessionId}`)
        .send({ score: 11 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/dogs/:dogId/sessions', () => {
    it('returns empty array when no sessions and no plan', async () => {
      const res = await request(app)
        .get(`/api/dogs/${dogId}/sessions?from=2026-02-09&to=2026-02-15`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns computed planned sessions based on plan schedule', async () => {
      const trainingId1 = crypto.randomUUID();
      const planId = crypto.randomUUID();
      plans.save({
        id: planId,
        name: 'Puppy Basics',
        schedule: {
          monday: [trainingId1], tuesday: [], wednesday: [],
          thursday: [], friday: [], saturday: [], sunday: []
        }
      });
      dogs.save({ id: dogId, name: 'Buddy', picture: 'buddy.jpg', planId });

      // 2026-02-09 is Monday, 2026-02-15 is Sunday
      const res = await request(app)
        .get(`/api/dogs/${dogId}/sessions?from=2026-02-09&to=2026-02-15`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toEqual({
        dogId,
        trainingId: trainingId1,
        planId,
        date: '2026-02-09',
        status: 'planned'
      });
      expect(res.body[0].id).toBeUndefined();
    });

    it('returns persisted sessions in the date range', async () => {
      const sessionId = crypto.randomUUID();
      sessions.save({ id: sessionId, dogId, trainingId, date: '2026-02-10', status: 'completed', score: 8 });

      const res = await request(app)
        .get(`/api/dogs/${dogId}/sessions?from=2026-02-09&to=2026-02-15`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(sessionId);
      expect(res.body[0].status).toBe('completed');
    });

    it('merges persisted sessions with computed planned sessions', async () => {
      const trainingId1 = crypto.randomUUID();
      const planId = crypto.randomUUID();
      plans.save({
        id: planId,
        name: 'Puppy Basics',
        schedule: {
          monday: [trainingId1], tuesday: [trainingId1], wednesday: [],
          thursday: [], friday: [], saturday: [], sunday: []
        }
      });
      dogs.save({ id: dogId, name: 'Buddy', picture: 'buddy.jpg', planId });

      const sessionId = crypto.randomUUID();
      sessions.save({ id: sessionId, dogId, trainingId: trainingId1, planId, date: '2026-02-09', status: 'completed', score: 9 });

      // Query Mon-Tue range
      const res = await request(app)
        .get(`/api/dogs/${dogId}/sessions?from=2026-02-09&to=2026-02-10`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      // Monday: persisted session takes precedence
      const monday = res.body.find((s: any) => s.date === '2026-02-09');
      expect(monday.id).toBeDefined();
      expect(monday.status).toBe('completed');
      expect(monday.score).toBe(9);

      // Tuesday: computed planned session
      const tuesday = res.body.find((s: any) => s.date === '2026-02-10');
      expect(tuesday.id).toBeUndefined();
      expect(tuesday.status).toBe('planned');
    });

    it('returns 400 if from/to query params are missing', async () => {
      const res1 = await request(app)
        .get(`/api/dogs/${dogId}/sessions`);
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .get(`/api/dogs/${dogId}/sessions?from=2026-02-09`);
      expect(res2.status).toBe(400);

      const res3 = await request(app)
        .get(`/api/dogs/${dogId}/sessions?to=2026-02-15`);
      expect(res3.status).toBe(400);
    });

    it('returns 404 if dog does not exist', async () => {
      const fakeDogId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/dogs/${fakeDogId}/sessions?from=2026-02-09&to=2026-02-15`);

      expect(res.status).toBe(404);
    });

    it('only returns sessions for the requested dog', async () => {
      sessions.save({ id: crypto.randomUUID(), dogId, trainingId, date: '2026-02-10', status: 'completed' });

      const dog2Id = crypto.randomUUID();
      dogs.save({ id: dog2Id, name: 'Rex', picture: 'rex.jpg' });
      sessions.save({ id: crypto.randomUUID(), dogId: dog2Id, trainingId, date: '2026-02-10', status: 'skipped' });

      const res = await request(app)
        .get(`/api/dogs/${dogId}/sessions?from=2026-02-09&to=2026-02-15`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].dogId).toBe(dogId);
    });
  });

  describe('DELETE /api/dogs/:dogId/sessions/:id', () => {
    it('deletes a session', async () => {
      const sessionId = crypto.randomUUID();
      sessions.save({ id: sessionId, dogId, trainingId, date: '2026-02-14', status: 'completed' });

      const res = await request(app).delete(`/api/dogs/${dogId}/sessions/${sessionId}`);
      expect(res.status).toBe(204);

      const getRes = await request(app).get(`/api/dogs/${dogId}/sessions/${sessionId}`);
      expect(getRes.status).toBe(404);
    });

    it('returns 404 for non-existent session', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app).delete(`/api/dogs/${dogId}/sessions/${fakeId}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 when session belongs to a different dog', async () => {
      const sessionId = crypto.randomUUID();
      sessions.save({ id: sessionId, dogId, trainingId, date: '2026-02-14', status: 'completed' });

      const dog2Id = crypto.randomUUID();
      dogs.save({ id: dog2Id, name: 'Rex', picture: 'rex.jpg' });

      const res = await request(app).delete(`/api/dogs/${dog2Id}/sessions/${sessionId}`);
      expect(res.status).toBe(404);
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import crypto from 'crypto';
import request from 'supertest';
import Papa from 'papaparse';
import { sessionRoutes } from './sessionRoutes.js';
import { FakeDogRepository } from '../dogs/FakeDogRepository.js';
import { FakeSessionRepository } from './FakeSessionRepository.js';
import { FakePlanRepository } from '../plans/FakePlanRepository.js';
import { FakeTrainingRepository } from '../trainings/FakeTrainingRepository.js';
import { SessionListingService } from './SessionListingService.js';

interface SessionResponse {
  id?: string;
  date: string;
  status: string;
  score?: number;
}

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
    app = express();
    app.use(express.json());
    app.use('/api', sessionRoutes(dogs, sessions, service, trainings));

    dogs.save({ id: dogId, name: 'Buddy', picture: 'buddy.jpg' });
  });

  describe('GET /api/dogs/:dogId/sessions/export.csv', () => {
    const header = 'date,dogName,dogId,trainingName,trainingId,planId,sessionId,status,score,notes';

    it('exports all recorded history for only the requested dog in date order', async () => {
      trainings.save({ id: trainingId, name: 'Sit', procedure: '', tips: '' });
      sessions.save({ id: 'later', dogId, trainingId, date: '2100-01-01', status: 'skipped' });
      sessions.save({
        id: 'earlier',
        dogId,
        trainingId,
        date: '1999-01-01',
        status: 'completed',
        score: 8,
        notes: 'Good',
        planId: 'old-plan',
      });
      sessions.save({
        id: 'other',
        dogId: crypto.randomUUID(),
        trainingId,
        date: '2026-01-01',
        status: 'completed',
      });
      sessions.save({ id: 'planned', dogId, trainingId, date: '2026-01-02', status: 'planned' });

      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export.csv`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="training-sessions-${dogId}.csv"`,
      );
      expect(res.text).toBe(
        '\uFEFF' +
        header +
        '\r\n' +
        `1999-01-01,Buddy,${dogId},Sit,${trainingId},old-plan,earlier,completed,8,Good\r\n` +
        `2100-01-01,Buddy,${dogId},Sit,${trainingId},,later,skipped,,\r\n`,
      );
    });

    it('quotes delimiters, quotes and multiline Unicode notes', async () => {
      trainings.save({ id: trainingId, name: 'Sit, "stay"', procedure: '', tips: '' });
      sessions.save({
        id: 'quoted',
        dogId,
        trainingId,
        date: '2026-01-01',
        status: 'completed',
        notes: 'Tr\u00e8s bien\n"Good", again',
      });
      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export.csv`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('"Sit, ""stay"""');
      expect(res.text).toContain('"Tr\u00e8s bien\n""Good"", again"');
    });

    it.each(['=1+1', '+cmd', '-cmd', '@SUM(1)', '\tformula', '\rformula', '  =1+1'])(
      'neutralizes spreadsheet formulas in text: %j',
      async (value) => {
        dogs.save({ id: dogId, name: value, picture: '' });
        trainings.save({ id: trainingId, name: value, procedure: '', tips: '' });
        sessions.save({
          id: 'safe',
          dogId,
          trainingId,
          date: '2026-01-01',
          status: 'completed',
          notes: value,
        });
        const res = await request(app).get(`/api/dogs/${dogId}/sessions/export.csv`);
        expect(res.status).toBe(200);
        expect(res.text.split("'" + value)).toHaveLength(4);
      },
    );

    it('neutralizes formula-like arrays accepted by the session write API', async () => {
      const created = await request(app).post(`/api/dogs/${dogId}/sessions`).send({
        trainingId: ['=1+1'],
        planId: ['+cmd'],
        date: '2026-01-01',
        status: 'completed',
        notes: ['@SUM(1)'],
      });
      expect(created.status).toBe(201);

      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export.csv`);
      expect(res.status).toBe(200);
      const parsed = Papa.parse(res.text, { header: true, skipEmptyLines: true });
      expect(parsed.errors).toEqual([]);
      expect(parsed.data).toEqual([
        expect.objectContaining({
          sessionId: created.body.id,
          trainingId: "'=1+1",
          planId: "'+cmd",
          notes: "'@SUM(1)",
        }),
      ]);
    });

    it('keeps sessions whose training has been deleted, with an empty name', async () => {
      sessions.save({ id: 'orphan', dogId, trainingId, date: '2026-01-01', status: 'skipped' });
      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export.csv`);
      expect(res.status).toBe(200);
      expect(res.text).toContain(`2026-01-01,Buddy,${dogId},,${trainingId},,orphan,skipped,,`);
    });

    it('returns headers only for a dog with no recorded sessions, even with a plan', async () => {
      const planId = crypto.randomUUID();
      plans.save({ id: planId, name: 'Weekly', schedule: { monday: [trainingId] } });
      dogs.save({ id: dogId, name: 'Buddy', picture: '', planId });
      const res = await request(app).get(`/api/dogs/${dogId}/sessions/export.csv`);
      expect(res.status).toBe(200);
      expect(res.text).toBe('\uFEFF' + header + '\r\n');
    });

    it('returns 404 for an unknown dog and 400 for an invalid dog ID', async () => {
      expect(
        (await request(app).get(`/api/dogs/${crypto.randomUUID()}/sessions/export.csv`)).status,
      ).toBe(404);
      expect((await request(app).get('/api/dogs/invalid/sessions/export.csv')).status).toBe(400);
    });
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
      const res = await request(app).post(`/api/dogs/${dogId}/sessions`).send({
        trainingId,
        planId,
        date: '2026-02-14',
        status: 'completed',
        score: 7,
        notes: 'Good boy',
      });

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
      const res = await request(app).post(`/api/dogs/${dogId}/sessions`).send({ trainingId });

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
      sessions.save({
        id: sessionId,
        dogId,
        trainingId,
        date: '2026-02-14',
        status: 'completed',
        score: 9,
      });

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

  describe('PUT /api/dogs/:dogId/sessions/:id', () => {
    it('updates session status, score and notes', async () => {
      const sessionId = crypto.randomUUID();
      sessions.save({
        id: sessionId,
        dogId,
        trainingId,
        date: '2026-02-14',
        status: 'completed',
        score: 5,
      });

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
      sessions.save({
        id: sessionId,
        dogId,
        trainingId,
        date: '2026-02-14',
        status: 'completed',
        score: 5,
      });

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
      const res = await request(app).get(
        `/api/dogs/${dogId}/sessions?from=2026-02-09&to=2026-02-15`,
      );

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
          monday: [trainingId1],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
        },
      });
      dogs.save({ id: dogId, name: 'Buddy', picture: 'buddy.jpg', planId });

      // 2026-02-09 is Monday, 2026-02-15 is Sunday
      const res = await request(app).get(
        `/api/dogs/${dogId}/sessions?from=2026-02-09&to=2026-02-15`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toEqual({
        dogId,
        trainingId: trainingId1,
        planId,
        date: '2026-02-09',
        status: 'planned',
      });
      expect(res.body[0].id).toBeUndefined();
    });

    it('returns persisted sessions in the date range', async () => {
      const sessionId = crypto.randomUUID();
      sessions.save({
        id: sessionId,
        dogId,
        trainingId,
        date: '2026-02-10',
        status: 'completed',
        score: 8,
      });

      const res = await request(app).get(
        `/api/dogs/${dogId}/sessions?from=2026-02-09&to=2026-02-15`,
      );

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
          monday: [trainingId1],
          tuesday: [trainingId1],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
        },
      });
      dogs.save({ id: dogId, name: 'Buddy', picture: 'buddy.jpg', planId });

      const sessionId = crypto.randomUUID();
      sessions.save({
        id: sessionId,
        dogId,
        trainingId: trainingId1,
        planId,
        date: '2026-02-09',
        status: 'completed',
        score: 9,
      });

      // Query Mon-Tue range
      const res = await request(app).get(
        `/api/dogs/${dogId}/sessions?from=2026-02-09&to=2026-02-10`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      // Monday: persisted session takes precedence
      const monday = (res.body as SessionResponse[]).find((s) => s.date === '2026-02-09');
      expect(monday?.id).toBeDefined();
      expect(monday?.status).toBe('completed');
      expect(monday?.score).toBe(9);

      // Tuesday: computed planned session
      const tuesday = (res.body as SessionResponse[]).find((s) => s.date === '2026-02-10');
      expect(tuesday?.id).toBeUndefined();
      expect(tuesday?.status).toBe('planned');
    });

    it('returns 400 if from/to query params are missing', async () => {
      const res1 = await request(app).get(`/api/dogs/${dogId}/sessions`);
      expect(res1.status).toBe(400);

      const res2 = await request(app).get(`/api/dogs/${dogId}/sessions?from=2026-02-09`);
      expect(res2.status).toBe(400);

      const res3 = await request(app).get(`/api/dogs/${dogId}/sessions?to=2026-02-15`);
      expect(res3.status).toBe(400);
    });

    it('returns 404 if dog does not exist', async () => {
      const fakeDogId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app).get(
        `/api/dogs/${fakeDogId}/sessions?from=2026-02-09&to=2026-02-15`,
      );

      expect(res.status).toBe(404);
    });

    it('only returns sessions for the requested dog', async () => {
      sessions.save({
        id: crypto.randomUUID(),
        dogId,
        trainingId,
        date: '2026-02-10',
        status: 'completed',
      });

      const dog2Id = crypto.randomUUID();
      dogs.save({ id: dog2Id, name: 'Rex', picture: 'rex.jpg' });
      sessions.save({
        id: crypto.randomUUID(),
        dogId: dog2Id,
        trainingId,
        date: '2026-02-10',
        status: 'skipped',
      });

      const res = await request(app).get(
        `/api/dogs/${dogId}/sessions?from=2026-02-09&to=2026-02-15`,
      );

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

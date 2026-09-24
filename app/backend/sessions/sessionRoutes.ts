import { Router } from 'express';
import crypto from 'crypto';
import type { DogRepository } from '../dogs/DogRepository.js';
import type { SessionRepository } from './SessionRepository.js';
import type { SessionListingService } from './SessionListingService.js';
import type { TrainingRepository } from '../trainings/TrainingRepository.js';
import type { Session } from '../shared/types.js';
import { validateUuid, isValidUuid } from '../shared/validateUuid.js';
import { buildSessionCsv, slugify, type SessionCsvRow } from './sessionCsv.js';

export function sessionRoutes(
  dogs: DogRepository,
  sessions: SessionRepository,
  service: SessionListingService,
  trainings: TrainingRepository,
): Router {
  const router = Router();
  router.param('id', validateUuid);
  router.param('dogId', validateUuid);

  router.get('/dogs/:dogId/sessions', (req, res) => {
    const { dogId } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params are required' });
    }

    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);

    const result = service.list(dogId, fromDate, toDate);
    if ('error' in result) {
      return res.status(404).json({ error: result.error });
    }
    res.json(result.sessions);
  });

  router.post('/dogs/:dogId/sessions', (req, res) => {
    const { dogId } = req.params;
    const dog = dogs.getById(dogId);
    if (!dog) return res.status(404).json({ error: 'Dog not found' });

    const { trainingId, planId, date, status, score, notes } = req.body;

    if (!trainingId || !date || !status) {
      return res.status(400).json({ error: 'trainingId, date, and status are required' });
    }

    if (status !== 'completed' && status !== 'skipped') {
      return res.status(400).json({ error: 'Status must be "completed" or "skipped"' });
    }

    if (score !== undefined && status === 'skipped') {
      return res.status(400).json({ error: 'Score is only allowed when status is completed' });
    }

    if (score !== undefined && (score < 1 || score > 10)) {
      return res.status(400).json({ error: 'Score must be between 1 and 10' });
    }

    const id = crypto.randomUUID();
    const session: Record<string, unknown> = { id, dogId, trainingId, date, status };
    if (planId !== undefined) session.planId = planId;
    if (score !== undefined) session.score = score;
    if (notes !== undefined) session.notes = notes;

    sessions.save(session as unknown as Session);
    res.status(201).json(session);
  });

  // Exports this dog's session results as CSV. Must be declared before the
  // `/dogs/:dogId/sessions/:id` route so "export" is not parsed as a session id.
  router.get('/dogs/:dogId/sessions/export', (req, res) => {
    const { dogId } = req.params;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const trainingId = req.query.trainingId as string | undefined;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params are required' });
    }

    if (trainingId !== undefined && !isValidUuid(trainingId)) {
      return res.status(400).json({ error: 'trainingId must be a valid UUID' });
    }

    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'from and to must be valid dates' });
    }

    const dog = dogs.getById(dogId);
    if (!dog) return res.status(404).json({ error: 'Dog not found' });

    const result = service.list(dogId, fromDate, toDate);
    if ('error' in result) {
      return res.status(404).json({ error: result.error });
    }

    const rows: SessionCsvRow[] = result.sessions
      .filter((s) => s.status === 'completed' || s.status === 'skipped')
      .filter((s) => trainingId === undefined || s.trainingId === trainingId)
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))
      .map((s) => ({
        date: s.date as string,
        training: trainings.getById(s.trainingId as string)?.name ?? (s.trainingId as string),
        status: s.status as string,
        score: typeof s.score === 'number' ? s.score : undefined,
        notes: typeof s.notes === 'string' ? s.notes : undefined,
      }));

    const csv = buildSessionCsv({ dogName: dog.name, from, to, rows });
    const dogSlug = slugify(dog.name) || 'dog';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sessions-${dogSlug}-${from}_${to}.csv"`,
    );
    res.send(csv);
  });

  router.get('/dogs/:dogId/sessions/:id', (req, res) => {
    const { dogId, id } = req.params;
    const session = sessions.getById(id);
    if (!session || session.dogId !== dogId) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  });

  router.put('/dogs/:dogId/sessions/:id', (req, res) => {
    const { dogId, id } = req.params;
    const existing = sessions.getById(id);
    if (!existing || existing.dogId !== dogId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { status, score, notes } = req.body;
    const updatedStatus = status ?? existing.status;

    if (score !== undefined && updatedStatus === 'skipped') {
      return res.status(400).json({ error: 'Score is only allowed when status is completed' });
    }

    if (score !== undefined && (score < 1 || score > 10)) {
      return res.status(400).json({ error: 'Score must be between 1 and 10' });
    }

    const updated = {
      ...existing,
      status: updatedStatus,
      score: score ?? existing.score,
      notes: notes ?? existing.notes,
    };

    sessions.save(updated);
    res.json(updated);
  });

  router.delete('/dogs/:dogId/sessions/:id', (req, res) => {
    const { dogId, id } = req.params;
    const session = sessions.getById(id);
    if (!session || session.dogId !== dogId) {
      return res.status(404).json({ error: 'Session not found' });
    }
    sessions.delete(id);
    res.status(204).send();
  });

  return router;
}

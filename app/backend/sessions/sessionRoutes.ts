import { Router } from 'express';
import crypto from 'crypto';
import type { DogRepository } from '../dogs/DogRepository.js';
import type { SessionRepository } from './SessionRepository.js';
import type { SessionListingService } from './SessionListingService.js';
import type { TrainingRepository } from '../trainings/TrainingRepository.js';
import type { Session } from '../shared/types.js';
import { validateUuid } from '../shared/validateUuid.js';

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function sessionRoutes(
  dogs: DogRepository,
  sessions: SessionRepository,
  service: SessionListingService,
  trainings?: TrainingRepository,
): Router {
  const router = Router();
  router.param('id', validateUuid);
  router.param('dogId', validateUuid);

  router.get('/dogs/:dogId/sessions/export', (req, res) => {
    const { dogId } = req.params;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const dog = dogs.getById(dogId);
    if (!dog) return res.status(404).json({ error: 'Dog not found' });

    let sessionList;
    if (from && to) {
      const fromDate = new Date(`${from}T00:00:00`);
      const toDate = new Date(`${to}T00:00:00`);
      sessionList = sessions.getByDogIdInRange(dogId, fromDate, toDate);
    } else {
      sessionList = sessions.getByDogId(dogId);
    }

    // Build a training name lookup
    const trainingMap = new Map<string, string>();
    if (trainings) {
      for (const t of trainings.getAll()) {
        trainingMap.set(t.id, t.name);
      }
    }

    const header = 'date,dog,training,status,score,notes';
    const rows = sessionList
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => {
        const date = escapeCsvField(s.date);
        const dogName = escapeCsvField(dog.name);
        const trainingName = escapeCsvField(
          trainingMap.get(s.trainingId) || s.trainingId,
        );
        const status = escapeCsvField(s.status);
        const score = s.score != null ? String(s.score) : '';
        const notes = escapeCsvField(s.notes ?? '');
        return `${date},${dogName},${trainingName},${status},${score},${notes}`;
      });

    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${dog.name}-sessions.csv"`);
    res.send(csv);
  });

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

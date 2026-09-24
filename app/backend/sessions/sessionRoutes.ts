import { Router } from 'express';
import crypto from 'crypto';
import type { DogRepository } from '../dogs/DogRepository.js';
import type { SessionRepository } from './SessionRepository.js';
import type { SessionListingService } from './SessionListingService.js';
import type { Session } from '../shared/types.js';
import type { TrainingRepository } from '../trainings/TrainingRepository.js';
import { validateUuid } from '../shared/validateUuid.js';

function escapeCsv(value: string): string {
  const safeValue = /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function filenamePart(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'dog'
  );
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

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

  router.get('/dogs/:dogId/sessions/export', (req, res) => {
    const { dogId } = req.params;
    const { from, to } = req.query;
    if (
      typeof from !== 'string' ||
      typeof to !== 'string' ||
      !isValidDate(from) ||
      !isValidDate(to)
    ) {
      return res.status(400).json({ error: 'Valid from and to dates are required (YYYY-MM-DD)' });
    }
    if (from > to) {
      return res.status(400).json({ error: 'from must be on or before to' });
    }

    const dog = dogs.getById(dogId);
    if (!dog) return res.status(404).json({ error: 'Dog not found' });

    const trainingNames = new Map(
      trainings.getAll().map((training) => [training.id, training.name]),
    );
    const rows = sessions
      .getByDogIdInRange(dogId, new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59.999`))
      .filter((session) => session.status === 'completed' || session.status === 'skipped')
      .sort((a, b) => a.date.localeCompare(b.date) || a.trainingId.localeCompare(b.trainingId))
      .map((session) =>
        [
          dog.name,
          session.date,
          trainingNames.get(session.trainingId) ?? session.trainingId,
          session.status,
          session.score?.toString() ?? '',
          session.notes ?? '',
        ]
          .map(escapeCsv)
          .join(','),
      );

    const csv = [['Dog', 'Date', 'Training', 'Status', 'Score', 'Notes'].join(','), ...rows].join(
      '\r\n',
    );
    const filename = `${filenamePart(dog.name)}-${from}-${to}-report.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
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

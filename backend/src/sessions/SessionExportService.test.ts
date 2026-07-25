import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { SessionExportService } from './SessionExportService.js';
import { FakeDogRepository } from '../dogs/FakeDogRepository.js';
import { FakeTrainingRepository } from '../trainings/FakeTrainingRepository.js';
import { FakePlanRepository } from '../plans/FakePlanRepository.js';
import { FakeSessionRepository } from './FakeSessionRepository.js';
import type { Session } from '../shared/types.js';

const BOM = '﻿';

describe('SessionExportService', () => {
  let dogs: FakeDogRepository;
  let trainings: FakeTrainingRepository;
  let sessions: FakeSessionRepository;
  let plans: FakePlanRepository;
  let service: SessionExportService;

  const dogId = crypto.randomUUID();
  const sitId = crypto.randomUUID();
  const heelId = crypto.randomUUID();

  beforeEach(() => {
    dogs = new FakeDogRepository();
    trainings = new FakeTrainingRepository();
    sessions = new FakeSessionRepository();
    plans = new FakePlanRepository();
    service = new SessionExportService(dogs, trainings, sessions);

    dogs.save({ id: dogId, name: 'Rex', picture: 'rex.jpg' });
    trainings.save({ id: sitId, name: 'Sit', procedure: '', tips: '' });
    trainings.save({ id: heelId, name: 'Heel', procedure: '', tips: '' });
  });

  const save = (overrides: Partial<Session> = {}) =>
    sessions.save({
      id: crypto.randomUUID(),
      dogId,
      trainingId: sitId,
      date: '2026-02-14',
      status: 'completed',
      ...overrides
    });

  const exportOf = (from?: string, to?: string) => {
    const result = service.export(dogId, from, to);
    if ('error' in result) throw new Error(result.error);
    return result;
  };

  const rows = (csv: string) => csv.slice(BOM.length).split('\r\n').slice(1);

  it('reports an unknown dog', () => {
    expect(service.export(crypto.randomUUID())).toEqual({ error: 'Dog not found' });
  });

  it('exports a header row only when the dog has no sessions', () => {
    expect(rows(exportOf().csv)).toEqual([]);
  });

  it('exports completed and skipped sessions with names instead of ids', () => {
    save({ date: '2026-02-14', trainingId: sitId, score: 8, notes: 'Nailed it' });
    save({ date: '2026-02-15', trainingId: heelId, status: 'skipped' });

    expect(rows(exportOf().csv)).toEqual([
      '2026-02-14,Rex,Sit,completed,8,Nailed it',
      '2026-02-15,Rex,Heel,skipped,,'
    ]);
  });

  it('sorts ascending by date, tiebreaking on training name', () => {
    save({ date: '2026-02-15', trainingId: sitId });
    save({ date: '2026-02-14', trainingId: sitId });
    save({ date: '2026-02-14', trainingId: heelId });

    expect(rows(exportOf().csv).map(r => r.slice(0, 21))).toEqual([
      '2026-02-14,Rex,Heel,c',
      '2026-02-14,Rex,Sit,co',
      '2026-02-15,Rex,Sit,co'
    ]);
  });

  it('falls back to the raw id when the training no longer exists', () => {
    const goneId = crypto.randomUUID();
    save({ trainingId: goneId });

    expect(rows(exportOf().csv)[0]).toBe(`2026-02-14,Rex,${goneId},completed,,`);
  });

  it('never includes planned sessions synthesized from the plan schedule', () => {
    const planId = crypto.randomUUID();
    plans.save({ id: planId, name: 'Weekly', schedule: { saturday: [sitId] } });
    dogs.save({ id: dogId, name: 'Rex', picture: 'rex.jpg', planId });

    expect(rows(exportOf().csv)).toEqual([]);
  });

  describe('date filtering', () => {
    beforeEach(() => {
      save({ date: '2026-01-01' });
      save({ date: '2026-02-14' });
      save({ date: '2026-03-31' });
    });

    it('exports the whole history when no range is given', () => {
      expect(rows(exportOf().csv)).toHaveLength(3);
    });

    it('includes the range boundaries', () => {
      expect(rows(exportOf('2026-01-01', '2026-02-14').csv)).toHaveLength(2);
    });

    it('treats a missing upper bound as unbounded', () => {
      expect(rows(exportOf('2026-02-14').csv)).toHaveLength(2);
    });

    it('treats a missing lower bound as unbounded', () => {
      expect(rows(exportOf(undefined, '2026-02-14').csv)).toHaveLength(2);
    });

    it('yields a header row only when from is after to', () => {
      expect(rows(exportOf('2026-03-01', '2026-01-01').csv)).toEqual([]);
    });
  });

  describe('filename', () => {
    it('uses the requested range', () => {
      save();
      expect(exportOf('2026-01-01', '2026-12-31').filename)
        .toBe('rex-session-history-2026-01-01-2026-12-31.csv');
    });

    it('derives omitted range bounds from the first and last exported session', () => {
      save({ date: '2026-01-01' });
      save({ date: '2026-03-31' });
      expect(exportOf().filename).toBe('rex-session-history-2026-01-01-2026-03-31.csv');
    });

    it('uses "all" for a bound that is neither requested nor derivable', () => {
      expect(exportOf().filename).toBe('rex-session-history-all-all.csv');
    });

    it('slugifies a dog name with non-ascii characters and spaces', () => {
      dogs.save({ id: dogId, name: 'Rüdiger von Hügel', picture: 'r.jpg' });
      expect(exportOf().filename).toBe('r-diger-von-h-gel-session-history-all-all.csv');
    });

    it('falls back to "dog" when the name slugifies to nothing', () => {
      dogs.save({ id: dogId, name: '🐕', picture: 'r.jpg' });
      expect(exportOf().filename).toBe('dog-session-history-all-all.csv');
    });
  });
});

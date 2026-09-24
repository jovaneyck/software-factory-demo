import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { SessionCsvExporter } from './SessionCsvExporter.js';
import { FakeDogRepository } from '../dogs/FakeDogRepository.js';
import { FakeTrainingRepository } from '../trainings/FakeTrainingRepository.js';
import { FakeSessionRepository } from './FakeSessionRepository.js';

const from = new Date('2000-01-01T00:00:00');
const to = new Date('2099-12-31T00:00:00');

describe('SessionCsvExporter', () => {
  let dogs: FakeDogRepository;
  let trainings: FakeTrainingRepository;
  let sessions: FakeSessionRepository;
  let exporter: SessionCsvExporter;
  const dogId = crypto.randomUUID();
  const trainingId = crypto.randomUUID();

  function rows(result: ReturnType<SessionCsvExporter['export']>): string[] {
    if (!('csv' in result)) throw new Error('expected a CSV result');
    return result.csv.replace('\uFEFF', '').trimEnd().split('\r\n');
  }

  beforeEach(() => {
    dogs = new FakeDogRepository();
    trainings = new FakeTrainingRepository();
    sessions = new FakeSessionRepository();
    exporter = new SessionCsvExporter(dogs, trainings, sessions);

    dogs.save({ id: dogId, name: 'Buddy', picture: 'buddy.jpg' });
    trainings.save({ id: trainingId, name: 'Sit', procedure: '', tips: '' });
  });

  it('returns an error for an unknown dog', () => {
    const result = exporter.export('00000000-0000-0000-0000-000000000000', from, to);
    expect(result).toEqual({ error: 'Dog not found' });
  });

  it('builds a slugified filename and a header-only CSV when there are no sessions', () => {
    const result = exporter.export(dogId, from, to);
    expect(result).toEqual({
      filename: 'buddy-sessions.csv',
      csv: '\uFEFFDate,Training,Status,Score,Notes\r\n',
    });
  });

  it('falls back to a generic filename when the name has no usable characters', () => {
    const otherId = crypto.randomUUID();
    dogs.save({ id: otherId, name: '🐕', picture: 'x.jpg' });
    const result = exporter.export(otherId, from, to);
    expect('filename' in result && result.filename).toBe('dog-sessions.csv');
  });

  it('sorts records by date, then training name', () => {
    const stayId = crypto.randomUUID();
    trainings.save({ id: stayId, name: 'Stay', procedure: '', tips: '' });

    sessions.save({
      id: crypto.randomUUID(),
      dogId,
      trainingId,
      date: '2026-02-10',
      status: 'completed',
    });
    sessions.save({
      id: crypto.randomUUID(),
      dogId,
      trainingId: stayId,
      date: '2026-02-10',
      status: 'skipped',
    });
    sessions.save({
      id: crypto.randomUUID(),
      dogId,
      trainingId,
      date: '2026-02-01',
      status: 'completed',
    });

    const lines = rows(exporter.export(dogId, from, to));
    expect(lines[1]).toBe('2026-02-01,Sit,completed,,');
    expect(lines[2]).toBe('2026-02-10,Sit,completed,,');
    expect(lines[3]).toBe('2026-02-10,Stay,skipped,,');
  });

  it('leaves score blank for skipped sessions', () => {
    sessions.save({
      id: crypto.randomUUID(),
      dogId,
      trainingId,
      date: '2026-02-10',
      status: 'skipped',
    });
    const lines = rows(exporter.export(dogId, from, to));
    expect(lines[1]).toBe('2026-02-10,Sit,skipped,,');
  });

  it('quotes and escapes notes containing commas, quotes and newlines', () => {
    sessions.save({
      id: crypto.randomUUID(),
      dogId,
      trainingId,
      date: '2026-02-10',
      status: 'completed',
      score: 7,
      notes: 'Great, he said "woof"\nthen sat',
    });
    const lines = rows(exporter.export(dogId, from, to));
    // The embedded newline is preserved inside the quoted field, so it stays
    // part of a single logical row (RFC 4180).
    expect(lines[1]).toBe('2026-02-10,Sit,completed,7,"Great, he said ""woof""\nthen sat"');
  });

  it('neutralises formula injection in text fields', () => {
    const maliciousTrainingId = crypto.randomUUID();
    trainings.save({
      id: maliciousTrainingId,
      name: '=SUM(A1:A2)',
      procedure: '',
      tips: '',
    });
    sessions.save({
      id: crypto.randomUUID(),
      dogId,
      trainingId: maliciousTrainingId,
      date: '2026-02-10',
      status: 'completed',
      score: 5,
      notes: '@cmd',
    });

    const lines = rows(exporter.export(dogId, from, to));
    expect(lines[1]).toBe("2026-02-10,'=SUM(A1:A2),completed,5,'@cmd");
  });

  it('neutralises and quotes a formula-like value that also contains a comma', () => {
    sessions.save({
      id: crypto.randomUUID(),
      dogId,
      trainingId,
      date: '2026-02-10',
      status: 'completed',
      score: 5,
      notes: '=cmd("x"),y',
    });

    const lines = rows(exporter.export(dogId, from, to));
    expect(lines[1]).toBe('2026-02-10,Sit,completed,5,"\'=cmd(""x""),y"');
  });

  it('does not alter score values', () => {
    sessions.save({
      id: crypto.randomUUID(),
      dogId,
      trainingId,
      date: '2026-02-10',
      status: 'completed',
      score: 7,
    });
    const lines = rows(exporter.export(dogId, from, to));
    expect(lines[1]).toBe('2026-02-10,Sit,completed,7,');
  });

  it('falls back to the training id when the training is unknown', () => {
    const unknownTrainingId = crypto.randomUUID();
    sessions.save({
      id: crypto.randomUUID(),
      dogId,
      trainingId: unknownTrainingId,
      date: '2026-02-10',
      status: 'completed',
    });
    const lines = rows(exporter.export(dogId, from, to));
    expect(lines[1]).toBe(`2026-02-10,${unknownTrainingId},completed,,`);
  });
});

import { describe, it, expect } from 'vitest';
import { sessionsToCsv, sessionsFilename } from './sessionCsv.js';

describe('sessionsToCsv', () => {
  it('emits a header-only document with BOM and CRLF when there are no sessions', () => {
    expect(sessionsToCsv([], new Map())).toBe('\uFEFFDate,Training,Status,Score,Notes\r\n');
  });

  it('resolves training names and leaves score blank for skipped sessions', () => {
    const csv = sessionsToCsv(
      [
        { date: '2026-02-14', trainingId: 't1', status: 'completed', score: 8 },
        { date: '2026-02-15', trainingId: 't2', status: 'skipped' },
      ],
      new Map([['t1', 'Sit']]),
    );

    expect(csv).toBe(
      '\uFEFFDate,Training,Status,Score,Notes\r\n' +
        '2026-02-14,Sit,completed,8,\r\n' +
        '2026-02-15,t2,skipped,,\r\n',
    );
  });

  it('sorts rows by date ascending', () => {
    const csv = sessionsToCsv(
      [
        { date: '2026-03-01', trainingId: 't1', status: 'completed' },
        { date: '2026-01-01', trainingId: 't1', status: 'completed' },
        { date: '2026-02-01', trainingId: 't1', status: 'completed' },
      ],
      new Map([['t1', 'Sit']]),
    );

    const dates = csv
      .split('\r\n')
      .slice(1, 4)
      .map((line) => line.split(',')[0]);
    expect(dates).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('quotes fields containing commas, quotes and newlines (RFC 4180)', () => {
    const csv = sessionsToCsv(
      [
        {
          date: '2026-02-14',
          trainingId: 't1',
          status: 'completed',
          notes: 'Great, "very" good\nline two',
        },
      ],
      new Map([['t1', 'Sit']]),
    );

    expect(csv).toContain('"Great, ""very"" good\nline two"');
  });
});

describe('sessionsFilename', () => {
  it('slugifies the dog name', () => {
    expect(sessionsFilename('Buddy')).toBe('buddy-sessions.csv');
    expect(sessionsFilename('Mr. Wiggles!')).toBe('mr-wiggles-sessions.csv');
    expect(sessionsFilename('  ')).toBe('dog-sessions.csv');
  });
});

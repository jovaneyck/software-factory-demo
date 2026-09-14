import { describe, it, expect } from 'vitest';
import { escapeCsvField, sessionsToCsv, csvFilename } from './sessionCsv.js';
import type { Session, Training } from '../shared/types.js';

const training = (id: string, name: string): Training => ({
  id,
  name,
  procedure: '',
  tips: '',
});

const session = (overrides: Partial<Session>): Session => ({
  id: 'sid',
  dogId: 'dog',
  trainingId: 't1',
  date: '2026-02-10',
  status: 'completed',
  ...overrides,
});

describe('escapeCsvField', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsvField('hello')).toBe('hello');
  });

  it('quotes values containing commas', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes values containing newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('sessionsToCsv', () => {
  it('emits a header row', () => {
    const csv = sessionsToCsv([], []);
    expect(csv).toBe('date,training,status,score,notes');
  });

  it('resolves training names and formats rows', () => {
    const csv = sessionsToCsv(
      [session({ trainingId: 't1', score: 8, notes: 'good' })],
      [training('t1', 'Sit')],
    );
    expect(csv).toBe('date,training,status,score,notes\r\n2026-02-10,Sit,completed,8,good');
  });

  it('sorts sessions by date ascending', () => {
    const csv = sessionsToCsv(
      [
        session({ date: '2026-03-01', trainingId: 't1' }),
        session({ date: '2026-01-01', trainingId: 't1' }),
      ],
      [training('t1', 'Sit')],
    );
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain('2026-01-01');
    expect(lines[2]).toContain('2026-03-01');
  });

  it('leaves score and notes blank when absent', () => {
    const csv = sessionsToCsv([session({ status: 'skipped', trainingId: 't1' })], [training('t1', 'Sit')]);
    expect(csv).toBe('date,training,status,score,notes\r\n2026-02-10,Sit,skipped,,');
  });

  it('escapes notes with commas and quotes', () => {
    const csv = sessionsToCsv(
      [session({ trainingId: 't1', notes: 'good, but said "no"' })],
      [training('t1', 'Sit')],
    );
    expect(csv).toContain('"good, but said ""no"""');
  });

  it('falls back to the raw id for unknown trainings', () => {
    const csv = sessionsToCsv([session({ trainingId: 'unknown' })], []);
    expect(csv).toContain('unknown');
  });
});

describe('csvFilename', () => {
  it('slugifies the dog name and includes the date range', () => {
    const name = csvFilename('Django', [
      session({ date: '2026-01-01' }),
      session({ date: '2026-05-12' }),
    ]);
    expect(name).toBe('django-progress-2026-01-01-to-2026-05-12.csv');
  });

  it('uses a single date when all sessions share one date', () => {
    expect(csvFilename('Rex', [session({ date: '2026-02-10' })])).toBe(
      'rex-progress-2026-02-10.csv',
    );
  });

  it('omits the range when there are no sessions', () => {
    expect(csvFilename('Buddy', [])).toBe('buddy-progress.csv');
  });

  it('handles names with spaces and punctuation', () => {
    expect(csvFilename('Mr. Fluffy!', [])).toBe('mr-fluffy-progress.csv');
  });
});

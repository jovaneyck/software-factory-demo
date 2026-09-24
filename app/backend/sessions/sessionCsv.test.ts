import { describe, it, expect } from 'vitest';
import { buildSessionCsv, escapeCsv, slugify } from './sessionCsv.js';

describe('escapeCsv', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsv('completed')).toBe('completed');
    expect(escapeCsv('2026-02-10')).toBe('2026-02-10');
  });

  it('quotes values containing commas, quotes or newlines', () => {
    expect(escapeCsv('Good, boy')).toBe('"Good, boy"');
    expect(escapeCsv('He said "sit"')).toBe('"He said ""sit"""');
    expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsv('carriage\rreturn')).toBe('"carriage\rreturn"');
  });
});

describe('buildSessionCsv', () => {
  it('includes the dog name and date range preamble before the table', () => {
    const csv = buildSessionCsv({
      dogName: 'Buddy',
      from: '2026-02-09',
      to: '2026-02-15',
      rows: [
        { date: '2026-02-10', training: 'Sit', status: 'completed', score: 8, notes: 'Great' },
      ],
    });

    expect(csv).toBe(
      'Dog,Buddy\r\n' +
        'From,2026-02-09\r\n' +
        'To,2026-02-15\r\n' +
        '\r\n' +
        'Date,Training,Status,Score,Notes\r\n' +
        '2026-02-10,Sit,completed,8,Great\r\n',
    );
  });

  it('leaves score and notes empty when absent', () => {
    const csv = buildSessionCsv({
      dogName: 'Buddy',
      from: '2026-02-09',
      to: '2026-02-15',
      rows: [{ date: '2026-02-11', training: 'Stay', status: 'skipped' }],
    });

    expect(csv).toContain('2026-02-11,Stay,skipped,,\r\n');
  });

  it('escapes dog names and notes containing commas', () => {
    const csv = buildSessionCsv({
      dogName: 'Rex, the Great',
      from: '2026-02-09',
      to: '2026-02-15',
      rows: [
        { date: '2026-02-10', training: 'Sit', status: 'completed', score: 1, notes: 'a,b' },
      ],
    });

    expect(csv).toContain('Dog,"Rex, the Great"');
    expect(csv).toContain('2026-02-10,Sit,completed,1,"a,b"');
  });

  it('renders only a header when there are no rows', () => {
    const csv = buildSessionCsv({
      dogName: 'Buddy',
      from: '2026-02-09',
      to: '2026-02-15',
      rows: [],
    });

    expect(csv.endsWith('Date,Training,Status,Score,Notes\r\n')).toBe(true);
  });
});

describe('slugify', () => {
  it('produces a filename-safe slug', () => {
    expect(slugify('Django')).toBe('django');
    expect(slugify('Rex, the Great!')).toBe('rex-the-great');
  });
});
import { describe, it, expect } from 'vitest';
import { toCsv, type ExportRow } from './sessionCsv.js';

const BOM = '﻿';
const HEADER = 'date,dog,training,status,score,notes';

const row = (overrides: Partial<ExportRow> = {}): ExportRow => ({
  date: '2026-02-14',
  dog: 'Rex',
  training: 'Sit',
  status: 'completed',
  score: 8,
  notes: 'Good boy',
  ...overrides
});

const lines = (csv: string) => csv.slice(BOM.length).split('\r\n');

describe('toCsv', () => {
  it('always emits a header row, even with no data', () => {
    expect(toCsv([])).toBe(`${BOM}${HEADER}`);
  });

  it('starts with a UTF-8 BOM', () => {
    expect(toCsv([row()]).startsWith(BOM)).toBe(true);
  });

  it('emits exactly two lines for a single row', () => {
    expect(lines(toCsv([row()]))).toEqual([
      HEADER,
      '2026-02-14,Rex,Sit,completed,8,Good boy'
    ]);
  });

  it('separates rows with CRLF and does not append a trailing newline', () => {
    const csv = toCsv([row(), row({ date: '2026-02-15' })]);
    expect(csv.endsWith('\r\n')).toBe(false);
    expect(lines(csv)).toHaveLength(3);
  });

  it('renders an absent score as an empty cell', () => {
    expect(lines(toCsv([row({ status: 'skipped', score: undefined })]))[1])
      .toBe('2026-02-14,Rex,Sit,skipped,,Good boy');
  });

  it('renders absent notes as an empty cell', () => {
    expect(lines(toCsv([row({ notes: undefined })]))[1])
      .toBe('2026-02-14,Rex,Sit,completed,8,');
  });

  describe('escaping', () => {
    it('quotes a value containing the delimiter', () => {
      expect(lines(toCsv([row({ notes: 'sat, then stayed' })]))[1])
        .toContain('"sat, then stayed"');
    });

    it('quotes a value containing a double quote and doubles the inner quote', () => {
      expect(lines(toCsv([row({ notes: 'He said "sit"' })]))[1])
        .toContain('"He said ""sit"""');
    });

    it('quotes a value containing a newline', () => {
      const csv = toCsv([row({ notes: 'line one\nline two' })]);
      expect(csv).toContain('"line one\nline two"');
    });

    it('quotes a value containing a carriage return newline', () => {
      const csv = toCsv([row({ notes: 'line one\r\nline two' })]);
      expect(csv).toContain('"line one\r\nline two"');
    });

    it('quotes a value with leading or trailing whitespace', () => {
      expect(lines(toCsv([row({ notes: '  padded  ' })]))[1])
        .toContain('"  padded  "');
    });

    it('preserves non-ASCII characters verbatim', () => {
      expect(lines(toCsv([row({ dog: 'Rüdiger', notes: 'Café 🐕' })]))[1])
        .toBe('2026-02-14,Rüdiger,Sit,completed,8,Café 🐕');
    });
  });

  describe('formula injection guard', () => {
    it.each(['=', '+', '-', '@', '\t', '\r'])('prefixes a value starting with %j with a single quote', (char) => {
      const csv = toCsv([row({ notes: `${char}HYPERLINK("evil")` })]);
      expect(csv).toContain(`'${char}HYPERLINK`);
    });

    it('guards the dog and training columns too', () => {
      expect(lines(toCsv([row({ dog: '=cmd', training: '@evil', notes: undefined })]))[1])
        .toBe(`2026-02-14,'=cmd,'@evil,completed,8,`);
    });

    it('leaves values that merely contain a formula character alone', () => {
      expect(lines(toCsv([row({ notes: 'a=b' })]))[1]).toContain('a=b');
      expect(lines(toCsv([row({ notes: 'a=b' })]))[1]).not.toContain("'a=b");
    });
  });
});

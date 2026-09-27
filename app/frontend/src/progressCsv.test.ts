import { describe, expect, it } from 'vitest';
import { buildProgressCsv } from './progressCsv';

describe('buildProgressCsv', () => {
  it('exports session details as UTF-8 CSV with headers and escaped cells', () => {
    const csv = buildProgressCsv(
      [
        {
          date: '2026-02-14',
          status: 'completed',
          score: 9,
          notes: 'Worked well, said "stay"',
        },
        { date: '2026-02-15', status: 'skipped' },
      ],
      'Buddy',
      'Sit',
    );

    expect(csv).toBe(
      '\uFEFF"Date","Dog","Training","Status","Score","Notes"\r\n' +
        '"2026-02-14","Buddy","Sit","completed","9","Worked well, said ""stay"""\r\n' +
        '"2026-02-15","Buddy","Sit","skipped","",""',
    );
  });

  it('neutralizes formula-like text in user-controlled fields', () => {
    const csv = buildProgressCsv(
      [{ date: '2026-02-14', status: 'completed', notes: '=IMPORTXML("url")' }],
      'Buddy',
      'Sit',
    );

    expect(csv).toContain('"\'=IMPORTXML(""url"")"');
  });

  it('returns a header-only CSV when there are no matching sessions', () => {
    expect(buildProgressCsv([], 'Buddy', 'Sit')).toBe(
      '\uFEFF"Date","Dog","Training","Status","Score","Notes"',
    );
  });
});

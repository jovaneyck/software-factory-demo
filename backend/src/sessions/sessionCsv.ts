export type ExportRow = {
  date: string;
  dog: string;
  training: string;
  status: string;
  score?: number;
  notes?: string;
};

export const CSV_HEADER = 'date,dog,training,status,score,notes';

const BOM = '﻿';
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

const guardAgainstFormulaInjection = (value: string): string =>
  FORMULA_TRIGGERS.includes(value.charAt(0)) ? `'${value}` : value;

const needsQuoting = (value: string): boolean =>
  /[",\r\n]/.test(value) || value !== value.trim();

const quote = (value: string): string => `"${value.replace(/"/g, '""')}"`;

const field = (value: string | undefined): string => {
  const guarded = guardAgainstFormulaInjection(value ?? '');
  return needsQuoting(guarded) ? quote(guarded) : guarded;
};

const systemField = (value: string | number | undefined): string =>
  value === undefined ? '' : String(value);

const line = (row: ExportRow): string => [
  field(row.date),
  field(row.dog),
  field(row.training),
  systemField(row.status),
  systemField(row.score),
  field(row.notes)
].join(',');

export function toCsv(rows: ExportRow[]): string {
  return BOM + [CSV_HEADER, ...rows.map(line)].join('\r\n');
}

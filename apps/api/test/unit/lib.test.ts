import { describe, expect, it } from 'vitest';
import { centsToCsv, toCsv } from '../../src/lib/csv';
import { addDays, addMonths, endOfMonth, todayInTz, zonedRange, zonedStartOfDay } from '../../src/lib/dates';

describe('datas com fuso horário', () => {
  it('converte início do dia em São Paulo para UTC', () => {
    expect(zonedStartOfDay('2026-03-15', 'America/Sao_Paulo').toISOString()).toBe('2026-03-15T03:00:00.000Z');
    expect(zonedStartOfDay('2026-03-15', 'UTC').toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('considera horário de verão (Nova York)', () => {
    expect(zonedStartOfDay('2026-01-15', 'America/New_York').toISOString()).toBe('2026-01-15T05:00:00.000Z');
    expect(zonedStartOfDay('2026-07-15', 'America/New_York').toISOString()).toBe('2026-07-15T04:00:00.000Z');
  });

  it('gera intervalos e aritmética de datas', () => {
    expect(zonedRange('2026-01-01', '2026-01-31', 'UTC')).toEqual({
      gte: new Date('2026-01-01T00:00:00.000Z'),
      lt: new Date('2026-02-01T00:00:00.000Z'),
    });
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(todayInTz('America/Sao_Paulo', new Date('2026-05-01T02:00:00Z'))).toBe('2026-04-30');
  });
});

describe('CSV', () => {
  it('escapa separadores, aspas e neutraliza fórmulas', () => {
    const csv = toCsv(
      [{ a: 'texto; com separador', b: 'aspas "x"', c: '=HYPERLINK("x")', d: -5 }],
      [
        { header: 'A', value: (r) => r.a },
        { header: 'B', value: (r) => r.b },
        { header: 'C', value: (r) => r.c },
        { header: 'D', value: (r) => r.d },
      ],
    );
    const line = csv.split('\r\n')[1];
    expect(line).toBe('"texto; com separador";"aspas ""x""";"\'=HYPERLINK(""x"")";-5');
  });

  it('formata centavos no padrão pt-BR', () => {
    expect(centsToCsv(123456)).toBe('1234,56');
    expect(centsToCsv(-5)).toBe('-0,05');
  });
});

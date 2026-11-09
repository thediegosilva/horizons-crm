import { describe, expect, it } from 'vitest';
import { buildQuery } from './api';
import { formatCents, formatDateOnly, formatPercent, initials, shiftDate } from './format';

describe('formatação', () => {
  it('formata moeda em reais a partir de centavos', () => {
    expect(formatCents(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
  });
  it('formata datas de calendário sem deslocamento de fuso', () => {
    expect(formatDateOnly('2026-01-01')).toBe('01/01/2026');
    expect(formatDateOnly(null)).toBe('—');
  });
  it('formata percentuais e iniciais', () => {
    expect(formatPercent(12.345)).toBe('12,3%');
    expect(formatPercent(null)).toBe('—');
    expect(initials('Helena Duarte Lima')).toBe('HL');
  });
  it('desloca datas', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('monta query string ignorando vazios', () => {
    expect(buildQuery({ page: 2, search: '', status: undefined, active: false })).toBe('?page=2&active=false');
  });
});

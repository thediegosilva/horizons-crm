export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/**
 * Gera CSV compatível com Excel pt-BR (separador `;`, BOM UTF-8).
 * Protege contra CSV/Formula Injection prefixando células que começam com = + - @.
 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const escape = (raw: string | number | null | undefined) => {
    if (raw === null || raw === undefined) return '';
    let value = String(raw);
    if (typeof raw === 'string' && /^[=+\-@\t\r]/.test(value)) value = `'${value}`;
    if (/[";\n\r]/.test(value)) value = `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  const lines = [columns.map((c) => escape(c.header)).join(';')];
  for (const row of rows) lines.push(columns.map((c) => escape(c.value(row))).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Valor em centavos → "1234,56" (formato numérico do Excel pt-BR). */
export function centsToCsv(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

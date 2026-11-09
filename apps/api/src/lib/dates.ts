/**
 * Utilitários de data.
 * - Datas "de calendário" (vencimento, pagamento) usam o formato AAAA-MM-DD e colunas DATE.
 * - Instantes (created_at etc.) são UTC; agregações por dia/mês usam o fuso da aplicação.
 */

const DAY_MS = 86_400_000;

export function dateOnlyToUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return toDateOnly(new Date(dateOnlyToUtc(date).getTime() + days * DAY_MS));
}

export function todayInTz(timeZone: string, now = new Date()): string {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instante UTC correspondente a 00:00 da data informada no fuso `timeZone`. */
export function zonedStartOfDay(date: string, timeZone: string): Date {
  const guess = dateOnlyToUtc(date);
  const first = new Date(guess.getTime() - tzOffsetMs(guess, timeZone));
  // Segunda passada corrige eventuais transições de horário de verão.
  return new Date(guess.getTime() - tzOffsetMs(first, timeZone));
}

/** Intervalo [início, fim) em instantes UTC cobrindo os dias `from` a `to` (inclusive) no fuso. */
export function zonedRange(from: string, to: string, timeZone: string): { gte: Date; lt: Date } {
  return { gte: zonedStartOfDay(from, timeZone), lt: zonedStartOfDay(addDays(to, 1), timeZone) };
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(date: string, months: number): string {
  const d = dateOnlyToUtc(startOfMonth(date));
  d.setUTCMonth(d.getUTCMonth() + months);
  return toDateOnly(d);
}

export function endOfMonth(date: string): string {
  return addDays(addMonths(date, 1), -1);
}

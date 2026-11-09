export { formatCents, formatDocument, formatOrderNumber } from '@horizons/shared';

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const compactFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const numberFmt = new Intl.NumberFormat('pt-BR');
const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
const monthYearFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });

/** Data de calendário (AAAA-MM-DD) → DD/MM/AAAA, sem conversão de fuso. */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return dateFmt.format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return dateTimeFmt.format(new Date(value));
}

export function formatNumber(value: number): string {
  return numberFmt.format(value);
}

export function formatCompactCents(cents: number): string {
  return `R$ ${compactFmt.format(cents / 100)}`;
}

/** Rótulo curto para eixos de gráfico: 340000_00 → "340 mil". */
export function formatAxisCents(cents: number): string {
  return compactFmt.format(cents / 100);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}

/** "2026-03" → "mar" / "mar/26" */
export function formatMonth(period: string, withYear = false): string {
  const d = new Date(`${period.slice(0, 7)}-01T00:00:00Z`);
  return (withYear ? monthYearFmt : monthFmt).format(d).replace('.', '');
}

export function formatPeriod(period: string): string {
  return period.length === 7 ? formatMonth(period, true) : formatDateOnly(period);
}

export function relativeTime(value: string | Date): string {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  if (diff < 86400 * 30) return rtf.format(-Math.floor(diff / 86400), 'day');
  return formatDate(value);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

/** Data local de hoje em AAAA-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

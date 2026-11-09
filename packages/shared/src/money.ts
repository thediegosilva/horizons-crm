/** Todos os valores monetários trafegam e são persistidos em centavos (inteiros). */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

/** Converte um valor em reais (ex.: 19.9) para centavos, sem erro de ponto flutuante. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

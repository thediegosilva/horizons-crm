'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { inputClass } from './input';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MAX_CENTS = 1_000_000_000;

/**
 * Campo monetário em reais que trabalha internamente em centavos.
 * A digitação desloca os dígitos (estilo caixa registradora): "1" "2" "3" → R$ 1,23.
 */
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  { value: number; onChange: (cents: number) => void; id?: string; className?: string; disabled?: boolean } & Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange'
  >
>(({ value, onChange, className, ...props }, ref) => {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <input
        ref={ref}
        inputMode="numeric"
        className={cn(inputClass, 'pl-9 text-right tabular', className)}
        value={fmt.format((value || 0) / 100)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
          const cents = Math.min(Number(digits || '0'), MAX_CENTS);
          onChange(cents);
        }}
        onFocus={(e) => e.target.select()}
        {...props}
      />
    </div>
  );
});
MoneyInput.displayName = 'MoneyInput';

'use client';

import { useQuery } from '@tanstack/react-query';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { inputClass } from './input';

export interface ComboOption {
  value: string;
  label: string;
  description?: string;
  aside?: string;
  disabled?: boolean;
}

interface AsyncComboboxProps {
  id?: string;
  /** Nome acessível do campo (combobox não herda o nome do texto interno). */
  label: string;
  queryKey: string;
  fetchOptions: (search: string) => Promise<ComboOption[]>;
  value?: ComboOption | null;
  onChange: (option: ComboOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  invalid?: boolean;
  className?: string;
  /** Mantém o campo vazio após a seleção (útil para "adicionar item"). */
  resetOnSelect?: boolean;
}

/** Combobox acessível (padrão ARIA listbox) com busca no servidor. */
export function AsyncCombobox({
  id,
  label,
  queryKey,
  fetchOptions,
  value,
  onChange,
  placeholder = 'Selecione...',
  searchPlaceholder = 'Pesquisar...',
  emptyText = 'Nenhum resultado.',
  invalid,
  className,
  resetOnSelect,
}: AsyncComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listId = React.useId();

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data = [], isFetching } = useQuery({
    queryKey: ['combobox', queryKey, debounced],
    queryFn: () => fetchOptions(debounced),
    enabled: open,
    staleTime: 15_000,
  });

  function select(option: ComboOption) {
    if (option.disabled) return;
    onChange(option);
    setOpen(false);
    setSearch('');
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, data.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = data[active];
      if (opt) select(opt);
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid || undefined}
          className={cn(inputClass, 'items-center justify-between text-left', className)}
        >
          <span className={cn('truncate', (!value || resetOnSelect) && 'text-muted-foreground/70')}>
            {value && !resetOnSelect ? value.label : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-lg data-[state=open]:animate-scale-in"
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              aria-label={searchPlaceholder}
              aria-activedescendant={data[active] ? `${listId}-${active}` : undefined}
              aria-controls={listId}
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
            {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
          </div>
          <ul id={listId} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto p-1">
            {data.length === 0 && !isFetching && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</li>}
            {data.map((opt, i) => (
              <li
                key={opt.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={value?.value === opt.value}
                aria-disabled={opt.disabled || undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => select(opt)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm',
                  i === active && 'bg-muted',
                  opt.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <Check className={cn('size-4 shrink-0 text-primary', value?.value === opt.value && !resetOnSelect ? 'opacity-100' : 'opacity-0')} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{opt.label}</span>
                  {opt.description && <span className="block truncate text-xs text-muted-foreground">{opt.description}</span>}
                </span>
                {opt.aside && <span className="shrink-0 text-xs font-medium text-muted-foreground tabular">{opt.aside}</span>}
              </li>
            ))}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

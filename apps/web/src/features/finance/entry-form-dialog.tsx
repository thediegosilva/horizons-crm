'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { financialEntrySchema, type FinancialEntryData, type FinancialEntryInput } from '@horizons/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { errorProps, Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { api } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { handleFormError } from '@/lib/forms';
import type { FinancialEntry } from '@/lib/types';

function toForm(e?: FinancialEntry, type: 'INCOME' | 'EXPENSE' = 'EXPENSE'): FinancialEntryInput {
  return {
    type: e?.type ?? type,
    description: e?.description ?? '',
    category: e?.category ?? '',
    amountCents: e?.amountCents ?? 0,
    dueDate: e?.dueDate ?? todayIso(),
    status: e?.status === 'PAID' ? 'PAID' : 'PENDING',
    paidAt: e?.paidAt ?? null,
    notes: e?.notes ?? '',
  };
}

export function EntryFormDialog({
  open,
  onOpenChange,
  entry,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry?: FinancialEntry;
  defaultType?: 'INCOME' | 'EXPENSE';
}) {
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm<FinancialEntryInput, unknown, FinancialEntryData>({
    resolver: zodResolver(financialEntrySchema),
    defaultValues: toForm(entry, defaultType),
  });
  const status = useWatch({ control, name: 'status' });
  const categories = useQuery({
    queryKey: ['finance', 'categories'],
    queryFn: () => api<{ data: string[] }>('/finance/categories').then((r) => r.data),
    enabled: open,
  });

  React.useEffect(() => {
    if (open) reset(toForm(entry, defaultType));
  }, [open, entry, defaultType, reset]);

  const mutation = useMutation({
    mutationFn: (data: FinancialEntryData) =>
      entry ? api(`/finance/entries/${entry.id}`, { method: 'PUT', body: data }) : api('/finance/entries', { method: 'POST', body: data }),
    onSuccess: () => {
      toast.success(entry ? 'Lançamento atualizado.' : 'Lançamento registrado.');
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onOpenChange(false);
    },
    onError: (err) => handleFormError(err, setError),
  });
  const e = (k: keyof FinancialEntryInput) => errors[k]?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={entry ? 'Editar lançamento' : 'Novo lançamento'} description="Receitas e despesas avulsas (não vinculadas a pedidos).">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <Field label="Tipo" htmlFor="type" required>
              <Select id="type" {...register('type')}>
                <option value="INCOME">Receita</option>
                <option value="EXPENSE">Despesa</option>
              </Select>
            </Field>
            <Field label="Valor" htmlFor="amountCents" required error={e('amountCents')}>
              <Controller control={control} name="amountCents" render={({ field }) => (
                <MoneyInput id="amountCents" value={field.value} onChange={field.onChange} {...errorProps('amountCents', e('amountCents'))} />
              )} />
            </Field>
            <Field label="Descrição" htmlFor="description" required error={e('description')} className="sm:col-span-2">
              <Input id="description" autoFocus {...register('description')} {...errorProps('description', e('description'))} />
            </Field>
            <Field label="Categoria" htmlFor="category" required error={e('category')}>
              <Input id="category" list="finance-categories" {...register('category')} {...errorProps('category', e('category'))} />
              <datalist id="finance-categories">{categories.data?.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Vencimento" htmlFor="dueDate" required error={e('dueDate')}>
              <Input id="dueDate" type="date" {...register('dueDate')} {...errorProps('dueDate', e('dueDate'))} />
            </Field>
            <Field label="Situação" htmlFor="status">
              <Select id="status" {...register('status')}>
                <option value="PENDING">Pendente</option>
                <option value="PAID">Pago</option>
              </Select>
            </Field>
            {status === 'PAID' && (
              <Field label="Data do pagamento" htmlFor="paidAt" error={e('paidAt')} hint="Se vazio, usa o vencimento.">
                <Input id="paidAt" type="date" {...register('paidAt', { setValueAs: (v: string) => v || null })} />
              </Field>
            )}
            <Field label="Observações" htmlFor="notes" className="sm:col-span-2">
              <Textarea id="notes" rows={2} {...register('notes')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending}>{entry ? 'Salvar' : 'Registrar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

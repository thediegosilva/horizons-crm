'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CUSTOMER_TYPE_LABELS, CUSTOMER_TYPES, customerSchema, formatDocument, type CustomerData, type CustomerInput } from '@horizons/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { errorProps, Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import { handleFormError } from '@/lib/forms';
import type { Customer, Single } from '@/lib/types';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

function toForm(c?: Customer): CustomerInput {
  return {
    type: c?.type ?? 'INDIVIDUAL',
    name: c?.name ?? '',
    email: c?.email ?? '',
    phone: c?.phone ?? '',
    document: c?.document ? formatDocument(c.document) : '',
    zipCode: c?.zipCode ?? '',
    street: c?.street ?? '',
    number: c?.number ?? '',
    complement: c?.complement ?? '',
    district: c?.district ?? '',
    city: c?.city ?? '',
    state: c?.state ?? '',
    notes: c?.notes ?? '',
  };
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer;
  onSaved?: (c: Customer) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<CustomerInput, unknown, CustomerData>({
    resolver: zodResolver(customerSchema),
    defaultValues: toForm(customer),
  });
  const { register, control, handleSubmit, reset, setError, formState: { errors } } = form;
  const type = useWatch({ control, name: 'type' });

  React.useEffect(() => {
    if (open) reset(toForm(customer));
  }, [open, customer, reset]);

  const mutation = useMutation({
    mutationFn: (data: CustomerData) =>
      customer
        ? api<Single<Customer>>(`/customers/${customer.id}`, { method: 'PUT', body: data })
        : api<Single<Customer>>('/customers', { method: 'POST', body: data }),
    onSuccess: (res) => {
      toast.success(customer ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', res.data.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onOpenChange(false);
      onSaved?.(res.data);
    },
    onError: (err) => handleFormError(err, setError),
  });

  const e = (k: keyof CustomerInput) => errors[k]?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={customer ? 'Editar cliente' : 'Novo cliente'}
        description="Campos marcados com * são obrigatórios."
      >
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-6">
            <Field label="Tipo" htmlFor="type" required className="sm:col-span-2">
              <Select id="type" {...register('type')}>
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>{CUSTOMER_TYPE_LABELS[t]}</option>
                ))}
              </Select>
            </Field>
            <Field label={type === 'COMPANY' ? 'Razão social' : 'Nome completo'} htmlFor="name" required error={e('name')} className="sm:col-span-4">
              <Input id="name" autoFocus {...register('name')} {...errorProps('name', e('name'))} />
            </Field>
            <Field label={type === 'COMPANY' ? 'CNPJ' : 'CPF'} htmlFor="document" error={e('document')} className="sm:col-span-2">
              <Input id="document" inputMode="numeric" placeholder={type === 'COMPANY' ? '00.000.000/0000-00' : '000.000.000-00'} {...register('document')} {...errorProps('document', e('document'))} />
            </Field>
            <Field label="E-mail" htmlFor="email" error={e('email')} className="sm:col-span-2">
              <Input id="email" type="email" {...register('email')} {...errorProps('email', e('email'))} />
            </Field>
            <Field label="Telefone" htmlFor="phone" error={e('phone')} className="sm:col-span-2">
              <Input id="phone" type="tel" placeholder="(00) 00000-0000" {...register('phone')} {...errorProps('phone', e('phone'))} />
            </Field>

            <p className="pt-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase sm:col-span-6">Endereço</p>
            <Field label="CEP" htmlFor="zipCode" error={e('zipCode')} className="sm:col-span-2">
              <Input id="zipCode" inputMode="numeric" placeholder="00000-000" {...register('zipCode')} {...errorProps('zipCode', e('zipCode'))} />
            </Field>
            <Field label="Logradouro" htmlFor="street" error={e('street')} className="sm:col-span-3">
              <Input id="street" {...register('street')} />
            </Field>
            <Field label="Número" htmlFor="number" error={e('number')} className="sm:col-span-1">
              <Input id="number" {...register('number')} />
            </Field>
            <Field label="Complemento" htmlFor="complement" className="sm:col-span-2">
              <Input id="complement" {...register('complement')} />
            </Field>
            <Field label="Bairro" htmlFor="district" className="sm:col-span-2">
              <Input id="district" {...register('district')} />
            </Field>
            <Field label="Cidade" htmlFor="city" className="sm:col-span-1">
              <Input id="city" {...register('city')} />
            </Field>
            <Field label="UF" htmlFor="state" error={e('state')} className="sm:col-span-1">
              <Select id="state" {...register('state')}>
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </Select>
            </Field>
            <Field label="Observações" htmlFor="notes" error={e('notes')} className="sm:col-span-6">
              <Textarea id="notes" rows={3} {...register('notes')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending}>{customer ? 'Salvar alterações' : 'Cadastrar cliente'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

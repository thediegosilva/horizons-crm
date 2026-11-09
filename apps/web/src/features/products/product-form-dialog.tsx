'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES, productSchema, type ProductData, type ProductInput } from '@horizons/shared';
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
import { handleFormError } from '@/lib/forms';
import type { Product, Single } from '@/lib/types';

function toForm(p?: Product): ProductInput {
  return {
    type: p?.type ?? 'PRODUCT',
    name: p?.name ?? '',
    sku: p?.sku ?? '',
    description: p?.description ?? '',
    category: p?.category ?? '',
    priceCents: p?.priceCents ?? 0,
    stock: p?.stock ?? 0,
    minStock: p?.minStock ?? 0,
    active: p?.active ?? true,
  };
}

export function ProductFormDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (o: boolean) => void; product?: Product }) {
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm<ProductInput, unknown, ProductData>({
    resolver: zodResolver(productSchema),
    defaultValues: toForm(product),
  });
  const type = useWatch({ control, name: 'type' });
  const categories = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => api<{ data: string[] }>('/products/categories').then((r) => r.data),
    enabled: open,
  });

  React.useEffect(() => {
    if (open) reset(toForm(product));
  }, [open, product, reset]);

  const mutation = useMutation({
    mutationFn: (data: ProductData) =>
      product
        ? api<Single<Product>>(`/products/${product.id}`, { method: 'PUT', body: data })
        : api<Single<Product>>('/products', { method: 'POST', body: data }),
    onSuccess: () => {
      toast.success(product ? 'Produto atualizado.' : 'Produto cadastrado.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onOpenChange(false);
    },
    onError: (err) => handleFormError(err, setError),
  });

  const e = (k: keyof ProductInput) => errors[k]?.message;
  const numberField = { setValueAs: (v: string) => (v === '' ? 0 : Number(v)) };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={product ? 'Editar produto' : 'Novo produto ou serviço'} description="Campos marcados com * são obrigatórios.">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-6">
            <Field label="Tipo" htmlFor="type" required className="sm:col-span-2">
              <Select id="type" {...register('type')}>
                {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{PRODUCT_TYPE_LABELS[t]}</option>)}
              </Select>
            </Field>
            <Field label="Nome" htmlFor="name" required error={e('name')} className="sm:col-span-4">
              <Input id="name" autoFocus {...register('name')} {...errorProps('name', e('name'))} />
            </Field>
            <Field label="SKU" htmlFor="sku" required error={e('sku')} hint="Código único. Ex.: CAD-001" className="sm:col-span-2">
              <Input id="sku" className="font-mono uppercase" {...register('sku')} {...errorProps('sku', e('sku'))} />
            </Field>
            <Field label="Categoria" htmlFor="category" required error={e('category')} className="sm:col-span-2">
              <Input id="category" list="category-options" {...register('category')} {...errorProps('category', e('category'))} />
              <datalist id="category-options">
                {categories.data?.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Preço" htmlFor="priceCents" required error={e('priceCents')} className="sm:col-span-2">
              <Controller
                control={control}
                name="priceCents"
                render={({ field }) => <MoneyInput id="priceCents" value={field.value} onChange={field.onChange} onBlur={field.onBlur} {...errorProps('priceCents', e('priceCents'))} />}
              />
            </Field>
            {type === 'PRODUCT' ? (
              <>
                <Field label="Estoque atual" htmlFor="stock" error={e('stock')} className="sm:col-span-2">
                  <Input id="stock" type="number" min={0} step={1} className="tabular" {...register('stock', numberField)} {...errorProps('stock', e('stock'))} />
                </Field>
                <Field label="Estoque mínimo" htmlFor="minStock" error={e('minStock')} hint="Gera alerta quando atingido." className="sm:col-span-2">
                  <Input id="minStock" type="number" min={0} step={1} className="tabular" {...register('minStock', numberField)} {...errorProps('minStock', e('minStock'))} />
                </Field>
              </>
            ) : (
              <p className="self-end rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground sm:col-span-4">
                Serviços não possuem controle de estoque.
              </p>
            )}
            <Field label="Disponibilidade" htmlFor="active" className="sm:col-span-2">
              <Controller
                control={control}
                name="active"
                render={({ field }) => (
                  <Select id="active" value={field.value ? 'true' : 'false'} onChange={(ev) => field.onChange(ev.target.value === 'true')}>
                    <option value="true">Ativo (disponível)</option>
                    <option value="false">Inativo (indisponível)</option>
                  </Select>
                )}
              />
            </Field>
            <Field label="Descrição" htmlFor="description" error={e('description')} className="sm:col-span-6">
              <Textarea id="description" rows={3} {...register('description')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending}>{product ? 'Salvar alterações' : 'Cadastrar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

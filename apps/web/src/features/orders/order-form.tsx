'use client';

import { calculateOrderTotals, formatDocument, orderSchema, OrderCalculationError, PRODUCT_TYPE_LABELS } from '@horizons/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Package, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AsyncCombobox, type ComboOption } from '@/components/ui/combobox';
import { EmptyState } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formatCents } from '@/lib/format';
import type { Customer, Order, Paginated, Product, Single } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ItemRow {
  productId: string;
  name: string;
  sku: string;
  type: Product['type'];
  stock: number | null;
  unitPriceCents: number;
  quantity: number;
  discountCents: number;
}

async function searchCustomers(search: string): Promise<ComboOption[]> {
  const res = await api<Paginated<Customer>>('/customers', { query: { search, pageSize: 20, sort: 'name', order: 'asc' } });
  return res.data.map((c) => ({
    value: c.id,
    label: c.name,
    description: [c.document ? formatDocument(c.document) : null, c.email].filter(Boolean).join(' · ') || undefined,
  }));
}

export function OrderForm({ order, initialCustomer }: { order?: Order; initialCustomer?: ComboOption | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const productCache = React.useRef(new Map<string, Product>());

  const [customer, setCustomer] = React.useState<ComboOption | null>(
    order ? { value: order.customer.id, label: order.customer.name } : (initialCustomer ?? null),
  );
  const [items, setItems] = React.useState<ItemRow[]>(
    order?.items.map((i) => ({
      productId: i.productId, name: i.productName, sku: i.productSku, type: 'PRODUCT', stock: null,
      unitPriceCents: i.unitPriceCents, quantity: i.quantity, discountCents: i.discountCents,
    })) ?? [],
  );
  const [discountCents, setDiscountCents] = React.useState(order?.discountCents ?? 0);
  const [notes, setNotes] = React.useState(order?.notes ?? '');
  const [errors, setErrors] = React.useState<string[]>([]);

  async function searchProducts(search: string): Promise<ComboOption[]> {
    const res = await api<Paginated<Product>>('/products', { query: { search, active: 'true', pageSize: 20, sort: 'name', order: 'asc' } });
    return res.data.map((p) => {
      productCache.current.set(p.id, p);
      const inOrder = items.some((i) => i.productId === p.id);
      return {
        value: p.id,
        label: p.name,
        description: `${p.sku} · ${PRODUCT_TYPE_LABELS[p.type]}${p.type === 'PRODUCT' ? ` · ${p.stock} em estoque` : ''}${inOrder ? ' · já adicionado' : ''}`,
        aside: formatCents(p.priceCents),
        disabled: inOrder,
      };
    });
  }

  function addProduct(opt: ComboOption) {
    const p = productCache.current.get(opt.value);
    if (!p) return;
    setItems((prev) => [
      ...prev,
      { productId: p.id, name: p.name, sku: p.sku, type: p.type, stock: p.type === 'PRODUCT' ? p.stock : null, unitPriceCents: p.priceCents, quantity: 1, discountCents: 0 },
    ]);
  }

  const update = (index: number, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  // Pré-visualização dos totais com a mesma regra usada pelo servidor.
  let totals: ReturnType<typeof calculateOrderTotals> | null = null;
  let calcError: string | null = null;
  if (items.length) {
    try {
      totals = calculateOrderTotals(items, discountCents);
    } catch (err) {
      calcError = err instanceof OrderCalculationError ? err.message : 'Valores inválidos.';
    }
  }

  const mutation = useMutation({
    mutationFn: (body: unknown) =>
      order
        ? api<Single<Order>>(`/orders/${order.id}`, { method: 'PUT', body })
        : api<Single<Order>>('/orders', { method: 'POST', body }),
    onSuccess: (res) => {
      toast.success(order ? 'Pedido atualizado.' : `Pedido ${res.data.code} criado.`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', res.data.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      router.push(`/orders/${res.data.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setErrors(Object.values(err.fieldErrors).flat().filter(Boolean) as string[]);
      }
      toast.error(errorMessage(err));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      customerId: customer?.value ?? '',
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, discountCents: i.discountCents })),
      discountCents,
      notes,
    };
    const parsed = orderSchema.safeParse(body);
    const messages = [
      ...(!customer ? ['Selecione um cliente.'] : []),
      ...(parsed.success ? [] : parsed.error.issues.filter((i) => i.path[0] !== 'customerId').map((i) => i.message)),
      ...(calcError ? [calcError] : []),
    ];
    setErrors([...new Set(messages)]);
    if (messages.length) return;
    mutation.mutate(body);
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Cliente</CardTitle>
              <CardDescription>Quem está comprando</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <AsyncCombobox
              id="customer"
              label="Cliente"
              queryKey="customers"
              fetchOptions={searchCustomers}
              value={customer}
              onChange={setCustomer}
              placeholder="Selecione o cliente"
              searchPlaceholder="Pesquisar por nome, CPF/CNPJ ou e-mail"
              emptyText="Nenhum cliente encontrado."
              invalid={!customer && errors.length > 0}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Itens do pedido</CardTitle>
              <CardDescription>Os preços vêm do cadastro do produto e são registrados no pedido.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <AsyncCombobox
              label="Adicionar produto ou serviço"
              queryKey={`products-${items.map((i) => i.productId).join(',')}`}
              fetchOptions={searchProducts}
              onChange={addProduct}
              resetOnSelect
              placeholder="+ Adicionar produto ou serviço"
              searchPlaceholder="Pesquisar por nome ou SKU"
              emptyText="Nenhum produto ativo encontrado."
            />
            {items.length === 0 ? (
              <EmptyState icon={Package} title="Nenhum item adicionado" description="Use o campo acima para adicionar produtos ou serviços." className="py-8" />
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {items.map((item, index) => {
                  const line = totals?.lines[index];
                  const overStock = item.stock !== null && item.quantity > item.stock;
                  return (
                    <li key={item.productId} className="grid grid-cols-2 items-end gap-3 p-3 sm:grid-cols-[1fr_88px_140px_120px_36px]">
                      <div className="col-span-2 min-w-0 sm:col-span-1 sm:self-center">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{item.sku}</span> · {formatCents(item.unitPriceCents)} un.
                        </p>
                        {overStock && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-warning">
                            <AlertTriangle className="size-3" /> Apenas {item.stock} em estoque
                          </p>
                        )}
                      </div>
                      <Field label="Qtd." htmlFor={`qty-${index}`}>
                        <Input
                          id={`qty-${index}`}
                          type="number"
                          min={1}
                          step={1}
                          className="tabular"
                          value={item.quantity}
                          onChange={(e) => update(index, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                        />
                      </Field>
                      <Field label="Desconto" htmlFor={`disc-${index}`}>
                        <MoneyInput id={`disc-${index}`} value={item.discountCents} onChange={(v) => update(index, { discountCents: v })} />
                      </Field>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="h-9 text-sm leading-9 font-semibold tabular">{line ? formatCents(line.totalCents) : '—'}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${item.name}`} onClick={() => setItems((p) => p.filter((_, i) => i !== index))}>
                        <Trash2 />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Field label="Observações" htmlFor="notes">
              <Textarea id="notes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condições de entrega, combinados com o cliente..." />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="lg:sticky lg:top-24">
          <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal ({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
              <span className="tabular">{formatCents(totals?.subtotalCents ?? 0)}</span>
            </div>
            <Field label="Desconto no pedido" htmlFor="orderDiscount">
              <MoneyInput id="orderDiscount" value={discountCents} onChange={setDiscountCents} />
            </Field>
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-sm font-medium">Total</span>
              <span className="text-2xl font-semibold tracking-tight tabular">{formatCents(totals?.totalCents ?? 0)}</span>
            </div>
            {(errors.length > 0 || calcError) && (
              <ul role="alert" className="space-y-1 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
                {[...new Set([...(calcError ? [calcError] : []), ...errors])].map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}
            <Button type="submit" size="lg" className={cn('w-full')} loading={mutation.isPending}>
              {order ? 'Salvar alterações' : 'Criar pedido (orçamento)'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => router.back()}>Cancelar</Button>
            {!order && (
              <p className="text-xs text-muted-foreground">
                O pedido começa como <strong>orçamento</strong>. Ao avançar para &quot;Aguardando pagamento&quot;, o estoque é reservado e a conta a receber é gerada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

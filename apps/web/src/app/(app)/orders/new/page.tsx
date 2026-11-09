'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { OrderForm } from '@/features/orders/order-form';
import { api } from '@/lib/api';
import type { Customer, Single } from '@/lib/types';

function NewOrder() {
  const customerId = useSearchParams().get('customerId');
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api<Single<Customer>>(`/customers/${customerId}`).then((r) => r.data),
    enabled: !!customerId,
  });
  if (customerId && isLoading) return <Skeleton className="h-96 rounded-xl" />;
  return <OrderForm initialCustomer={customer ? { value: customer.id, label: customer.name } : null} />;
}

export default function NewOrderPage() {
  return (
    <>
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Pedidos
      </Link>
      <PageHeader title="Novo pedido" description="Monte o orçamento com cliente, itens e descontos." />
      <Suspense>
        <NewOrder />
      </Suspense>
    </>
  );
}

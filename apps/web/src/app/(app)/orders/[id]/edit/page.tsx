'use client';

import { isOrderEditable, ORDER_STATUS_LABELS } from '@horizons/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { OrderForm } from '@/features/orders/order-form';
import { api, errorMessage } from '@/lib/api';
import type { Order, Single } from '@/lib/types';

export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api<Single<Order>>(`/orders/${id}`).then((r) => r.data),
  });

  return (
    <>
      <Link href={`/orders/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar ao pedido
      </Link>
      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : error || !order ? (
        <Card><ErrorState message={errorMessage(error)} onRetry={() => refetch()} /></Card>
      ) : !isOrderEditable(order.status) ? (
        <Card>
          <EmptyState
            icon={Lock}
            title="Este pedido não pode ser editado"
            description={`Pedidos com status "${ORDER_STATUS_LABELS[order.status]}" estão bloqueados para alterações.`}
            action={<Button asChild variant="secondary"><Link href={`/orders/${id}`}>Ver pedido</Link></Button>}
          />
        </Card>
      ) : (
        <>
          <PageHeader title={`Editar ${order.code}`} description="Ao salvar, os preços são atualizados conforme o cadastro atual dos produtos." />
          <OrderForm order={order} />
        </>
      )}
    </>
  );
}

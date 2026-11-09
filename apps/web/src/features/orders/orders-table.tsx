'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OrderStatusBadge } from '@/components/status';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatCents, formatDateTime } from '@/lib/format';
import type { OrderSummary } from '@/lib/types';

export function OrdersTable({ orders, showCustomer = true }: { orders: OrderSummary[]; showCustomer?: boolean }) {
  const router = useRouter();
  return (
    <Table>
      <THead>
        <tr>
          <TH>Pedido</TH>
          {showCustomer && <TH>Cliente</TH>}
          <TH>Status</TH>
          <TH className="hidden md:table-cell text-right">Itens</TH>
          <TH className="hidden sm:table-cell">Criado em</TH>
          <TH className="text-right">Total</TH>
        </tr>
      </THead>
      <TBody>
        {orders.map((o) => (
          <TR key={o.id} className="cursor-pointer" onClick={() => router.push(`/orders/${o.id}`)}>
            <TD>
              <Link href={`/orders/${o.id}`} className="font-mono text-sm font-medium hover:text-primary" onClick={(e) => e.stopPropagation()}>
                {o.code}
              </Link>
            </TD>
            {showCustomer && <TD className="max-w-56 truncate">{o.customer.name}</TD>}
            <TD><OrderStatusBadge status={o.status} /></TD>
            <TD className="hidden text-right text-muted-foreground tabular md:table-cell">{o.itemsCount}</TD>
            <TD className="hidden text-muted-foreground sm:table-cell">{formatDateTime(o.createdAt)}</TD>
            <TD className="text-right font-semibold tabular">{formatCents(o.totalCents)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

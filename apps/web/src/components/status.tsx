import { FINANCIAL_STATUS_LABELS, ORDER_STATUS_LABELS, type FinancialStatus, type OrderStatus } from '@horizons/shared';
import { Badge, type BadgeTone } from '@/components/ui/badge';

export const ORDER_STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  QUOTE: 'neutral',
  AWAITING_PAYMENT: 'warning',
  PAID: 'info',
  PROCESSING: 'primary',
  COMPLETED: 'success',
  CANCELED: 'danger',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={ORDER_STATUS_TONES[status]} dot>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function FinancialStatusBadge({ status, overdue }: { status: FinancialStatus; overdue?: boolean }) {
  if (overdue) return <Badge tone="danger" dot>Vencido</Badge>;
  const tone: Record<FinancialStatus, BadgeTone> = { PENDING: 'warning', PAID: 'success', CANCELED: 'neutral' };
  return <Badge tone={tone[status]} dot>{FINANCIAL_STATUS_LABELS[status]}</Badge>;
}

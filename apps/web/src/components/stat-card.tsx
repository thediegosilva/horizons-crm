import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: React.ReactNode;
  change?: number | null;
  href?: string;
  tone?: 'default' | 'danger';
}

export function StatCard({ label, value, icon: Icon, hint, change, href, tone = 'default' }: StatCardProps) {
  const body = (
    <Card className={cn('group relative h-full overflow-hidden p-5 transition-shadow', href && 'hover:shadow-md')}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn('grid size-9 place-items-center rounded-lg', tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary')}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {change !== undefined && change !== null && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', change >= 0 ? 'text-success' : 'text-danger')}>
            {change >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {change >= 0 ? 'Alta' : 'Queda'} de {Math.abs(change).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          </span>
        )}
        {hint}
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

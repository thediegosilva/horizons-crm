'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface Series<T> {
  key: keyof T & string;
  label: string;
  color: string;
  format: (value: number) => string;
}

const axisProps = {
  tick: { fill: 'var(--muted-foreground)', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function ChartTooltip<T>({
  active,
  payload,
  label,
  series,
  labelFormat,
}: Partial<TooltipContentProps<number, string>> & { series: Series<T>[]; labelFormat: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-foreground">{labelFormat(String(label))}</p>
      {series.map((s) => {
        const item = payload.find((p) => p.dataKey === s.key);
        if (!item) return null;
        return (
          <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
              {s.label}
            </span>
            <span className="font-medium text-foreground tabular">{s.format(Number(item.value))}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Tabela oculta visualmente: garante acesso aos dados por leitores de tela. */
function DataTable<T>({ data, xKey, series, labelFormat, caption }: { data: T[]; xKey: keyof T; series: Series<T>[]; labelFormat: (l: string) => string; caption: string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th>Período</th>
          {series.map((s) => (
            <th key={s.key}>{s.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            <td>{labelFormat(String(row[xKey]))}</td>
            {series.map((s) => (
              <td key={s.key}>{s.format(Number(row[s.key]))}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Legend<T>({ series }: { series: Series<T>[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

interface ChartProps<T> {
  data: T[];
  xKey: keyof T & string;
  series: Series<T>[];
  tickFormat: (l: string) => string;
  labelFormat?: (l: string) => string;
  yFormat: (v: number) => string;
  caption: string;
  height?: number;
  className?: string;
}

export function TrendAreaChart<T>({ data, xKey, series, tickFormat, labelFormat = tickFormat, yFormat, caption, height = 260, className }: ChartProps<T>) {
  const id = React.useId().replace(/:/g, '');
  return (
    <div className={cn('w-full', className)}>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data as Record<string, unknown>[]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey={xKey as string} tickFormatter={tickFormat} {...axisProps} minTickGap={16} />
            <YAxis tickFormatter={yFormat} {...axisProps} width={64} />
            <Tooltip
              cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3', strokeWidth: 1 }}
              content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} series={series} labelFormat={labelFormat} />}
            />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key as string}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#${id}-${s.key})`}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <DataTable data={data} xKey={xKey} series={series} labelFormat={labelFormat} caption={caption} />
    </div>
  );
}

export function ColumnChart<T>({ data, xKey, series, tickFormat, labelFormat = tickFormat, yFormat, caption, height = 240, className }: ChartProps<T>) {
  return (
    <div className={cn('w-full', className)}>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data as Record<string, unknown>[]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey={xKey as string} tickFormatter={tickFormat} {...axisProps} minTickGap={8} />
            <YAxis tickFormatter={yFormat} {...axisProps} width={64} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
              content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} series={series} labelFormat={labelFormat} />}
            />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key as string} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable data={data} xKey={xKey} series={series} labelFormat={labelFormat} caption={caption} />
    </div>
  );
}

/** Barras horizontais com rótulos diretos (ranking). */
export function RankingBars({ rows, format }: { rows: { label: string; sublabel?: string; value: number }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => (
        <li key={i}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              <span className="mr-2 text-xs text-muted-foreground tabular">{i + 1}.</span>
              {r.label}
              {r.sublabel && <span className="ml-1.5 text-xs text-muted-foreground">{r.sublabel}</span>}
            </span>
            <span className="shrink-0 font-medium tabular">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-chart-1" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

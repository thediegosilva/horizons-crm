import { cn } from '@/lib/utils';

/** Marca Horizons: um sol nascendo sobre a linha do horizonte. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} role="img" aria-label="Horizons">
      <defs>
        <linearGradient id="hz-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f97316" />
          <stop offset="0.5" stopColor="#ec4899" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#hz-g)" />
      <path d="M8 20a8 8 0 0 1 16 0" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M6 23.5h20" stroke="white" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
      <path d="M16 8.5v2.5M9.5 11.2l1.7 1.7M22.5 11.2l-1.7 1.7" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

export function Logo({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {!collapsed && (
        <span className="leading-none">
          <span className="block text-[15px] font-bold tracking-tight">HORIZONS</span>
          <span className="block text-[10px] font-semibold tracking-[0.28em] text-muted-foreground">CRM</span>
        </span>
      )}
    </span>
  );
}

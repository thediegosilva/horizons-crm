import * as React from 'react';
import { cn } from '@/lib/utils';

/** Marca Horizons: o sol (cúpula) se pondo sobre as linhas do horizonte. */
export function LogoMark({ className }: { className?: string }) {
  const id = React.useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8 drop-shadow-[0_0_10px_rgb(34_211_238/0.35)]', className)} role="img" aria-label="Horizons">
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="4" y1="5" x2="28" y2="29">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="0.55" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path d="M5 18.5a11 11 0 0 1 22 0Z" fill={`url(#${id}-g)`} />
      <path d="M8.5 15h15" style={{ stroke: 'var(--background)' }} strokeWidth="1.6" opacity="0.55" />
      <g stroke={`url(#${id}-g)`} strokeWidth="2.3" strokeLinecap="round">
        <path d="M3.5 22h25" />
        <path d="M7 25.5h18" opacity="0.8" />
        <path d="M11 29h10" opacity="0.6" />
      </g>
    </svg>
  );
}

export function Logo({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {!collapsed && (
        <span className="text-[17px] leading-none font-semibold tracking-tight">
          Horizons <span className="font-medium text-primary">CRM</span>
        </span>
      )}
    </span>
  );
}

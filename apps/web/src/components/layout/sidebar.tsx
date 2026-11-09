'use client';

import { ROLE_LABELS } from '@horizons/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { NAV_SECTIONS } from './nav';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, user } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" onClick={onNavigate} className="rounded-md">
          <Logo />
        </Link>
      </div>

      <div className="mx-3 mb-2 rounded-lg border border-border bg-card px-3 py-2.5">
        <p className="truncate text-xs font-semibold">{user.organization.name}</p>
        <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</p>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((i) => !i.permission || can(i.permission));
          if (items.length === 0) return null;
          return (
            <div key={section.title}>
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary-soft text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {active && <span className="absolute top-1.5 bottom-1.5 -left-3 w-1 rounded-r-full bg-primary" aria-hidden />}
                        <item.icon className="size-[18px] shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="flex items-center justify-between border-t border-border px-5 py-4 text-[11px] text-muted-foreground">
        <span>Horizons CRM · v1.0</span>
        <a href="/api/docs/" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-primary">
          API docs ↗
        </a>
      </div>
    </div>
  );
}

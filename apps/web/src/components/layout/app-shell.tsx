'use client';

import { FlaskConical } from 'lucide-react';
import { AuthProvider, useCurrentUserQuery } from '@/hooks/use-auth';
import { LogoMark } from './logo';
import { Header } from './header';
import { SidebarNav } from './sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: user, isError, refetch } = useCurrentUserQuery();

  if (!user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4">
          <LogoMark className="size-10 animate-pulse" />
          {isError && (
            <button onClick={() => refetch()} className="text-sm text-primary hover:underline">
              Não foi possível carregar sua sessão. Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <AuthProvider user={user}>
      <div className="min-h-dvh">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-sidebar lg:block">
          <SidebarNav />
        </aside>
        <div className="lg:pl-64">
          {user.organization.isDemo && (
            <div className="flex items-center justify-center gap-2 bg-horizon px-4 py-1.5 text-center text-xs font-medium text-white">
              <FlaskConical className="size-3.5 shrink-0" aria-hidden />
              Ambiente de demonstração — todos os dados exibidos são fictícios.
            </div>
          )}
          <Header />
          <main id="conteudo" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}

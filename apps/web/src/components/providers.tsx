'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import * as React from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';

function handleUnauthorized(error: unknown) {
  if (error instanceof ApiError && error.status === 401 && typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (!path.startsWith('/login') && !path.startsWith('/register')) {
      // Fora da árvore React (cache global de queries): navegação completa para limpar o estado.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/login?next=${encodeURIComponent(path + window.location.search)}`;
    }
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleUnauthorized }),
        mutationCache: new MutationCache({ onError: handleUnauthorized }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        {children}
        <Toaster richColors closeButton position="top-right" toastOptions={{ className: 'font-sans' }} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

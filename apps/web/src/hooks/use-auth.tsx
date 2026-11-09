'use client';

import { hasPermission, type Permission } from '@horizons/shared';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { api } from '@/lib/api';
import type { CurrentUser, Single } from '@/lib/types';

interface AuthContextValue {
  user: CurrentUser;
  can: (permission: Permission) => boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<Single<CurrentUser>>('/auth/me').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function AuthProvider({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ user, can: (p: Permission) => hasPermission(user.role, p) }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

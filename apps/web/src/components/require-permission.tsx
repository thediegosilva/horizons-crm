'use client';

import type { Permission } from '@horizons/shared';
import { ShieldX } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { useAuth } from '@/hooks/use-auth';

/** Bloqueio visual de páginas sem permissão (a API também bloqueia com 403). */
export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { can } = useAuth();
  if (can(permission)) return <>{children}</>;
  return (
    <Card>
      <EmptyState
        icon={ShieldX}
        title="Acesso restrito"
        description="Sua função não tem permissão para acessar esta área. Fale com o administrador da sua empresa."
        action={<Button asChild variant="secondary"><Link href="/dashboard">Voltar ao dashboard</Link></Button>}
      />
    </Card>
  );
}

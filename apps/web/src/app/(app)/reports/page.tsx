import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequirePermission } from '@/components/require-permission';
import { ReportsView } from './reports-view';

export const metadata: Metadata = { title: 'Relatórios' };

export default function ReportsPage() {
  return (
    <Suspense>
      <RequirePermission permission="reports:read">
        <ReportsView />
      </RequirePermission>
    </Suspense>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequirePermission } from '@/components/require-permission';
import { FinanceView } from './finance-view';

export const metadata: Metadata = { title: 'Financeiro' };

export default function FinancePage() {
  return (
    <Suspense>
      <RequirePermission permission="finance:read">
        <FinanceView />
      </RequirePermission>
    </Suspense>
  );
}

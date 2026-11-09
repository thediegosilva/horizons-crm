import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CustomersView } from './customers-view';

export const metadata: Metadata = { title: 'Clientes' };

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersView />
    </Suspense>
  );
}

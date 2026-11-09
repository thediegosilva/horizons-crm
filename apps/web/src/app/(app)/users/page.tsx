import type { Metadata } from 'next';
import { RequirePermission } from '@/components/require-permission';
import { UsersView } from './users-view';

export const metadata: Metadata = { title: 'Usuários' };

export default function UsersPage() {
  return (
    <RequirePermission permission="users:manage">
      <UsersView />
    </RequirePermission>
  );
}

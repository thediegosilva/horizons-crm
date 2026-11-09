import type { Role } from './enums';

export const PERMISSIONS = [
  'dashboard:read',
  'customers:read',
  'customers:write',
  'customers:delete',
  'products:read',
  'products:write',
  'products:delete',
  'orders:read',
  'orders:write',
  'orders:status',
  'orders:cancel',
  'finance:read',
  'finance:write',
  'reports:read',
  'users:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Matriz de permissões por função.
 * - Administrador: acesso total, inclusive gestão de usuários.
 * - Gerente: opera todo o comercial e o financeiro, mas não gerencia usuários.
 * - Operador: atendimento — clientes e pedidos, sem exclusões, sem financeiro e sem relatórios.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: PERMISSIONS.filter((p) => p !== 'users:manage'),
  OPERATOR: [
    'dashboard:read',
    'customers:read',
    'customers:write',
    'products:read',
    'orders:read',
    'orders:write',
    'orders:status',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

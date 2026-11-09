import type { Permission } from '@horizons/shared';
import {
  BarChart3,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Visão geral',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard:read' }],
  },
  {
    title: 'Comercial',
    items: [
      { href: '/customers', label: 'Clientes', icon: Users, permission: 'customers:read' },
      { href: '/products', label: 'Produtos e serviços', icon: Package, permission: 'products:read' },
      { href: '/orders', label: 'Pedidos', icon: ShoppingCart, permission: 'orders:read' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { href: '/finance', label: 'Financeiro', icon: Wallet, permission: 'finance:read' },
      { href: '/reports', label: 'Relatórios', icon: BarChart3, permission: 'reports:read' },
      { href: '/users', label: 'Usuários', icon: UserCog, permission: 'users:manage' },
      { href: '/settings', label: 'Configurações', icon: Settings },
    ],
  },
];

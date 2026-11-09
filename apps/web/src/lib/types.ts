import type {
  CustomerType,
  FinancialStatus,
  FinancialType,
  OrderStatus,
  Permission,
  ProductType,
  Role,
} from '@horizons/shared';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}
export interface Single<T> {
  data: T;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  organization: { id: string; name: string; isDemo: boolean };
}

export interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  createdAt: string;
  ordersCount?: number;
  stats?: { ordersCount: number; totalSpentCents: number; lastOrderAt: string | null };
}

export interface Product {
  id: string;
  type: ProductType;
  name: string;
  sku: string;
  description: string | null;
  category: string;
  priceCents: number;
  stock: number;
  minStock: number;
  active: boolean;
  createdAt: string;
  stats?: { unitsSold: number; revenueCents: number };
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  totalCents: number;
}

export interface OrderSummary {
  id: string;
  number: number;
  code: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
  customer: { id: string; name: string };
  itemsCount: number;
}

export interface Order {
  id: string;
  number: number;
  code: string;
  status: OrderStatus;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  stockReserved: boolean;
  notes: string | null;
  paidAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; email: string | null; phone: string | null; document: string | null; type: CustomerType };
  createdBy: { id: string; name: string } | null;
  items: OrderItem[];
  statusHistory: {
    id: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    note: string | null;
    createdAt: string;
    user: { id: string; name: string } | null;
  }[];
  financialEntries: {
    id: string;
    type: FinancialType;
    status: FinancialStatus;
    amountCents: number;
    dueDate: string;
    paidAt: string | null;
    description: string;
  }[];
}

export interface FinancialEntry {
  id: string;
  type: FinancialType;
  status: FinancialStatus;
  description: string;
  category: string;
  amountCents: number;
  dueDate: string;
  paidAt: string | null;
  notes: string | null;
  orderId: string | null;
  order: { id: string; number: number } | null;
  overdue: boolean;
  locked: boolean;
  createdAt: string;
}

export interface FinanceSummary {
  period: { from: string; to: string };
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
  balanceCents: number;
  receivable: { cents: number; count: number; overdueCents: number; overdueCount: number };
  payable: { cents: number; count: number; overdueCents: number; overdueCount: number };
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Activity {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  createdAt: string;
  userName: string | null;
}

export interface Dashboard {
  generatedAt: string;
  customers: { total: number; newThisMonth: number };
  sales: { total: number; thisMonth: number };
  revenue: { monthCents: number; previousMonthCents: number; changePct: number | null };
  pendingOrders: { total: number; byStatus: Partial<Record<OrderStatus, number>> };
  kpis: {
    averageTicketCents: number;
    conversionRatePct: number | null;
    cancellationRatePct: number | null;
    lowStockProducts: number;
  };
  finance: { receivableCents: number; overdueCount: number; overdueCents: number } | null;
  monthly: { period: string; orders: number; revenueCents: number }[];
  daily: { period: string; orders: number; revenueCents: number }[];
  recentOrders: { id: string; number: number; code: string; status: OrderStatus; totalCents: number; createdAt: string; customer: { name: string } }[];
  activities: Activity[];
}

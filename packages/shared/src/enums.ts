export const ROLES = ['ADMIN', 'MANAGER', 'OPERATOR'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  OPERATOR: 'Operador',
};

export const ORDER_STATUSES = [
  'QUOTE',
  'AWAITING_PAYMENT',
  'PAID',
  'PROCESSING',
  'COMPLETED',
  'CANCELED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  QUOTE: 'Orçamento',
  AWAITING_PAYMENT: 'Aguardando pagamento',
  PAID: 'Pago',
  PROCESSING: 'Em processamento',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
};

export const CUSTOMER_TYPES = ['INDIVIDUAL', 'COMPANY'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  INDIVIDUAL: 'Pessoa física',
  COMPANY: 'Pessoa jurídica',
};

export const PRODUCT_TYPES = ['PRODUCT', 'SERVICE'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  PRODUCT: 'Produto',
  SERVICE: 'Serviço',
};

export const FINANCIAL_TYPES = ['INCOME', 'EXPENSE'] as const;
export type FinancialType = (typeof FINANCIAL_TYPES)[number];
export const FINANCIAL_TYPE_LABELS: Record<FinancialType, string> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
};

export const FINANCIAL_STATUSES = ['PENDING', 'PAID', 'CANCELED'] as const;
export type FinancialStatus = (typeof FINANCIAL_STATUSES)[number];
export const FINANCIAL_STATUS_LABELS: Record<FinancialStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  CANCELED: 'Cancelado',
};

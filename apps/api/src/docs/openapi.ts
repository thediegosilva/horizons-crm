import {
  changePasswordSchema,
  createUserSchema,
  customerListQuery,
  customerSchema,
  financeListQuery,
  financialEntrySchema,
  loginSchema,
  orderListQuery,
  orderSchema,
  orderStatusSchema,
  payEntrySchema,
  productListQuery,
  productSchema,
  registerSchema,
  REPORT_TYPES,
  reportQuery,
  updateProfileSchema,
  updateUserSchema,
} from '@horizons/shared';
import { z } from 'zod';

type JsonSchema = Record<string, unknown>;

const toSchema = (schema: z.ZodType): JsonSchema => {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
  return rest;
};

/** Converte um schema de query (objeto) em parâmetros OpenAPI. */
function queryParams(schema: z.ZodType) {
  const json = toSchema(schema) as { properties?: Record<string, JsonSchema>; required?: string[] };
  return Object.entries(json.properties ?? {}).map(([name, s]) => ({
    name,
    in: 'query',
    required: json.required?.includes(name) && s.default === undefined,
    schema: s,
  }));
}

const idPath = [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }];

const error = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const ok = (description: string, schemaRef?: string) => ({
  description,
  ...(schemaRef
    ? { content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: schemaRef } } } } } }
    : {}),
});

const paginated = (description: string, itemRef: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { data: { type: 'array', items: { $ref: itemRef } }, meta: { $ref: '#/components/schemas/PageMeta' } },
      },
    },
  },
});

const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema: toSchema(schema) } } });

const common = {
  401: error('Não autenticado'),
  403: error('Sem permissão'),
};

const crud = (tag: string, base: string, opts: { listQuery: z.ZodType; input: z.ZodType; ref: string; perms: string }) => ({
  [base]: {
    get: { tags: [tag], summary: `Listar (${opts.perms}:read)`, parameters: queryParams(opts.listQuery), responses: { 200: paginated('Lista paginada', opts.ref), 400: error('Filtros inválidos'), ...common } },
    post: { tags: [tag], summary: `Criar (${opts.perms}:write)`, requestBody: body(opts.input), responses: { 201: ok('Criado', opts.ref), 400: error('Validação'), 409: error('Duplicado'), ...common } },
  },
  [`${base}/{id}`]: {
    get: { tags: [tag], summary: 'Detalhar', parameters: idPath, responses: { 200: ok('Registro', opts.ref), 404: error('Não encontrado'), ...common } },
    put: { tags: [tag], summary: `Atualizar (${opts.perms}:write)`, parameters: idPath, requestBody: body(opts.input), responses: { 200: ok('Atualizado', opts.ref), 400: error('Validação'), 404: error('Não encontrado'), ...common } },
    delete: { tags: [tag], summary: `Excluir (${opts.perms}:delete)`, parameters: idPath, responses: { 204: { description: 'Excluído' }, 404: error('Não encontrado'), 409: error('Possui vínculos'), ...common } },
  },
});

const ts = { type: 'string', format: 'date-time' };
const cents = { type: 'integer', description: 'Valor em centavos' };

export function buildOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Horizons CRM API',
      version: '1.0.0',
      description:
        'API REST do Horizons CRM. Autenticação por sessão em cookie `httpOnly` (`hz_session`), obtido em `POST /auth/login`. ' +
        'Todos os dados são isolados por organização e as permissões são verificadas no servidor. ' +
        'Valores monetários são inteiros em **centavos**.',
    },
    servers: [{ url: '/api', description: 'Via proxy do front-end' }, { url: '/', description: 'Acesso direto à API' }],
    components: {
      securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'hz_session' } },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: { code: { type: 'string', example: 'VALIDATION_ERROR' }, message: { type: 'string' }, details: {} },
            },
          },
        },
        PageMeta: {
          type: 'object',
          properties: { page: { type: 'integer' }, pageSize: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, email: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'OPERATOR'] }, active: { type: 'boolean' },
            permissions: { type: 'array', items: { type: 'string' } },
          },
        },
        Customer: {
          allOf: [toSchema(customerSchema), { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, createdAt: ts, ordersCount: { type: 'integer' } } }],
        },
        Product: {
          allOf: [toSchema(productSchema), { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, createdAt: ts } }],
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' }, number: { type: 'integer' }, code: { type: 'string', example: 'PED-00001' },
            status: { type: 'string', enum: ['QUOTE', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'COMPLETED', 'CANCELED'] },
            subtotalCents: cents, discountCents: cents, totalCents: cents, createdAt: ts,
            items: { type: 'array', items: { type: 'object', properties: { productName: { type: 'string' }, quantity: { type: 'integer' }, unitPriceCents: cents, discountCents: cents, totalCents: cents } } },
          },
        },
        FinancialEntry: {
          allOf: [toSchema(financialEntrySchema), { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, orderId: { type: ['string', 'null'] }, overdue: { type: 'boolean' }, locked: { type: 'boolean' } } }],
        },
      },
    },
    security: [{ session: [] }],
    tags: [
      { name: 'Auth' }, { name: 'Dashboard' }, { name: 'Clientes' }, { name: 'Produtos' }, { name: 'Pedidos' },
      { name: 'Financeiro' }, { name: 'Relatórios' }, { name: 'Usuários' }, { name: 'Notificações' }, { name: 'Sistema' },
    ],
    paths: {
      '/health': { get: { tags: ['Sistema'], summary: 'Verificação de saúde', security: [], responses: { 200: { description: 'OK' } } } },
      '/auth/register': { post: { tags: ['Auth'], summary: 'Criar conta (empresa + administrador)', security: [], requestBody: body(registerSchema), responses: { 201: ok('Conta criada; cookie de sessão definido', '#/components/schemas/User'), 400: error('Validação'), 409: error('E-mail em uso'), 429: error('Muitas tentativas') } } },
      '/auth/login': { post: { tags: ['Auth'], summary: 'Entrar', security: [], requestBody: body(loginSchema), responses: { 200: ok('Autenticado; cookie de sessão definido', '#/components/schemas/User'), 401: error('Credenciais inválidas'), 429: error('Muitas tentativas') } } },
      '/auth/logout': { post: { tags: ['Auth'], summary: 'Sair (revoga a sessão)', responses: { 204: { description: 'Sessão encerrada' }, ...common } } },
      '/auth/me': { get: { tags: ['Auth'], summary: 'Usuário autenticado e permissões', responses: { 200: ok('Usuário', '#/components/schemas/User'), ...common } } },
      '/auth/profile': { patch: { tags: ['Auth'], summary: 'Atualizar perfil', requestBody: body(updateProfileSchema), responses: { 200: ok('Atualizado', '#/components/schemas/User'), ...common } } },
      '/auth/password': { post: { tags: ['Auth'], summary: 'Alterar senha (encerra as outras sessões)', requestBody: body(changePasswordSchema), responses: { 204: { description: 'Senha alterada' }, 400: error('Senha atual incorreta'), ...common } } },
      '/dashboard': { get: { tags: ['Dashboard'], summary: 'Indicadores do painel (dados reais)', responses: { 200: { description: 'Indicadores' }, ...common } } },
      '/activities': { get: { tags: ['Dashboard'], summary: 'Histórico de atividades da organização', responses: { 200: { description: 'Lista paginada' }, ...common } } },
      ...crud('Clientes', '/customers', { listQuery: customerListQuery, input: customerSchema, ref: '#/components/schemas/Customer', perms: 'customers' }),
      ...crud('Produtos', '/products', { listQuery: productListQuery, input: productSchema, ref: '#/components/schemas/Product', perms: 'products' }),
      '/products/categories': { get: { tags: ['Produtos'], summary: 'Categorias existentes', responses: { 200: { description: 'Lista de categorias' }, ...common } } },
      ...crud('Pedidos', '/orders', { listQuery: orderListQuery, input: orderSchema, ref: '#/components/schemas/Order', perms: 'orders' }),
      '/orders/{id}/status': {
        patch: {
          tags: ['Pedidos'],
          summary: 'Alterar status (orders:status; cancelamento exige orders:cancel)',
          description: 'Fluxo: Orçamento → Aguardando pagamento → Pago → Em processamento → Concluído. Cancelamento possível antes da conclusão. Reserva/devolve estoque e gera/atualiza lançamentos financeiros.',
          parameters: idPath, requestBody: body(orderStatusSchema),
          responses: { 200: ok('Pedido atualizado', '#/components/schemas/Order'), 409: error('Estoque insuficiente ou conflito'), 422: error('Transição inválida'), ...common },
        },
      },
      '/finance/entries': {
        get: { tags: ['Financeiro'], summary: 'Listar lançamentos (finance:read)', parameters: queryParams(financeListQuery), responses: { 200: paginated('Lista', '#/components/schemas/FinancialEntry'), ...common } },
        post: { tags: ['Financeiro'], summary: 'Criar lançamento manual (finance:write)', requestBody: body(financialEntrySchema), responses: { 201: ok('Criado', '#/components/schemas/FinancialEntry'), 400: error('Validação'), ...common } },
      },
      '/finance/entries/{id}': {
        get: { tags: ['Financeiro'], summary: 'Detalhar lançamento', parameters: idPath, responses: { 200: ok('Lançamento', '#/components/schemas/FinancialEntry'), 404: error('Não encontrado'), ...common } },
        put: { tags: ['Financeiro'], summary: 'Editar lançamento manual pendente', parameters: idPath, requestBody: body(financialEntrySchema), responses: { 200: ok('Atualizado', '#/components/schemas/FinancialEntry'), 422: error('Lançamento bloqueado'), ...common } },
        delete: { tags: ['Financeiro'], summary: 'Excluir lançamento manual não pago', parameters: idPath, responses: { 204: { description: 'Excluído' }, 422: error('Lançamento bloqueado'), ...common } },
      },
      '/finance/entries/{id}/pay': { post: { tags: ['Financeiro'], summary: 'Baixar (marcar como pago)', parameters: idPath, requestBody: { content: { 'application/json': { schema: toSchema(payEntrySchema) } } }, responses: { 200: ok('Pago', '#/components/schemas/FinancialEntry'), 422: error('Lançamento bloqueado'), ...common } } },
      '/finance/entries/{id}/cancel': { post: { tags: ['Financeiro'], summary: 'Cancelar lançamento manual', parameters: idPath, responses: { 200: ok('Cancelado', '#/components/schemas/FinancialEntry'), 422: error('Lançamento bloqueado'), ...common } } },
      '/finance/summary': { get: { tags: ['Financeiro'], summary: 'Resumo: receitas, despesas, saldo, contas a receber/pagar', parameters: queryParams(z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() })), responses: { 200: { description: 'Resumo' }, ...common } } },
      '/finance/cashflow': { get: { tags: ['Financeiro'], summary: 'Fluxo de caixa mensal', parameters: queryParams(z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() })), responses: { 200: { description: 'Série mensal' }, ...common } } },
      '/finance/categories': { get: { tags: ['Financeiro'], summary: 'Categorias existentes', responses: { 200: { description: 'Lista' }, ...common } } },
      '/reports/{type}': {
        get: {
          tags: ['Relatórios'], summary: 'Gerar relatório (reports:read)',
          parameters: [{ name: 'type', in: 'path', required: true, schema: { type: 'string', enum: [...REPORT_TYPES] } }, ...queryParams(reportQuery)],
          responses: { 200: { description: 'Relatório' }, 400: error('Período inválido'), ...common },
        },
      },
      '/reports/{type}/export': {
        get: {
          tags: ['Relatórios'], summary: 'Exportar relatório em CSV (separador ;)',
          parameters: [{ name: 'type', in: 'path', required: true, schema: { type: 'string', enum: [...REPORT_TYPES] } }, ...queryParams(reportQuery)],
          responses: { 200: { description: 'Arquivo CSV', content: { 'text/csv': { schema: { type: 'string' } } } }, ...common },
        },
      },
      '/users': {
        get: { tags: ['Usuários'], summary: 'Listar usuários (users:manage)', responses: { 200: { description: 'Lista' }, ...common } },
        post: { tags: ['Usuários'], summary: 'Criar usuário', requestBody: body(createUserSchema), responses: { 201: ok('Criado', '#/components/schemas/User'), 409: error('E-mail em uso'), ...common } },
      },
      '/users/{id}': { patch: { tags: ['Usuários'], summary: 'Alterar nome, função ou status', parameters: idPath, requestBody: body(updateUserSchema), responses: { 200: ok('Atualizado', '#/components/schemas/User'), 422: error('Regra violada (ex.: último administrador)'), ...common } } },
      '/users/{id}/password': { post: { tags: ['Usuários'], summary: 'Redefinir senha (encerra sessões do usuário)', parameters: idPath, requestBody: body(z.object({ password: z.string() })), responses: { 204: { description: 'Senha redefinida' }, ...common } } },
      '/notifications': { get: { tags: ['Notificações'], summary: 'Últimas notificações do usuário', responses: { 200: { description: 'Lista + contador de não lidas' }, ...common } } },
      '/notifications/{id}/read': { post: { tags: ['Notificações'], summary: 'Marcar como lida', parameters: idPath, responses: { 204: { description: 'OK' }, ...common } } },
      '/notifications/read-all': { post: { tags: ['Notificações'], summary: 'Marcar todas como lidas', responses: { 204: { description: 'OK' }, ...common } } },
    },
  };
}

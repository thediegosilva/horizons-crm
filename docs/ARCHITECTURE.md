# Arquitetura do Horizons CRM

Este documento registra as decisões técnicas, o modelo de dados e os fluxos principais do sistema.

## 1. Visão geral

```
Navegador ──► Next.js (web :3000) ──rewrite /api/*──► API Express (:3333) ──► PostgreSQL
              React + TanStack Query                   módulos de domínio
                         └──────── packages/shared (Zod, enums, permissões, cálculos) ────────┘
```

| Pacote | Responsabilidade |
|---|---|
| `packages/shared` | Contratos compartilhados: schemas Zod (entrada), enums e rótulos pt-BR, matriz de permissões, máquina de estados e cálculo de totais do pedido, validação de CPF/CNPJ |
| `apps/api` | API REST: autenticação, autorização, regras de negócio, persistência, relatórios e OpenAPI |
| `apps/web` | Interface: páginas, design system, gráficos, formulários e cache de dados |

## 2. Decisões técnicas

| Decisão | Alternativas consideradas | Motivo |
|---|---|---|
| API separada (Express) em vez de Route Handlers do Next | Next.js full-stack | Separação clara de responsabilidades, API testável de forma isolada e reutilizável por outros clientes |
| Proxy `/api/*` pelo Next.js | CORS entre portas | Mesma origem: cookies `SameSite=Lax`, sem configuração de CORS e sem expor a API ao navegador |
| Sessão no banco (token opaco) | JWT | Revogação imediata (logout, troca de senha, desativação), sem segredo de assinatura para gerenciar |
| Valores em centavos (`Int`) | `Decimal` | Aritmética exata e simples em TypeScript e SQL, sem erros de ponto flutuante |
| Isolamento por `organizationId` em todas as consultas | Schema por tenant / RLS | Simples, eficiente para pequenas empresas e validado por testes de IDOR |
| Zod compartilhado + `z.toJSONSchema` | Bibliotecas de geração OpenAPI | Uma fonte única para validação no front, no back e na documentação, sem dependências extras |
| Prisma 7 com `@prisma/adapter-pg` | Prisma 6 / Drizzle | Versão estável atual, tipagem forte e migrations versionadas |
| Express 5 | Fastify / NestJS | Consolidado e enxuto; o Express 5 propaga erros de handlers assíncronos sem wrappers |

## 3. Modelo de dados

```
Organization 1─┬─N User 1─N Session
               ├─N Customer 1─N Order
               ├─N Product  1─N OrderItem N─1 Order
               ├─N Order    1─N OrderStatusHistory
               │            1─N FinancialEntry
               ├─N FinancialEntry (manuais ou vinculados a pedidos)
               ├─N ActivityLog
               └─N Notification N─1 User
```

| Tabela | Destaques |
|---|---|
| `organizations` | `is_demo` (identifica dados de demonstração), `order_seq` (numeração sequencial de pedidos) |
| `users` | `email` único, `password_hash` (argon2id), `role`, `active` |
| `sessions` | `token_hash` (SHA-256), `expires_at`, `ip`, `user_agent` |
| `customers` | `type` PF/PJ, `document` normalizado (somente dígitos), único por organização |
| `products` | `sku` único por organização, `price_cents`, `stock`, `min_stock`, `active` |
| `orders` | `number` único por organização, `status`, totais em centavos, `stock_reserved`, `paid_at`, `completed_at`, `canceled_at` |
| `order_items` | **snapshot** de nome, SKU e preço no momento da venda |
| `order_status_history` | trilha de auditoria das transições (de → para, usuário, observação) |
| `financial_entries` | `type` (receita/despesa), `status` (pendente/pago/cancelado), `due_date` e `paid_at` (DATE), `order_id` opcional |
| `activity_logs` / `notifications` | feed de atividades e alertas por usuário |

Índices compostos por `organization_id` atendem às listagens e agregações mais frequentes.

## 4. Fluxo de uma requisição

1. O navegador chama `/api/orders/:id/status` (mesma origem, cookie `hz_session`).
2. O Next.js reescreve a chamada para `http://api:3333/orders/:id/status`.
3. A API aplica `helmet`, o limite de tamanho do JSON e a verificação de `Origin`.
4. `authenticate` busca a sessão pelo hash do token e carrega usuário, função e organização (sempre do banco).
5. `requirePermission('orders:status')` checa a matriz de permissões.
6. A rota valida a entrada com Zod e chama o service.
7. O service abre uma transação. Ele busca o pedido **filtrando pelo `organizationId`** e valida a transição.
   Em seguida, atualiza o status com bloqueio otimista, reserva o estoque, gera ou baixa os lançamentos
   financeiros, registra o histórico, a atividade e as notificações.
8. Erros conhecidos viram `{ error: { code, message } }` com o status HTTP correto. Erros inesperados viram uma
   mensagem genérica com status 500.

## 5. Datas e fuso horário

- Instantes (`created_at`, `paid_at` do pedido) são armazenados em UTC. A conexão força `TimeZone=UTC`.
- Agregações por dia/mês convertem para `APP_TIMEZONE` no SQL
  (`paid_at AT TIME ZONE 'UTC' AT TIME ZONE $tz`).
- Datas de calendário (vencimento e pagamento de lançamentos) usam colunas `DATE` e o formato `AAAA-MM-DD`, sem
  conversão de fuso.

## 6. Estratégia de testes

| Nível | Ferramenta | Foco |
|---|---|---|
| Unitário | Vitest | Funções puras: cálculos, transições, validações, datas, CSV |
| Integração | Vitest + Supertest + PostgreSQL | Endpoints reais com banco real: autenticação, permissões, isolamento, regras de pedido e financeiro, relatórios |
| Manual/E2E | Playwright (scripts locais) | Fluxos de interface: cadastro, pedido completo, permissões no menu |

Os cenários de integração criam organizações próprias, então os testes são independentes e podem rodar sobre um
banco já utilizado.

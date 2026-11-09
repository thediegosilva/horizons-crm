/**
 * Seed de DEMONSTRAÇÃO.
 * Cria a organização "Horizons Demo" (marcada com isDemo = true) com dados fictícios,
 * claramente identificados na interface como dados de demonstração.
 * Idempotente: se a organização de demonstração já existir, nada é alterado.
 */
import {
  calculateOrderTotals,
  COMMITTED_ORDER_STATUSES,
  formatOrderNumber,
  REVENUE_ORDER_STATUSES,
  type OrderStatus,
} from '@horizons/shared';
import { env } from '../src/config/env';
import { addDays, dateOnlyToUtc, todayInTz, toDateOnly } from '../src/lib/dates';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/security';

export const DEMO_USERS = [
  { name: 'Helena Duarte', email: 'admin@horizons.demo', role: 'ADMIN' as const },
  { name: 'Rafael Moreira', email: 'gerente@horizons.demo', role: 'MANAGER' as const },
  { name: 'Camila Rocha', email: 'operador@horizons.demo', role: 'OPERATOR' as const },
];

// PRNG determinístico → o seed gera sempre os mesmos dados.
let state = 20_260_101;
function rand() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

function cpf(): string {
  const n = Array.from({ length: 9 }, () => between(0, 9));
  const dv = (len: number) => {
    const sum = n.slice(0, len).reduce((acc, d, i) => acc + d * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  n.push(dv(9));
  n.push(dv(10));
  return n.join('');
}

function cnpj(): string {
  const n = [...Array.from({ length: 8 }, () => between(0, 9)), 0, 0, 0, 1];
  const dv = (weights: number[]) => {
    const r = weights.reduce((acc, w, i) => acc + n[i]! * w, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  n.push(dv([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  n.push(dv([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  return n.join('');
}

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Larissa', 'Marcos', 'Natália', 'Otávio', 'Patrícia', 'Renato', 'Sofia', 'Thiago', 'Vanessa', 'Wesley'];
const LAST = ['Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Ferreira', 'Gomes', 'Lima', 'Martins', 'Nogueira', 'Oliveira', 'Pereira', 'Ribeiro', 'Santos', 'Teixeira', 'Vieira'];
const COMPANIES = ['Café Serra Azul', 'Ótica Visão Clara', 'Estúdio Lumen', 'Padaria Trigo de Ouro', 'Clínica Bem Viver', 'Escritório Prisma Contábil', 'Mercado Bom Preço', 'Academia Movimento', 'Livraria Página Nova', 'Agência Faro Digital', 'Pet Shop Amigo Fiel', 'Hotel Mirante'];
const CITIES: [string, string, string][] = [
  ['São Paulo', 'SP', '01310100'], ['Rio de Janeiro', 'RJ', '20040002'], ['Belo Horizonte', 'MG', '30130010'],
  ['Curitiba', 'PR', '80010000'], ['Porto Alegre', 'RS', '90010150'], ['Recife', 'PE', '50030230'],
  ['Florianópolis', 'SC', '88010400'], ['Salvador', 'BA', '40020000'], ['Campinas', 'SP', '13010111'],
];
const STREETS = ['Rua das Flores', 'Av. Brasil', 'Rua XV de Novembro', 'Av. Paulista', 'Rua do Comércio', 'Av. Beira-Mar', 'Rua Sete de Setembro'];

const PRODUCTS = [
  { name: 'Notebook Horizon Pro 14"', sku: 'NB-HP14', category: 'Informática', price: 649_900, stock: 18, min: 5 },
  { name: 'Monitor UltraWide 34"', sku: 'MN-UW34', category: 'Informática', price: 289_900, stock: 9, min: 3 },
  { name: 'Teclado Mecânico Aurora', sku: 'TC-AUR', category: 'Periféricos', price: 42_990, stock: 46, min: 10 },
  { name: 'Mouse Sem Fio Zenith', sku: 'MS-ZEN', category: 'Periféricos', price: 15_990, stock: 120, min: 20 },
  { name: 'Headset Studio Pro', sku: 'HS-STP', category: 'Periféricos', price: 54_900, stock: 4, min: 6 },
  { name: 'Webcam Full HD 1080p', sku: 'WC-FHD', category: 'Periféricos', price: 32_900, stock: 27, min: 8 },
  { name: 'Cadeira Ergonômica Atlas', sku: 'CD-ATL', category: 'Mobiliário', price: 189_900, stock: 7, min: 3 },
  { name: 'Mesa Regulável Elevate', sku: 'MS-ELV', category: 'Mobiliário', price: 249_900, stock: 2, min: 2 },
  { name: 'Roteador Wi-Fi 6 Mesh', sku: 'RT-W6M', category: 'Redes', price: 79_900, stock: 31, min: 8 },
  { name: 'Switch Gerenciável 24p', sku: 'SW-G24', category: 'Redes', price: 159_900, stock: 6, min: 2 },
  { name: 'SSD NVMe 1TB', sku: 'SSD-1TB', category: 'Componentes', price: 49_990, stock: 64, min: 15 },
  { name: 'Memória DDR5 32GB', sku: 'MEM-D5-32', category: 'Componentes', price: 69_990, stock: 22, min: 10 },
  { name: 'Nobreak 1500VA', sku: 'NB-1500', category: 'Energia', price: 119_900, stock: 11, min: 4 },
  { name: 'Licença Office Anual', sku: 'LIC-OFF', category: 'Software', price: 49_900, stock: 300, min: 30 },
];
const SERVICES = [
  { name: 'Instalação e Configuração', sku: 'SRV-INST', category: 'Serviços', price: 25_000 },
  { name: 'Suporte Técnico Mensal', sku: 'SRV-SUP', category: 'Serviços', price: 89_000 },
  { name: 'Consultoria em TI (hora)', sku: 'SRV-CONS', category: 'Serviços', price: 18_000 },
  { name: 'Treinamento de Equipe', sku: 'SRV-TREI', category: 'Serviços', price: 120_000 },
];
const EXPENSES: { description: string; category: string; amount: number; dueDay?: number }[] = [
  { description: 'Aluguel do escritório', category: 'Despesas fixas', amount: 450_000 },
  { description: 'Folha de pagamento', category: 'Pessoal', amount: 1_850_000 },
  { description: 'Energia elétrica', category: 'Despesas fixas', amount: 68_000 },
  { description: 'Internet e telefonia', category: 'Despesas fixas', amount: 24_990 },
  { description: 'Marketing digital', category: 'Marketing', amount: 150_000 },
];

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) {
    console.log('ℹ️  SEED_DEMO_PASSWORD não definida — seed de demonstração ignorado.');
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email: DEMO_USERS[0]!.email } });
  if (existing) {
    console.log('ℹ️  Organização de demonstração já existe — nada a fazer.');
    return;
  }

  const tz = env.APP_TIMEZONE;
  const today = todayInTz(tz);
  const passwordHash = await hashPassword(password);

  const org = await prisma.organization.create({ data: { name: 'Horizons Demo Tecnologia', isDemo: true } });
  const users: Awaited<ReturnType<typeof prisma.user.create>>[] = [];
  for (const u of DEMO_USERS) {
    users.push(await prisma.user.create({ data: { ...u, passwordHash, organizationId: org.id } }));
  }
  const [admin, manager, operator] = users as [(typeof users)[0], (typeof users)[0], (typeof users)[0]];

  // Produtos e serviços
  const products: Awaited<ReturnType<typeof prisma.product.create>>[] = [];
  for (const p of PRODUCTS) {
    products.push(
      await prisma.product.create({
        data: {
          organizationId: org.id, type: 'PRODUCT', name: p.name, sku: p.sku, category: p.category,
          priceCents: p.price, stock: p.stock, minStock: p.min, description: `${p.name} — item de demonstração.`,
        },
      }),
    );
  }
  for (const s of SERVICES) {
    products.push(
      await prisma.product.create({
        data: { organizationId: org.id, type: 'SERVICE', name: s.name, sku: s.sku, category: s.category, priceCents: s.price },
      }),
    );
  }
  await prisma.product.create({
    data: { organizationId: org.id, type: 'PRODUCT', name: 'Impressora Laser (descontinuada)', sku: 'IMP-LZ', category: 'Informática', priceCents: 99_900, stock: 0, minStock: 0, active: false },
  });

  // Clientes (cadastrados ao longo de 14 meses)
  const customers: Awaited<ReturnType<typeof prisma.customer.create>>[] = [];
  for (let i = 0; i < 36; i++) {
    const isCompany = i % 3 === 0;
    const [city, state, zip] = pick(CITIES);
    const name = isCompany ? COMPANIES[(i / 3) % COMPANIES.length]! + (i >= 36 ? ` ${i}` : '') : `${pick(FIRST)} ${pick(LAST)}`;
    const slug = name.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim().split(' ').slice(0, 2).join('.');
    const createdAt = new Date(dateOnlyToUtc(addDays(today, -between(5, 420))).getTime() + between(9, 18) * 3_600_000);
    customers.push(
      await prisma.customer.create({
        data: {
          organizationId: org.id,
          type: isCompany ? 'COMPANY' : 'INDIVIDUAL',
          name,
          email: `${slug}${i}@exemplo.com.br`,
          phone: `(${between(11, 99)}) 9${between(1000, 9999)}-${between(1000, 9999)}`,
          document: isCompany ? cnpj() : cpf(),
          zipCode: zip, street: pick(STREETS), number: String(between(10, 2500)), district: 'Centro', city, state,
          notes: i % 5 === 0 ? 'Cliente prefere contato por e-mail.' : null,
          createdAt,
        },
      }),
    );
  }

  // Pedidos ao longo de 12 meses, com crescimento gradual
  let number = 0;
  const revenueByMonth = new Map<string, number>();
  const createdOrders: { id: string; createdAt: Date; status: OrderStatus; number: number; customer: string }[] = [];
  for (let daysAgo = 360; daysAgo >= 0; daysAgo--) {
    const growth = 1 + (360 - daysAgo) / 240;
    const ordersToday = rand() < 0.42 * growth ? between(1, Math.ceil(growth)) : 0;
    // Horários do dia em ordem crescente → a numeração acompanha a ordem cronológica.
    const times = Array.from({ length: ordersToday }, () =>
      dateOnlyToUtc(addDays(today, -daysAgo)).getTime() + between(12, 22) * 3_600_000 + between(0, 59) * 60_000,
    ).sort((a, b) => a - b);
    for (const time of times) {
      const customer = pick(customers.filter((c) => c.createdAt <= dateOnlyToUtc(addDays(today, -daysAgo + 1))));
      if (!customer) continue;
      const createdAt = new Date(time);
      if (createdAt > new Date()) continue;

      let status: OrderStatus;
      const r = rand();
      if (daysAgo > 20) status = r < 0.08 ? 'CANCELED' : r < 0.12 ? 'QUOTE' : 'COMPLETED';
      else if (daysAgo > 6) status = r < 0.1 ? 'CANCELED' : r < 0.55 ? 'COMPLETED' : r < 0.75 ? 'PROCESSING' : r < 0.88 ? 'PAID' : 'AWAITING_PAYMENT';
      else status = r < 0.3 ? 'QUOTE' : r < 0.55 ? 'AWAITING_PAYMENT' : r < 0.75 ? 'PAID' : r < 0.9 ? 'PROCESSING' : 'CANCELED';

      const chosen = new Set<number>();
      const itemCount = between(1, 3);
      while (chosen.size < itemCount) chosen.add(between(0, products.length - 1));
      const lines = [...chosen].map((idx) => {
        const product = products[idx]!;
        const quantity = product.type === 'SERVICE' ? between(1, 3) : between(1, product.priceCents > 100_000 ? 2 : 5);
        const gross = quantity * product.priceCents;
        const discountCents = rand() < 0.25 ? Math.round(gross * pick([0.05, 0.1])) : 0;
        return { product, quantity, unitPriceCents: product.priceCents, discountCents };
      });
      const totals = calculateOrderTotals(lines, 0);
      number++;

      const paid = (REVENUE_ORDER_STATUSES as readonly string[]).includes(status) || (status === 'CANCELED' && rand() < 0.3);
      const paidAt = paid ? new Date(createdAt.getTime() + between(0, 3) * 86_400_000 + 3_600_000) : null;
      const effectivePaidAt = paidAt && paidAt > new Date() ? new Date() : paidAt;
      const committed = (COMMITTED_ORDER_STATUSES as readonly string[]).includes(status);
      const author = pick([admin, manager, operator]);

      const order = await prisma.order.create({
        data: {
          organizationId: org.id,
          number,
          customerId: customer.id,
          createdById: author.id,
          status,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          totalCents: totals.totalCents,
          stockReserved: committed,
          paidAt: effectivePaidAt,
          completedAt: status === 'COMPLETED' ? new Date(Math.min(Date.now(), createdAt.getTime() + 6 * 86_400_000)) : null,
          canceledAt: status === 'CANCELED' ? new Date(Math.min(Date.now(), createdAt.getTime() + 4 * 86_400_000)) : null,
          createdAt,
          items: {
            create: lines.map((l, i) => ({
              productId: l.product.id, productName: l.product.name, productSku: l.product.sku, quantity: l.quantity,
              unitPriceCents: l.unitPriceCents, discountCents: l.discountCents, totalCents: totals.lines[i]!.totalCents,
            })),
          },
          statusHistory: { create: { toStatus: 'QUOTE', userId: author.id, note: 'Pedido criado', createdAt } },
        },
      });
      if (status !== 'QUOTE') {
        await prisma.orderStatusHistory.create({
          data: { orderId: order.id, fromStatus: 'QUOTE', toStatus: status, userId: manager.id, createdAt: effectivePaidAt ?? createdAt },
        });
      }

      // Financeiro coerente com o status do pedido
      const code = formatOrderNumber(number);
      const createdDay = toDateOnly(new Date(createdAt.getTime() - 3 * 3_600_000));
      if (committed || paid) {
        await prisma.financialEntry.create({
          data: {
            organizationId: org.id, orderId: order.id, type: 'INCOME', category: 'Vendas',
            description: `Pedido ${code} — ${customer.name}`, amountCents: totals.totalCents,
            status: paid ? 'PAID' : status === 'CANCELED' ? 'CANCELED' : 'PENDING',
            dueDate: dateOnlyToUtc(addDays(createdDay, 7)),
            paidAt: effectivePaidAt ? dateOnlyToUtc(toDateOnly(new Date(effectivePaidAt.getTime() - 3 * 3_600_000))) : null,
            createdById: author.id, createdAt,
          },
        });
      }
      if (status === 'CANCELED' && paid) {
        await prisma.financialEntry.create({
          data: {
            organizationId: org.id, orderId: order.id, type: 'EXPENSE', category: 'Estornos', status: 'PAID',
            description: `Estorno do pedido ${code}`, amountCents: totals.totalCents,
            dueDate: dateOnlyToUtc(addDays(createdDay, 4)), paidAt: dateOnlyToUtc(addDays(createdDay, 4)), createdAt,
          },
        });
      }
      createdOrders.push({ id: order.id, createdAt, status, number, customer: customer.name });
      if (effectivePaidAt && status !== 'CANCELED') {
        const month = toDateOnly(new Date(effectivePaidAt.getTime() - 3 * 3_600_000)).slice(0, 7);
        revenueByMonth.set(month, (revenueByMonth.get(month) ?? 0) + totals.totalCents);
      }
    }
  }
  await prisma.organization.update({ where: { id: org.id }, data: { orderSeq: number } });

  // Despesas mensais: pagas nos meses anteriores, pendentes no mês atual/próximo
  for (let m = 11; m >= -1; m--) {
    const monthDate = new Date(dateOnlyToUtc(`${today.slice(0, 7)}-01`));
    monthDate.setUTCMonth(monthDate.getUTCMonth() - m);
    const base = toDateOnly(monthDate);
    // Compra de mercadorias: proporcional às vendas do mês anterior (reposição de estoque).
    const prevMonth = new Date(monthDate);
    prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
    const restock = Math.round((revenueByMonth.get(toDateOnly(prevMonth).slice(0, 7)) ?? 0) * 0.55);
    const restockExpenses = restock > 0 ? [{ description: 'Compra de mercadorias (reposição)', category: 'Fornecedores', amount: restock, dueDay: 25 }] : [];
    for (const e of [...EXPENSES, ...restockExpenses]) {
      const dueDate = addDays(base, e.dueDay ? e.dueDay - 1 : between(4, 14));
      const isPaid = dueDate < today && (m > 0 || rand() < 0.6);
      await prisma.financialEntry.create({
        data: {
          organizationId: org.id, type: 'EXPENSE', category: e.category, description: e.description,
          amountCents: Math.round(e.amount * (0.92 + rand() * 0.16)),
          status: isPaid ? 'PAID' : 'PENDING', dueDate: dateOnlyToUtc(dueDate),
          paidAt: isPaid ? dateOnlyToUtc(dueDate) : null, createdById: manager.id,
        },
      });
    }
  }
  await prisma.financialEntry.create({
    data: {
      organizationId: org.id, type: 'INCOME', category: 'Outras receitas', description: 'Rendimento de aplicação',
      amountCents: 32_450, status: 'PAID', dueDate: dateOnlyToUtc(addDays(today, -12)), paidAt: dateOnlyToUtc(addDays(today, -12)),
    },
  });

  // Atividades e notificações recentes
  const recent = createdOrders.slice(-10);
  for (const o of recent) {
    await prisma.activityLog.create({
      data: {
        organizationId: org.id, userId: pick(users).id, action: 'order.created', entityType: 'order', entityId: o.id,
        description: `Pedido ${formatOrderNumber(o.number)} criado para ${o.customer}`, createdAt: o.createdAt,
      },
    });
  }
  for (const u of [admin, manager]) {
    await prisma.notification.create({
      data: {
        organizationId: org.id, userId: u.id, title: 'Bem-vindo(a) ao ambiente de demonstração',
        message: 'Todos os dados desta organização são fictícios e servem apenas para demonstração.', link: '/dashboard',
      },
    });
    await prisma.notification.create({
      data: {
        organizationId: org.id, userId: u.id, title: 'Estoque baixo',
        message: '"Headset Studio Pro" está abaixo do estoque mínimo.', link: '/products?lowStock=true',
      },
    });
  }

  console.log(`✅ Demonstração criada: ${customers.length} clientes, ${products.length} produtos/serviços, ${number} pedidos.`);
  console.log(`   Usuários: ${DEMO_USERS.map((u) => u.email).join(', ')}`);
}

main()
  .catch((err) => {
    console.error('❌ Falha no seed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

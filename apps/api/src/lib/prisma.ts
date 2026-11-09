import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

export type { Prisma } from '../generated/prisma/client';

// Sessão em UTC: colunas timestamp sem fuso são sempre interpretadas como UTC.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, options: '-c TimeZone=UTC' });

export const prisma = new PrismaClient({ adapter });

/** Cliente de transação interativa (mesma API do PrismaClient, sem métodos de conexão). */
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type Db = typeof prisma | Tx;

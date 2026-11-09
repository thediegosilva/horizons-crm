import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// Em desenvolvimento, carrega o .env da raiz do monorepo. Em produção/Docker, usa o ambiente.
const rootEnv = resolve(import.meta.dirname, '../../../../.env');
if (process.env.NODE_ENV !== 'production' && existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 90).default(168),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  APP_TIMEZONE: z.string().default('America/Sao_Paulo'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  allowedOrigins: parsed.data.WEB_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
};

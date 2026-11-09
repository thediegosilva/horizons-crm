import { execSync } from 'node:child_process';

/**
 * Aplica as migrations pendentes no banco de testes (operação não destrutiva).
 * Os testes não dependem de banco vazio: cada cenário cria suas próprias organizações,
 * e o isolamento por organização garante que dados de execuções anteriores não interfiram.
 */
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
}

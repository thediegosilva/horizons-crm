import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// Endereço interno da API. As chamadas do navegador vão para /api/* (mesma origem)
// e o Next.js as encaminha para a API — sem CORS e com cookies httpOnly SameSite=Lax.
const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3333';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
  transpilePackages: ['@horizons/shared'],
  poweredByHeader: false,
  agentRules: false,
  devIndicators: false,
  // Mantém a barra final em /api/docs/ (exigida pelos assets relativos do Swagger UI).
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/api/docs/', destination: `${apiUrl}/docs/` },
      { source: '/api/:path*', destination: `${apiUrl}/:path*` },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

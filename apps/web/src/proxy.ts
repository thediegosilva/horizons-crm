import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proteção de rotas no servidor do Next.js: sem cookie de sessão, redireciona para o login.
 * A validação real da sessão e das permissões acontece sempre na API.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has('hz_session');
  if (!hasSession) {
    const url = new URL('/login', request.url);
    const target = request.nextUrl.pathname + request.nextUrl.search;
    if (target !== '/') url.searchParams.set('next', target);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/customers/:path*', '/products/:path*', '/orders/:path*', '/finance/:path*', '/reports/:path*', '/users/:path*', '/settings/:path*'],
};

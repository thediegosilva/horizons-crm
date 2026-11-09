import Link from 'next/link';
import { LogoMark } from '@/components/layout/logo';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <LogoMark className="mx-auto size-12" />
        <p className="mt-6 text-sm font-semibold text-primary">Erro 404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">O endereço acessado não existe ou foi removido.</p>
        <Link href="/dashboard" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Voltar para o dashboard
        </Link>
      </div>
    </main>
  );
}

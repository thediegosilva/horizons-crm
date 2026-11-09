import { BarChart3, ShieldCheck, Wallet } from 'lucide-react';
import { Logo } from '@/components/layout/logo';

const highlights = [
  { icon: BarChart3, title: 'Indicadores em tempo real', text: 'Faturamento, vendas e pedidos calculados direto do banco de dados.' },
  { icon: Wallet, title: 'Financeiro integrado', text: 'Cada pedido gera e atualiza automaticamente suas contas a receber.' },
  { icon: ShieldCheck, title: 'Seguro por padrão', text: 'Permissões por função e dados isolados por empresa.' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0f0f1a] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -bottom-48 left-1/2 size-[46rem] -translate-x-1/2 rounded-full bg-horizon opacity-40 blur-3xl" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '48px 48px' }}
          aria-hidden
        />
        <div className="relative [&_.text-muted-foreground]:text-white/60">
          <Logo />
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">
            Gestão comercial com <span className="text-horizon">visão de horizonte.</span>
          </h2>
          <p className="mt-4 text-white/70">Clientes, pedidos, estoque e financeiro em um só lugar, para pequenas empresas que querem crescer com controle.</p>
          <ul className="mt-10 space-y-5">
            {highlights.map((h) => (
              <li key={h.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <h.icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{h.title}</span>
                  <span className="block text-sm text-white/60">{h.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <main id="conteudo" className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

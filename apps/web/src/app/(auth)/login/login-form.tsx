'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@horizons/shared';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { errorProps, Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';

const DEMO_ACCOUNTS = [
  { label: 'Administrador', email: 'admin@horizons.demo' },
  { label: 'Gerente', email: 'gerente@horizons.demo' },
  { label: 'Operador', email: 'operador@horizons.demo' },
];

/** Aceita apenas caminhos internos para evitar redirecionamento aberto. */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, setValue, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: LoginInput) {
    setError(null);
    try {
      await api('/auth/login', { method: 'POST', body: values });
      queryClient.clear();
      router.replace(safeNext(params.get('next')));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Entre com seu e-mail e senha para acessar o painel.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus {...register('email')} {...errorProps('email', errors.email?.message)} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" {...register('password')} {...errorProps('password', errors.password?.message)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Criar conta da empresa
        </Link>
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-border bg-muted/40 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <FlaskConical className="size-3.5 text-primary" aria-hidden /> Contas de demonstração (dados fictícios)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Selecione um perfil para preencher o e-mail. A senha está no README do projeto.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <Button key={a.email} type="button" variant="secondary" size="sm" onClick={() => setValue('email', a.email, { shouldValidate: true })}>
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}

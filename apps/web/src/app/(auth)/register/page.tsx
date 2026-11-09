'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@horizons/shared';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorProps, Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api, ApiError, errorMessage } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, setError: setFieldError, formState } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: RegisterInput) {
    setError(null);
    try {
      await api('/auth/register', { method: 'POST', body: values });
      queryClient.clear();
      toast.success('Conta criada! Bem-vindo ao Horizons CRM.');
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setFieldError('email', { message: err.message });
      else setError(errorMessage(err));
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Crie a conta da sua empresa</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Você será o administrador e poderá convidar sua equipe.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}
        <Field label="Nome da empresa" htmlFor="organizationName" error={errors.organizationName?.message}>
          <Input id="organizationName" autoComplete="organization" {...register('organizationName')} {...errorProps('organizationName', errors.organizationName?.message)} />
        </Field>
        <Field label="Seu nome" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" {...register('name')} {...errorProps('name', errors.name?.message)} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register('email')} {...errorProps('email', errors.email?.message)} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password?.message} hint="Mínimo de 8 caracteres, com maiúscula, minúscula e número.">
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} {...errorProps('password', errors.password?.message)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Criar conta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}

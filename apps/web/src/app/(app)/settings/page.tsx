'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  changePasswordSchema,
  ROLE_LABELS,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from '@horizons/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorProps, Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/misc';
import { useAuth } from '@/hooks/use-auth';
import { useMounted } from '@/hooks/use-mounted';
import { api } from '@/lib/api';
import { handleFormError } from '@/lib/forms';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Configurações" description="Seu perfil, segurança e preferências." />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard />
        <PasswordCard />
        <ThemeCard />
        <Card>
          <CardHeader><div><CardTitle>Organização</CardTitle><CardDescription>Dados da sua conta empresarial</CardDescription></div></CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Empresa</dt><dd className="font-medium">{user.organization.name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Sua função</dt><dd><Badge tone="primary">{ROLE_LABELS[user.role]}</Badge></dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Ambiente</dt><dd>{user.organization.isDemo ? <Badge tone="warning">Demonstração</Badge> : <Badge tone="success">Produção</Badge>}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ProfileCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, formState: { errors, isDirty } } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user.name },
  });
  const mutation = useMutation({
    mutationFn: (data: UpdateProfileInput) => api('/auth/profile', { method: 'PATCH', body: data }),
    onSuccess: () => { toast.success('Perfil atualizado.'); queryClient.invalidateQueries({ queryKey: ['me'] }); },
    onError: (err) => handleFormError(err, setError),
  });
  return (
    <Card>
      <CardHeader><div><CardTitle>Perfil</CardTitle><CardDescription>Como você aparece para a equipe</CardDescription></div></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4" noValidate>
          <Field label="Nome" htmlFor="p-name" error={errors.name?.message}>
            <Input id="p-name" {...register('name')} {...errorProps('p-name', errors.name?.message)} />
          </Field>
          <Field label="E-mail" htmlFor="p-email" hint="O e-mail de acesso é alterado pelo administrador.">
            <Input id="p-email" value={user.email} disabled readOnly />
          </Field>
          <div className="flex justify-end"><Button type="submit" disabled={!isDirty} loading={mutation.isPending}>Salvar perfil</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });
  const mutation = useMutation({
    mutationFn: (data: ChangePasswordInput) => api('/auth/password', { method: 'POST', body: data }),
    onSuccess: () => { toast.success('Senha alterada. Suas outras sessões foram encerradas.'); reset({ currentPassword: '', newPassword: '' }); },
    onError: (err) => handleFormError(err, setError),
  });
  return (
    <Card>
      <CardHeader><div><CardTitle>Segurança</CardTitle><CardDescription>Altere sua senha de acesso</CardDescription></div></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4" noValidate>
          <Field label="Senha atual" htmlFor="currentPassword" error={errors.currentPassword?.message}>
            <Input id="currentPassword" type="password" autoComplete="current-password" {...register('currentPassword')} {...errorProps('currentPassword', errors.currentPassword?.message)} />
          </Field>
          <Field label="Nova senha" htmlFor="newPassword" error={errors.newPassword?.message} hint="Mínimo de 8 caracteres, com maiúscula, minúscula e número.">
            <Input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} {...errorProps('newPassword', errors.newPassword?.message)} />
          </Field>
          <div className="flex justify-end"><Button type="submit" loading={mutation.isPending}>Alterar senha</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function ThemeCard() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const options = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ];
  return (
    <Card>
      <CardHeader><div><CardTitle>Aparência</CardTitle><CardDescription>Tema da interface neste dispositivo</CardDescription></div></CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-3">
          {options.map((o) => {
            const selected = mounted && theme === o.value;
            return (
              <button
                key={o.value}
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(o.value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors',
                  selected ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:bg-muted',
                )}
              >
                <o.icon className="size-5" aria-hidden /> {o.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

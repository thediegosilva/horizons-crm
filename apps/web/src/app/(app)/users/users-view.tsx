'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createUserSchema,
  passwordSchema,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  ROLES,
  type CreateUserInput,
  type Role,
} from '@horizons/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, MoreHorizontal, Pencil, Plus, ShieldCheck, UserCheck, UserX, UserCog } from 'lucide-react';
import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { errorProps, Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { Avatar, PageHeader } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { api, errorMessage } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { handleFormError } from '@/lib/forms';
import type { ManagedUser } from '@/lib/types';

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Acesso total, incluindo gestão de usuários.',
  MANAGER: 'Comercial, financeiro e relatórios. Não gerencia usuários.',
  OPERATOR: 'Atendimento: clientes e pedidos. Sem exclusões, financeiro ou relatórios.',
};

const PERMISSION_GROUPS = [
  { label: 'Clientes', keys: ['customers:read', 'customers:write', 'customers:delete'] },
  { label: 'Produtos', keys: ['products:read', 'products:write', 'products:delete'] },
  { label: 'Pedidos', keys: ['orders:read', 'orders:write', 'orders:status', 'orders:cancel'] },
  { label: 'Financeiro', keys: ['finance:read', 'finance:write'] },
  { label: 'Relatórios', keys: ['reports:read'] },
  { label: 'Usuários', keys: ['users:manage'] },
] as const;

export function UsersView() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ManagedUser | null>(null);
  const [resetting, setResetting] = React.useState<ManagedUser | null>(null);
  const [toggling, setToggling] = React.useState<ManagedUser | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<{ data: ManagedUser[] }>('/users').then((r) => r.data),
  });

  const toggle = useMutation({
    mutationFn: (u: ManagedUser) => api(`/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }),
    onSuccess: (_d, u) => {
      toast.success(u.active ? 'Usuário desativado e sessões encerradas.' : 'Usuário reativado.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setToggling(null);
    },
    onError: (err) => { toast.error(errorMessage(err)); setToggling(null); },
  });

  return (
    <>
      <PageHeader
        title="Usuários e permissões"
        description="Gerencie quem acessa o sistema e o que cada pessoa pode fazer."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus /> Novo usuário</Button>}
      />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        ) : !data?.length ? (
          <EmptyState icon={UserCog} title="Nenhum usuário" />
        ) : (
          <Table>
            <THead><tr><TH>Usuário</TH><TH>Função</TH><TH className="hidden sm:table-cell">Status</TH><TH className="hidden md:table-cell">Último acesso</TH><TH className="w-12"><span className="sr-only">Ações</span></TH></tr></THead>
            <TBody>
              {data.map((u) => (
                <TR key={u.id} className={u.active ? '' : 'opacity-60'}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.name}{u.id === me.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(você)</span>}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD><Badge tone={u.role === 'ADMIN' ? 'primary' : u.role === 'MANAGER' ? 'info' : 'neutral'}>{ROLE_LABELS[u.role]}</Badge></TD>
                  <TD className="hidden sm:table-cell">{u.active ? <Badge tone="success" dot>Ativo</Badge> : <Badge dot>Inativo</Badge>}</TD>
                  <TD className="hidden text-muted-foreground md:table-cell">{u.lastLoginAt ? relativeTime(u.lastLoginAt) : 'Nunca acessou'}</TD>
                  <TD>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${u.name}`}><MoreHorizontal /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setEditing(u)}><Pencil /> Editar</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setResetting(u)}><KeyRound /> Redefinir senha</DropdownMenuItem>
                        {u.id !== me.id && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem tone={u.active ? 'danger' : undefined} onSelect={() => setToggling(u)}>
                              {u.active ? <><UserX /> Desativar</> : <><UserCheck /> Reativar</>}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Matriz de permissões</CardTitle>
            <CardDescription>As permissões são verificadas no servidor a cada requisição.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <THead><tr><TH>Área</TH>{ROLES.map((r) => <TH key={r} className="text-center">{ROLE_LABELS[r]}</TH>)}</tr></THead>
            <TBody>
              {PERMISSION_GROUPS.map((g) => (
                <TR key={g.label}>
                  <TD className="font-medium">{g.label}</TD>
                  {ROLES.map((r) => {
                    const granted = g.keys.filter((k) => (ROLE_PERMISSIONS[r] as readonly string[]).includes(k));
                    const level = granted.length === 0 ? '—' : granted.length === g.keys.length ? 'Total' : granted.some((k) => k.endsWith(':read')) && granted.length === 1 ? 'Leitura' : 'Parcial';
                    return <TD key={r} className="text-center"><Badge tone={level === 'Total' ? 'success' : level === '—' ? 'neutral' : 'warning'}>{level}</Badge></TD>;
                  })}
                </TR>
              ))}
            </TBody>
          </Table>
          <ul className="grid gap-2 border-t border-border p-5 text-xs text-muted-foreground sm:grid-cols-3">
            {ROLES.map((r) => <li key={r}><strong className="text-foreground">{ROLE_LABELS[r]}:</strong> {ROLE_DESCRIPTIONS[r]}</li>)}
          </ul>
        </CardContent>
      </Card>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditUserDialog user={editing} onClose={() => setEditing(null)} isSelf={editing?.id === me.id} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        tone={toggling?.active ? 'danger' : 'primary'}
        title={toggling?.active ? 'Desativar usuário?' : 'Reativar usuário?'}
        description={toggling?.active ? <><strong className="text-foreground">{toggling.name}</strong> perderá o acesso imediatamente e todas as sessões serão encerradas.</> : <><strong className="text-foreground">{toggling?.name}</strong> poderá voltar a acessar o sistema.</>}
        confirmLabel={toggling?.active ? 'Desativar' : 'Reativar'}
        loading={toggle.isPending}
        onConfirm={() => toggling && toggle.mutate(toggling)}
      />
    </>
  );
}

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: '', email: '', role: 'OPERATOR', password: '' },
  });
  React.useEffect(() => { if (open) reset(); }, [open, reset]);
  const role = useWatch({ control, name: 'role' });
  const mutation = useMutation({
    mutationFn: (data: CreateUserInput) => api('/users', { method: 'POST', body: data }),
    onSuccess: () => { toast.success('Usuário criado.'); queryClient.invalidateQueries({ queryKey: ['users'] }); onOpenChange(false); },
    onError: (err) => handleFormError(err, setError),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Novo usuário" description="Defina uma senha inicial e compartilhe-a com a pessoa de forma segura.">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
          <div className="grid gap-4 px-6 py-5">
            <Field label="Nome" htmlFor="u-name" required error={errors.name?.message}>
              <Input id="u-name" autoFocus {...register('name')} {...errorProps('u-name', errors.name?.message)} />
            </Field>
            <Field label="E-mail" htmlFor="u-email" required error={errors.email?.message}>
              <Input id="u-email" type="email" {...register('email')} {...errorProps('u-email', errors.email?.message)} />
            </Field>
            <Field label="Função" htmlFor="u-role" required hint={ROLE_DESCRIPTIONS[role]}>
              <Select id="u-role" {...register('role')}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select>
            </Field>
            <Field label="Senha inicial" htmlFor="u-password" required error={errors.password?.message} hint="Mínimo de 8 caracteres, com maiúscula, minúscula e número.">
              <Input id="u-password" type="password" autoComplete="new-password" {...register('password')} {...errorProps('u-password', errors.password?.message)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending}>Criar usuário</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const editSchema = z.object({ name: z.string().trim().min(2, 'Informe o nome.').max(120), role: z.enum(ROLES) });

function EditUserDialog({ user, onClose, isSelf }: { user: ManagedUser | null; onClose: () => void; isSelf: boolean }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema) });
  React.useEffect(() => { if (user) reset({ name: user.name, role: user.role }); }, [user, reset]);
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof editSchema>) => api(`/users/${user!.id}`, { method: 'PATCH', body: isSelf ? { name: data.name } : data }),
    onSuccess: () => {
      toast.success('Usuário atualizado.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      onClose();
    },
    onError: (err) => handleFormError(err, setError),
  });
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Editar usuário" description={user?.email}>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
          <div className="grid gap-4 px-6 py-5">
            <Field label="Nome" htmlFor="e-name" required error={errors.name?.message}>
              <Input id="e-name" {...register('name')} {...errorProps('e-name', errors.name?.message)} />
            </Field>
            <Field label="Função" htmlFor="e-role" hint={isSelf ? 'Você não pode alterar a sua própria função.' : undefined}>
              <Select id="e-role" disabled={isSelf} {...register('role')}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const resetSchema = z.object({ password: passwordSchema });

function ResetPasswordDialog({ user, onClose }: { user: ManagedUser | null; onClose: () => void }) {
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  React.useEffect(() => { if (user) reset({ password: '' }); }, [user, reset]);
  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof resetSchema>) => api(`/users/${user!.id}/password`, { method: 'POST', body: data }),
    onSuccess: () => { toast.success('Senha redefinida. As sessões do usuário foram encerradas.'); onClose(); },
    onError: (err) => handleFormError(err, setError),
  });
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" title="Redefinir senha" description={user ? `Nova senha para ${user.name}` : undefined}>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
          <div className="px-6 py-5">
            <Field label="Nova senha" htmlFor="r-password" required error={errors.password?.message} hint="O usuário será desconectado de todos os dispositivos.">
              <Input id="r-password" type="password" autoComplete="new-password" autoFocus {...register('password')} {...errorProps('r-password', errors.password?.message)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending}>Redefinir senha</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

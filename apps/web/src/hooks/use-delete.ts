'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';

/** Mutação de exclusão padronizada com feedback e invalidação de cache. */
export function useDeleteMutation(opts: {
  path: (id: string) => string;
  invalidate: string[][];
  success: string;
  /** Após sucesso (ex.: navegar para a listagem). */
  onDone?: () => void;
  /** Após sucesso ou erro (ex.: fechar o diálogo de confirmação). */
  onSettled?: () => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(opts.path(id), { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(opts.success);
      opts.invalidate.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      opts.onDone?.();
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => opts.onSettled?.(),
  });
}

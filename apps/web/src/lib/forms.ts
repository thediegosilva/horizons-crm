import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError, errorMessage } from './api';

/**
 * Exibe erros vindos da API: erros de campo vão para o formulário, o restante vira toast.
 * Retorna true se algum erro de campo foi aplicado.
 */
export function handleFormError<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>) {
  if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
    for (const [field, messages] of Object.entries(err.fieldErrors)) {
      if (messages?.[0]) setError(field as Path<T>, { message: messages[0] });
    }
    toast.error('Verifique os campos destacados.');
    return;
  }
  toast.error(errorMessage(err));
}

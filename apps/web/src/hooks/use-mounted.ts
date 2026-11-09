import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** true apenas no cliente após a hidratação (evita divergência SSR em valores como o tema). */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

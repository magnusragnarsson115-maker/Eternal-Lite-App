import { QueryClient } from '@tanstack/react-query';

/** Wspólna pamięć podręczna zapytań — czyszczona przy zmianie profilu i wylogowaniu. */
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

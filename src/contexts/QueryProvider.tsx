// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - React Query Provider
// Wraps the app with QueryClientProvider for data fetching
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 30_000, // 30 seconds
                        gcTime: 5 * 60_000, // 5 minutes (formerly cacheTime)
                        refetchOnWindowFocus: true,
                        retry: 2,
                        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
                    },
                    mutations: {
                        retry: 1,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

import { QueryClient } from '@tanstack/react-query';

// Create a more optimized query client with longer cache times for read-heavy operations
export const createOptimizedQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Increase stale time for better caching
        staleTime: 5 * 60 * 1000, // 5 minutes
        // Keep data in cache longer
        gcTime: 30 * 60 * 1000, // 30 minutes (previously cacheTime)
        // Retry failed requests
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on window focus for data freshness
        refetchOnWindowFocus: true,
        // Don't refetch on reconnect immediately to reduce server load
        refetchOnReconnect: false,
      },
      mutations: {
        retry: 1,
        // Auto-invalidate related queries on mutations
        onSuccess: () => {
          // This will be handled by individual mutation hooks
        },
      },
    },
  });
};

// Cache invalidation patterns
export const cacheInvalidationPatterns = {
  // Invalidate all transaction-related queries
  invalidateTransactions: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['transaction-summary'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  },

  // Invalidate all account-related queries
  invalidateAccounts: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
  },

  // Invalidate reference data (payees, categories)
  invalidateReferences: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: ['payees'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  },

  // Invalidate all user data
  invalidateAll: (queryClient: QueryClient) => {
    queryClient.invalidateQueries();
  },
};

// Query key factories for consistent cache keys
export const queryKeys = {
  all: ['queries'] as const,
  
  // Transactions
  transactions: () => [...queryKeys.all, 'transactions'] as const,
  transactionList: (filters: any) => [...queryKeys.transactions(), 'list', filters] as const,
  transactionDetail: (id: string) => [...queryKeys.transactions(), 'detail', id] as const,
  transactionSummary: (filters: any) => [...queryKeys.transactions(), 'summary', filters] as const,
  
  // Accounts
  accounts: () => [...queryKeys.all, 'accounts'] as const,
  accountsList: () => [...queryKeys.accounts(), 'list'] as const,
  accountDetail: (id: string) => [...queryKeys.accounts(), 'detail', id] as const,
  
  // Payees
  payees: () => [...queryKeys.all, 'payees'] as const,
  payeesList: (search?: string) => [...queryKeys.payees(), 'list', search] as const,
  payeeDetail: (id: string) => [...queryKeys.payees(), 'detail', id] as const,
  
  // Categories
  categories: () => [...queryKeys.all, 'categories'] as const,
  categoriesList: (search?: string) => [...queryKeys.categories(), 'list', search] as const,
  categoryDetail: (id: string) => [...queryKeys.categories(), 'detail', id] as const,
  
  // Reports
  reports: () => [...queryKeys.all, 'reports'] as const,
  reportByCategory: (filters: any) => [...queryKeys.reports(), 'by-category', filters] as const,
  reportByPayee: (filters: any) => [...queryKeys.reports(), 'by-payee', filters] as const,
  reportByAccount: (filters: any) => [...queryKeys.reports(), 'by-account', filters] as const,
  reportMonthlyTrend: (filters: any) => [...queryKeys.reports(), 'monthly-trend', filters] as const,
};

// Prefetching strategies
export const prefetchStrategies = {
  // Prefetch common data when user logs in
  prefetchInitialData: async (queryClient: QueryClient) => {
    // Prefetch accounts (always needed)
    queryClient.prefetchQuery({
      queryKey: queryKeys.accountsList(),
      staleTime: 10 * 60 * 1000, // 10 minutes
    });

    // Prefetch categories and payees (frequently used in forms)
    queryClient.prefetchQuery({
      queryKey: queryKeys.categoriesList(),
      staleTime: 15 * 60 * 1000, // 15 minutes
    });

    queryClient.prefetchQuery({
      queryKey: queryKeys.payeesList(),
      staleTime: 15 * 60 * 1000, // 15 minutes
    });

    // Prefetch recent transactions (current month)
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    queryClient.prefetchQuery({
      queryKey: queryKeys.transactionList({
        page: 1,
        size: 50,
        start_date: firstDayOfMonth.toISOString().split('T')[0],
        end_date: lastDayOfMonth.toISOString().split('T')[0],
      }),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  },

  // Prefetch next page of transactions
  prefetchNextTransactionPage: (queryClient: QueryClient, currentFilters: any, currentPage: number) => {
    const nextPageFilters = { ...currentFilters, page: currentPage + 1 };
    queryClient.prefetchQuery({
      queryKey: queryKeys.transactionList(nextPageFilters),
      staleTime: 5 * 60 * 1000,
    });
  },
};

// Background sync for keeping data fresh
export const backgroundSync = {
  // Sync critical data in background
  syncCriticalData: (queryClient: QueryClient) => {
    // Silently refetch accounts to get latest balances
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.accounts(),
      refetchType: 'none' // Don't show loading state
    });
  },

  // Setup periodic background sync
  setupPeriodicSync: (queryClient: QueryClient) => {
    const interval = setInterval(() => {
      // Only sync if user is active (tab is visible)
      if (!document.hidden) {
        backgroundSync.syncCriticalData(queryClient);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(interval);
  },
};
import { QueryClient } from '@tanstack/react-query';

// Create query client with basic configuration
export const createOptimizedQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 2,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 1,
      },
    },
  });
};

// Simple cache invalidation patterns
export const cacheInvalidationPatterns = {
  invalidateTransactions: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['transaction-summary'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  },

  invalidateAccounts: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
  },

  invalidateReferences: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: ['payees'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  },

  invalidateAll: (queryClient: QueryClient) => {
    queryClient.invalidateQueries();
  },
};

// Standard query keys
export const queryKeys = {
  all: ['queries'] as const,
  
  transactions: () => [...queryKeys.all, 'transactions'] as const,
  transactionList: (filters: any) => [...queryKeys.transactions(), 'list', filters] as const,
  transactionDetail: (id: string) => [...queryKeys.transactions(), 'detail', id] as const,
  transactionSummary: (filters: any) => [...queryKeys.transactions(), 'summary', filters] as const,
  
  accounts: () => [...queryKeys.all, 'accounts'] as const,
  accountsList: () => [...queryKeys.accounts(), 'list'] as const,
  accountDetail: (id: string) => [...queryKeys.accounts(), 'detail', id] as const,
  
  payees: () => [...queryKeys.all, 'payees'] as const,
  payeesList: (search?: string) => [...queryKeys.payees(), 'list', search] as const,
  payeeDetail: (id: string) => [...queryKeys.payees(), 'detail', id] as const,
  
  categories: () => [...queryKeys.all, 'categories'] as const,
  categoriesList: (search?: string) => [...queryKeys.categories(), 'list', search] as const,
  categoryDetail: (id: string) => [...queryKeys.categories(), 'detail', id] as const,
  
  reports: () => [...queryKeys.all, 'reports'] as const,
  reportByCategory: (filters: any) => [...queryKeys.reports(), 'by-category', filters] as const,
  reportByPayee: (filters: any) => [...queryKeys.reports(), 'by-payee', filters] as const,
  reportByAccount: (filters: any) => [...queryKeys.reports(), 'by-account', filters] as const,
  reportMonthlyTrend: (filters: any) => [...queryKeys.reports(), 'monthly-trend', filters] as const,
};
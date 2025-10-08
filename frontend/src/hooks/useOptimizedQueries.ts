import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { transactionsApi, accountsApi, payeesApi, categoriesApi } from '../services/api';
import { queryKeys, cacheInvalidationPatterns } from '../services/queryConfig';
import { Transaction, Account, Payee, Category, PaginatedResponse } from '../types';
import { useToast } from '../contexts/ToastContext';

// Optimized Transactions Hooks
export const useTransactions = (
  filters?: any,
  options?: UseQueryOptions<PaginatedResponse<Transaction>>
) => {
  return useQuery({
    queryKey: queryKeys.transactionList(filters),
    queryFn: () => transactionsApi.getAll(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
};

export const useTransactionSummary = (
  filters?: any,
  options?: UseQueryOptions<any>
) => {
  return useQuery({
    queryKey: queryKeys.transactionSummary(filters),
    queryFn: () => transactionsApi.getSummary(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes - summaries change less frequently
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
};

export const useCreateTransaction = (options?: UseMutationOptions<Transaction, Error, any>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: (data, variables) => {
      showSuccess('Transaction created successfully');
      // Invalidate all transaction and account related queries
      cacheInvalidationPatterns.invalidateTransactions(queryClient);
      cacheInvalidationPatterns.invalidateAccounts(queryClient);
      
      // Optimistic update for immediate UI feedback
      const accountId = variables.account_id;
      if (accountId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.accountDetail(accountId) });
      }
    },
    onError: (error) => {
      showError(error.message || 'Failed to create transaction');
    },
    ...options,
  });
};

export const useUpdateTransaction = (options?: UseMutationOptions<Transaction, Error, { id: string; data: any }>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: ({ id, data }) => transactionsApi.update(id, data),
    onSuccess: (data, variables) => {
      showSuccess('Transaction updated successfully');
      // Invalidate transaction queries
      cacheInvalidationPatterns.invalidateTransactions(queryClient);
      cacheInvalidationPatterns.invalidateAccounts(queryClient);
      
      // Update specific transaction in cache
      queryClient.setQueryData(queryKeys.transactionDetail(variables.id), data);
    },
    onError: (error) => {
      showError(error.message || 'Failed to update transaction');
    },
    ...options,
  });
};

export const useBulkUpdateTransactions = (options?: UseMutationOptions<any, Error, { transaction_ids: string[]; updates: any }>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: ({ transaction_ids, updates }) => transactionsApi.bulkUpdate(transaction_ids, updates),
    onSuccess: (data, variables) => {
      showSuccess(`Updated ${variables.transaction_ids.length} transactions successfully`);
      // Invalidate all transaction-related queries for bulk operations
      cacheInvalidationPatterns.invalidateTransactions(queryClient);
      cacheInvalidationPatterns.invalidateAccounts(queryClient);
    },
    onError: (error) => {
      showError(error.message || 'Failed to update transactions');
    },
    ...options,
  });
};

export const useDeleteTransaction = (options?: UseMutationOptions<void, Error, string>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: transactionsApi.delete,
    onSuccess: (data, transactionId) => {
      showSuccess('Transaction deleted successfully');
      // Invalidate queries
      cacheInvalidationPatterns.invalidateTransactions(queryClient);
      cacheInvalidationPatterns.invalidateAccounts(queryClient);
      
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.transactionDetail(transactionId) });
    },
    onError: (error) => {
      showError(error.message || 'Failed to delete transaction');
    },
    ...options,
  });
};

// Optimized Accounts Hooks
export const useAccounts = (options?: UseQueryOptions<Account[]>) => {
  return useQuery({
    queryKey: queryKeys.accountsList(),
    queryFn: accountsApi.getAll,
    staleTime: 10 * 60 * 1000, // 10 minutes - account data changes less frequently
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
};

export const useAccount = (id: string, options?: UseQueryOptions<Account>) => {
  return useQuery({
    queryKey: queryKeys.accountDetail(id),
    queryFn: () => accountsApi.getById(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!id,
    ...options,
  });
};

export const useCreateAccount = (options?: UseMutationOptions<Account, Error, any>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: accountsApi.create,
    onSuccess: (data) => {
      showSuccess('Account created successfully');
      cacheInvalidationPatterns.invalidateAccounts(queryClient);
    },
    onError: (error) => {
      showError(error.message || 'Failed to create account');
    },
    ...options,
  });
};

// Optimized Payees Hooks
export const usePayees = (search?: string, options?: UseQueryOptions<Payee[]>) => {
  return useQuery({
    queryKey: queryKeys.payeesList(search),
    queryFn: () => payeesApi.getAll(search),
    staleTime: 15 * 60 * 1000, // 15 minutes - reference data changes less frequently
    gcTime: 45 * 60 * 1000, // 45 minutes
    ...options,
  });
};

export const useCreatePayee = (options?: UseMutationOptions<Payee, Error, any>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: payeesApi.create,
    onSuccess: (data) => {
      showSuccess('Payee created successfully');
      cacheInvalidationPatterns.invalidateReferences(queryClient);
    },
    onError: (error) => {
      showError(error.message || 'Failed to create payee');
    },
    ...options,
  });
};

// Optimized Categories Hooks
export const useCategories = (search?: string, options?: UseQueryOptions<Category[]>) => {
  return useQuery({
    queryKey: queryKeys.categoriesList(search),
    queryFn: () => categoriesApi.getAll(search),
    staleTime: 15 * 60 * 1000, // 15 minutes - reference data changes less frequently
    gcTime: 45 * 60 * 1000, // 45 minutes
    ...options,
  });
};

export const useCreateCategory = (options?: UseMutationOptions<Category, Error, any>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: (data) => {
      showSuccess('Category created successfully');
      cacheInvalidationPatterns.invalidateReferences(queryClient);
    },
    onError: (error) => {
      showError(error.message || 'Failed to create category');
    },
    ...options,
  });
};

// Report Hooks
export const useReportByCategory = (filters?: any, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.reportByCategory(filters),
    queryFn: () => transactionsApi.getByCategory(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
};

export const useReportByPayee = (filters?: any, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.reportByPayee(filters),
    queryFn: () => transactionsApi.getByPayee(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
};

export const useReportByAccount = (filters?: any, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.reportByAccount(filters),
    queryFn: () => transactionsApi.getByAccount(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
};

export const useReportMonthlyTrend = (filters?: any, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.reportMonthlyTrend(filters),
    queryFn: () => transactionsApi.getMonthlyTrend(filters),
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 45 * 60 * 1000, // 45 minutes
    ...options,
  });
};
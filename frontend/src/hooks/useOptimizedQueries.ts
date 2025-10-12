import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { transactionsApi, accountsApi, payeesApi, categoriesApi, insightsApi } from '../services/api';
import { queryKeys, cacheInvalidationPatterns } from '../services/queryConfig';
import { Transaction, Account, Payee, Category, PaginatedResponse, InsightResponse, FinancialDataSummary, QuestionSuggestions } from '../types';
import { useToast } from '../contexts/ToastContext';

// Transaction Hooks
export const useTransactions = (
  filters?: any,
  options?: UseQueryOptions<PaginatedResponse<Transaction>>
) => {
  return useQuery({
    queryKey: queryKeys.transactionList(filters),
    queryFn: () => transactionsApi.getAll(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useCreateTransaction = (options?: UseMutationOptions<Transaction, Error, any>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: () => {
      showSuccess('Transaction created successfully');
      cacheInvalidationPatterns.invalidateTransactions(queryClient);
      cacheInvalidationPatterns.invalidateAccounts(queryClient);
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
      cacheInvalidationPatterns.invalidateTransactions(queryClient);
      cacheInvalidationPatterns.invalidateAccounts(queryClient);
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
      cacheInvalidationPatterns.invalidateTransactions(queryClient);
      cacheInvalidationPatterns.invalidateAccounts(queryClient);
      queryClient.removeQueries({ queryKey: queryKeys.transactionDetail(transactionId) });
    },
    onError: (error) => {
      showError(error.message || 'Failed to delete transaction');
    },
    ...options,
  });
};

// Account Hooks
export const useAccounts = (options?: UseQueryOptions<Account[]>) => {
  return useQuery({
    queryKey: queryKeys.accountsList(),
    queryFn: accountsApi.getAll,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useAccount = (id: string, options?: UseQueryOptions<Account>) => {
  return useQuery({
    queryKey: queryKeys.accountDetail(id),
    queryFn: () => accountsApi.getById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
    ...options,
  });
};

export const useCreateAccount = (options?: UseMutationOptions<Account, Error, any>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: accountsApi.create,
    onSuccess: () => {
      showSuccess('Account created successfully');
      cacheInvalidationPatterns.invalidateAccounts(queryClient);
    },
    onError: (error) => {
      showError(error.message || 'Failed to create account');
    },
    ...options,
  });
};

// Payee Hooks
export const usePayees = (search?: string, options?: UseQueryOptions<Payee[]>) => {
  return useQuery({
    queryKey: queryKeys.payeesList(search),
    queryFn: () => payeesApi.getAll(search),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useCreatePayee = (options?: UseMutationOptions<Payee, Error, any>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: payeesApi.create,
    onSuccess: () => {
      showSuccess('Payee created successfully');
      cacheInvalidationPatterns.invalidateReferences(queryClient);
    },
    onError: (error) => {
      showError(error.message || 'Failed to create payee');
    },
    ...options,
  });
};

// Category Hooks
export const useCategories = (search?: string, options?: UseQueryOptions<Category[]>) => {
  return useQuery({
    queryKey: queryKeys.categoriesList(search),
    queryFn: () => categoriesApi.getAll(search),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useCreateCategory = (options?: UseMutationOptions<Category, Error, any>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
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
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useReportByPayee = (filters?: any, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.reportByPayee(filters),
    queryFn: () => transactionsApi.getByPayee(filters),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useReportByAccount = (filters?: any, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.reportByAccount(filters),
    queryFn: () => transactionsApi.getByAccount(filters),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useReportMonthlyTrend = (filters?: any, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.reportMonthlyTrend(filters),
    queryFn: () => transactionsApi.getMonthlyTrend(filters),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

// Insights Hooks
export const useAskInsight = (options?: UseMutationOptions<InsightResponse, Error, { question: string; timeframe?: string }>) => {
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: ({ question, timeframe }) => insightsApi.askQuestion(question, timeframe),
    onSuccess: () => {
      showSuccess('Insight generated successfully');
    },
    onError: (error) => {
      showError(error.message || 'Failed to generate insight');
    },
    ...options,
  });
};

export const useFinancialContext = (timeframe?: string, options?: UseQueryOptions<FinancialDataSummary>) => {
  return useQuery({
    queryKey: ['insights', 'context', timeframe],
    queryFn: () => insightsApi.getFinancialContext(timeframe),
    staleTime: 2 * 60 * 1000, // 2 minutes - financial data changes frequently
    ...options,
  });
};

export const useQuestionSuggestions = (options?: UseQueryOptions<QuestionSuggestions>) => {
  return useQuery({
    queryKey: ['insights', 'suggestions'],
    queryFn: () => insightsApi.getQuestionSuggestions(),
    staleTime: 10 * 60 * 1000, // 10 minutes - suggestions change less frequently
    ...options,
  });
};
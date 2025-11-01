import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { transactionsApi, accountsApi, payeesApi, categoriesApi, insightsApi } from '../services/api';
import { queryKeys, queryInvalidationPatterns } from '../services/queryConfig';
import { Transaction, Account, Payee, Category, PaginatedResponse, QuestionSuggestions, QueryResponse } from '../types';
import { useToast } from '../contexts/ToastContext';

// Transaction Hooks
export const useTransactions = (
  filters?: any,
  options?: UseQueryOptions<PaginatedResponse<Transaction>>
) => {
  return useQuery({
    queryKey: queryKeys.transactionList(filters),
    queryFn: () => transactionsApi.getAll(filters),
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
      queryInvalidationPatterns.invalidateTransactions(queryClient);
      queryInvalidationPatterns.invalidateAccounts(queryClient);
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
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches for transactions
      await queryClient.cancelQueries({ queryKey: ['transactions'] });

      // Get current data for enhanced optimistic updates
      const payeesData = queryClient.getQueryData(queryKeys.payeesList()) as any[];
      const categoriesData = queryClient.getQueryData(queryKeys.categoriesList()) as any[];

      // Snapshot the previous value
      const previousTransactions = queryClient.getQueriesData({ queryKey: ['transactions'] });

      // Optimistically update to the new value
      queryClient.setQueriesData(
        { queryKey: ['transactions'] },
        (oldData: any) => {
          if (!oldData?.items) return oldData;
          
          return {
            ...oldData,
            items: oldData.items.map((transaction: Transaction) => {
              if (transaction.id !== id) return transaction;
              
              const updatedTransaction = { ...transaction, ...data };
              
              // Update nested payee object if payee_id changed
              if (data.payee_id !== undefined) {
                if (data.payee_id === null) {
                  updatedTransaction.payee = null;
                } else {
                  const payee = payeesData?.find(p => p.id === data.payee_id);
                  if (payee) {
                    updatedTransaction.payee = payee;
                  }
                }
              }
              
              // Update nested category object if category_id changed
              if (data.category_id !== undefined) {
                if (data.category_id === null) {
                  updatedTransaction.category = null;
                } else {
                  const category = categoriesData?.find(c => c.id === data.category_id);
                  if (category) {
                    updatedTransaction.category = category;
                  }
                }
              }
              
              return updatedTransaction;
            })
          };
        }
      );

      // Return a context object with the snapshotted value
      return { previousTransactions };
    },
    onSuccess: (data, variables) => {
      showSuccess('Transaction updated successfully');
      queryInvalidationPatterns.invalidateTransactions(queryClient);
      queryInvalidationPatterns.invalidateAccounts(queryClient);
    },
    onError: (error, variables, context: any) => {
      showError(error.message || 'Failed to update transaction');
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state
      queryInvalidationPatterns.invalidateTransactions(queryClient);
    },
    ...options,
  });
};

export const useBulkUpdateTransactions = (options?: UseMutationOptions<any, Error, { transaction_ids: string[]; updates: any }>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: ({ transaction_ids, updates }) => transactionsApi.bulkUpdate(transaction_ids, updates),
    onMutate: async ({ transaction_ids, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['transactions'] });

      // Get current data for enhanced optimistic updates
      const payeesData = queryClient.getQueryData(queryKeys.payeesList()) as any[];
      const categoriesData = queryClient.getQueryData(queryKeys.categoriesList()) as any[];

      // Snapshot the previous value
      const previousTransactions = queryClient.getQueriesData({ queryKey: ['transactions'] });

      // Optimistically update all transaction lists
      queryClient.setQueriesData(
        { queryKey: ['transactions'] },
        (oldData: any) => {
          if (!oldData?.items) return oldData;
          
          return {
            ...oldData,
            items: oldData.items.map((transaction: Transaction) => {
              if (!transaction_ids.includes(transaction.id)) return transaction;
              
              const updatedTransaction = { ...transaction, ...updates };
              
              // Update nested payee object if payee_id changed
              if (updates.payee_id !== undefined) {
                if (updates.payee_id === null) {
                  updatedTransaction.payee = null;
                } else {
                  const payee = payeesData?.find(p => p.id === updates.payee_id);
                  if (payee) {
                    updatedTransaction.payee = payee;
                  }
                }
              }
              
              // Update nested category object if category_id changed
              if (updates.category_id !== undefined) {
                if (updates.category_id === null) {
                  updatedTransaction.category = null;
                } else {
                  const category = categoriesData?.find(c => c.id === updates.category_id);
                  if (category) {
                    updatedTransaction.category = category;
                  }
                }
              }
              
              return updatedTransaction;
            })
          };
        }
      );

      return { previousTransactions };
    },
    onSuccess: (data, variables) => {
      showSuccess(`Updated ${variables.transaction_ids.length} transactions successfully`);
      queryInvalidationPatterns.invalidateTransactions(queryClient);
      queryInvalidationPatterns.invalidateAccounts(queryClient);
    },
    onError: (error, variables, context: any) => {
      showError(error.message || 'Failed to update transactions');
      // Roll back on error
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure server state
      queryInvalidationPatterns.invalidateTransactions(queryClient);
    },
    ...options,
  });
};

export const useDeleteTransaction = (options?: UseMutationOptions<void, Error, string>) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: transactionsApi.delete,
    onMutate: async (transactionId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['transactions'] });

      // Snapshot the previous value
      const previousTransactions = queryClient.getQueriesData({ queryKey: ['transactions'] });

      // Optimistically remove the transaction
      queryClient.setQueriesData(
        { queryKey: ['transactions'] },
        (oldData: any) => {
          if (!oldData?.items) return oldData;
          
          return {
            ...oldData,
            items: oldData.items.filter((transaction: Transaction) => transaction.id !== transactionId),
            total: oldData.total - 1
          };
        }
      );

      return { previousTransactions };
    },
    onSuccess: (data, transactionId) => {
      showSuccess('Transaction deleted successfully');
      queryInvalidationPatterns.invalidateTransactions(queryClient);
      queryInvalidationPatterns.invalidateAccounts(queryClient);
    },
    onError: (error, variables, context: any) => {
      showError(error.message || 'Failed to delete transaction');
      // Roll back on error
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Always refetch to ensure server state
      queryInvalidationPatterns.invalidateTransactions(queryClient);
    },
    ...options,
  });
};

// Account Hooks
export const useAccounts = (options?: UseQueryOptions<Account[]>) => {
  return useQuery({
    queryKey: queryKeys.accountsList(),
    queryFn: accountsApi.getAll,
    ...options,
  });
};

export const useAccount = (id: string, options?: UseQueryOptions<Account>) => {
  return useQuery({
    queryKey: queryKeys.accountDetail(id),
    queryFn: () => accountsApi.getById(id),
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
      queryInvalidationPatterns.invalidateAccounts(queryClient);
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
      queryInvalidationPatterns.invalidateReferences(queryClient);
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
      queryInvalidationPatterns.invalidateReferences(queryClient);
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
    ...options,
  });
};

export const useReportByPayee = (filters?: any, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.reportByPayee(filters),
    queryFn: () => transactionsApi.getByPayee(filters),
    ...options,
  });
};

export const useReportByAccount = (filters?: any, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.reportByAccount(filters),
    queryFn: () => transactionsApi.getByAccount(filters),
    ...options,
  });
};

export const useReportMonthlyTrend = (filters?: any, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.reportMonthlyTrend(filters),
    queryFn: () => transactionsApi.getMonthlyTrend(filters),
    ...options,
  });
};

// Insights Hooks
export const useQueryData = (options?: UseMutationOptions<QueryResponse, Error, { question: string }>) => {
  const { showSuccess, showError } = useToast();

  return useMutation({
    mutationFn: ({ question }) => insightsApi.queryData(question),
    onSuccess: () => {
      showSuccess('Query executed successfully');
    },
    onError: (error) => {
      showError(error.message || 'Failed to execute query');
    },
    ...options,
  });
};

export const useQuestionSuggestions = (options?: UseQueryOptions<QuestionSuggestions>) => {
  return useQuery({
    queryKey: ['insights', 'suggestions'],
    queryFn: () => insightsApi.getQuestionSuggestions(),
    ...options,
  });
};
import { useMutation, useQuery, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

interface ApiWithToastOptions {
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

// Enhanced useMutation hook with automatic toast notifications
export function useMutationWithToast<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, TError, TVariables, TContext> & ApiWithToastOptions
) {
  const toast = useToast();
  const {
    successMessage,
    errorMessage,
    showSuccessToast = true,
    showErrorToast = true,
    onSuccess,
    onError,
    ...mutationOptions
  } = options || {};

  return useMutation({
    mutationFn,
    onSuccess: (data, variables, context) => {
      if (showSuccessToast) {
        const message = successMessage || 'Operation completed successfully';
        toast.showSuccess(message);
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (showErrorToast) {
        const message = errorMessage || (error as any)?.message || 'An error occurred';
        toast.showError(message);
      }
      onError?.(error, variables, context);
    },
    ...mutationOptions,
  });
}

// Enhanced useQuery hook with automatic error toast notifications
export function useQueryWithToast<TQueryFnData = unknown, TError = Error, TData = TQueryFnData, TQueryKey extends readonly unknown[] = readonly unknown[]>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
    errorMessage?: string;
    showErrorToast?: boolean;
  }
) {
  const toast = useToast();
  const {
    errorMessage,
    showErrorToast = true,
    ...queryOptions
  } = options;

  const result = useQuery({
    ...queryOptions,
  });

  // Show error toast when query fails
  useEffect(() => {
    if (result.error && showErrorToast) {
      const message = errorMessage || (result.error as any)?.message || 'Failed to fetch data';
      toast.showError(message);
    }
  }, [result.error, showErrorToast, errorMessage, toast]);

  return result;
}

// Specific hooks for common operations
export function useCreateWithToast<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables> & ApiWithToastOptions & {
    resourceName?: string;
  }
) {
  const { resourceName = 'item', ...restOptions } = options || {};
  
  return useMutationWithToast(mutationFn, {
    successMessage: `${resourceName} created successfully`,
    errorMessage: `Failed to create ${resourceName}`,
    ...restOptions,
  });
}

export function useUpdateWithToast<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables> & ApiWithToastOptions & {
    resourceName?: string;
  }
) {
  const { resourceName = 'item', ...restOptions } = options || {};
  
  return useMutationWithToast(mutationFn, {
    successMessage: `${resourceName} updated successfully`,
    errorMessage: `Failed to update ${resourceName}`,
    ...restOptions,
  });
}

export function useDeleteWithToast<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables> & ApiWithToastOptions & {
    resourceName?: string;
  }
) {
  const { resourceName = 'item', ...restOptions } = options || {};
  
  return useMutationWithToast(mutationFn, {
    successMessage: `${resourceName} deleted successfully`,
    errorMessage: `Failed to delete ${resourceName}`,
    ...restOptions,
  });
}

// Bulk operations
export function useBulkOperationWithToast<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables> & ApiWithToastOptions & {
    operationName?: string;
    itemCount?: number;
  }
) {
  const { operationName = 'operation', itemCount, ...restOptions } = options || {};
  const itemText = itemCount ? ` (${itemCount} items)` : '';
  
  return useMutationWithToast(mutationFn, {
    successMessage: `${operationName} completed successfully${itemText}`,
    errorMessage: `${operationName} failed${itemText}`,
    ...restOptions,
  });
}
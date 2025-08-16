import { useMutation, useQuery, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useEffect } from 'react';

interface ApiWithConfirmOptions {
  successMessage?: string;
  errorMessage?: string;
  showSuccessDialog?: boolean;
  showErrorDialog?: boolean;
}

// Enhanced useMutation hook with automatic confirm dialogs
export function useMutationWithConfirm<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, TError, TVariables, TContext> & ApiWithConfirmOptions
) {
  const {
    successMessage,
    errorMessage,
    showSuccessDialog = true,
    showErrorDialog = true,
    onSuccess,
    onError,
    ...mutationOptions
  } = options || {};

  return useMutation({
    mutationFn,
    onSuccess: (data, variables, context) => {
      if (showSuccessDialog) {
        const message = successMessage || 'Operation completed successfully';
        window.alert(message);
      }
      onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      if (showErrorDialog) {
        const message = errorMessage || (error as any)?.message || 'An error occurred';
        window.alert(`Error: ${message}`);
      }
      onError?.(error, variables, context);
    },
    ...mutationOptions,
  });
}

// Enhanced useQuery hook with automatic error dialog notifications
export function useQueryWithConfirm<TQueryFnData = unknown, TError = Error, TData = TQueryFnData, TQueryKey extends readonly unknown[] = readonly unknown[]>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
    errorMessage?: string;
    showErrorDialog?: boolean;
  }
) {
  const {
    errorMessage,
    showErrorDialog = true,
    ...queryOptions
  } = options;

  const result = useQuery({
    ...queryOptions,
  });

  // Show error dialog when query fails
  useEffect(() => {
    if (result.error && showErrorDialog) {
      const message = errorMessage || (result.error as any)?.message || 'Failed to fetch data';
      window.alert(`Error: ${message}`);
    }
  }, [result.error, showErrorDialog, errorMessage]);

  return result;
}

// Specific hooks for common operations
export function useCreateWithConfirm<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables> & ApiWithConfirmOptions & {
    resourceName?: string;
  }
) {
  const { resourceName = 'item', ...restOptions } = options || {};
  
  return useMutationWithConfirm(mutationFn, {
    successMessage: `${resourceName} created successfully`,
    errorMessage: `Failed to create ${resourceName}`,
    ...restOptions,
  });
}

export function useUpdateWithConfirm<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables> & ApiWithConfirmOptions & {
    resourceName?: string;
  }
) {
  const { resourceName = 'item', ...restOptions } = options || {};
  
  return useMutationWithConfirm(mutationFn, {
    successMessage: `${resourceName} updated successfully`,
    errorMessage: `Failed to update ${resourceName}`,
    ...restOptions,
  });
}

export function useDeleteWithConfirm<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables> & ApiWithConfirmOptions & {
    resourceName?: string;
  }
) {
  const { resourceName = 'item', ...restOptions } = options || {};
  
  return useMutationWithConfirm(mutationFn, {
    successMessage: `${resourceName} deleted successfully`,
    errorMessage: `Failed to delete ${resourceName}`,
    ...restOptions,
  });
}
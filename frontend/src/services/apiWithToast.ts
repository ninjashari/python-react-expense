import axios from 'axios';
import { accountsApi, payeesApi, categoriesApi, transactionsApi, importApi } from './api';
import { authService } from './authApi';

// Enhanced API functions that work with toast notifications
export const createEnhancedApi = (toast: any) => {
  return {
    // Accounts API with toast notifications
    accounts: {
      getAll: async () => {
        try {
          const result = await accountsApi.getAll();
          return result;
        } catch (error) {
          toast.showError(`Failed to load accounts: ${(error as Error).message}`);
          throw error;
        }
      },

      create: async (data: any) => {
        try {
          const result = await accountsApi.create(data);
          toast.showSuccess(`Account "${data.name}" created successfully`);
          return result;
        } catch (error) {
          toast.showError(`Failed to create account: ${(error as Error).message}`);
          throw error;
        }
      },

      update: async (id: string, data: any) => {
        try {
          const result = await accountsApi.update(id, data);
          toast.showSuccess(`Account updated successfully`);
          return result;
        } catch (error) {
          toast.showError(`Failed to update account: ${(error as Error).message}`);
          throw error;
        }
      },

      delete: async (id: string) => {
        try {
          const result = await accountsApi.delete(id);
          toast.showSuccess('Account deleted successfully');
          return result;
        } catch (error) {
          toast.showError(`Failed to delete account: ${(error as Error).message}`);
          throw error;
        }
      },
    },

    // Transactions API with toast notifications
    transactions: {
      getAll: async (params?: any) => {
        try {
          return await transactionsApi.getAll(params);
        } catch (error) {
          toast.showError(`Failed to load transactions: ${(error as Error).message}`);
          throw error;
        }
      },

      create: async (data: any) => {
        try {
          const result = await transactionsApi.create(data);
          const typeText = data.type === 'transfer' ? 'Transfer' : 
                          data.type === 'deposit' ? 'Deposit' : 'Withdrawal';
          toast.showSuccess(`${typeText} of ${data.amount} recorded successfully`);
          return result;
        } catch (error) {
          toast.showError(`Failed to create transaction: ${(error as Error).message}`);
          throw error;
        }
      },

      update: async (id: string, data: any) => {
        try {
          const result = await transactionsApi.update(id, data);
          toast.showSuccess('Transaction updated successfully');
          return result;
        } catch (error) {
          toast.showError(`Failed to update transaction: ${(error as Error).message}`);
          throw error;
        }
      },

      delete: async (id: string) => {
        try {
          const result = await transactionsApi.delete(id);
          toast.showSuccess('Transaction deleted successfully');
          return result;
        } catch (error) {
          toast.showError(`Failed to delete transaction: ${(error as Error).message}`);
          throw error;
        }
      },

      bulkDelete: async (ids: string[]) => {
        try {
          await Promise.all(ids.map(id => transactionsApi.delete(id)));
          toast.showSuccess(`${ids.length} transactions deleted successfully`);
        } catch (error) {
          toast.showError(`Failed to delete transactions: ${(error as Error).message}`);
          throw error;
        }
      },
    },

    // Categories API with toast notifications
    categories: {
      getAll: async (search?: string) => {
        try {
          return await categoriesApi.getAll(search);
        } catch (error) {
          toast.showError(`Failed to load categories: ${(error as Error).message}`);
          throw error;
        }
      },

      create: async (data: any) => {
        try {
          const result = await categoriesApi.create(data);
          toast.showSuccess(`Category "${data.name}" created successfully`);
          return result;
        } catch (error) {
          toast.showError(`Failed to create category: ${(error as Error).message}`);
          throw error;
        }
      },

      update: async (id: string, data: any) => {
        try {
          const result = await categoriesApi.update(id, data);
          toast.showSuccess('Category updated successfully');
          return result;
        } catch (error) {
          toast.showError(`Failed to update category: ${(error as Error).message}`);
          throw error;
        }
      },

      delete: async (id: string) => {
        try {
          const result = await categoriesApi.delete(id);
          toast.showSuccess('Category deleted successfully');
          return result;
        } catch (error) {
          toast.showError(`Failed to delete category: ${(error as Error).message}`);
          throw error;
        }
      },
    },

    // Payees API with toast notifications
    payees: {
      getAll: async (search?: string) => {
        try {
          return await payeesApi.getAll(search);
        } catch (error) {
          toast.showError(`Failed to load payees: ${(error as Error).message}`);
          throw error;
        }
      },

      create: async (data: any) => {
        try {
          const result = await payeesApi.create(data);
          toast.showSuccess(`Payee "${data.name}" created successfully`);
          return result;
        } catch (error) {
          toast.showError(`Failed to create payee: ${(error as Error).message}`);
          throw error;
        }
      },

      update: async (id: string, data: any) => {
        try {
          const result = await payeesApi.update(id, data);
          toast.showSuccess('Payee updated successfully');
          return result;
        } catch (error) {
          toast.showError(`Failed to update payee: ${(error as Error).message}`);
          throw error;
        }
      },

      delete: async (id: string) => {
        try {
          const result = await payeesApi.delete(id);
          toast.showSuccess('Payee deleted successfully');
          return result;
        } catch (error) {
          toast.showError(`Failed to delete payee: ${(error as Error).message}`);
          throw error;
        }
      },
    },


    // Import API with toast notifications
    import: {
      importCsv: async (formData: FormData) => {
        try {
          const result = await importApi.importCsv(formData);
          const count = result.transactions_created || 0;
          toast.showSuccess(`Successfully imported ${count} transactions from CSV`);
          return result;
        } catch (error) {
          toast.showError(`Failed to import CSV: ${(error as Error).message}`);
          throw error;
        }
      },

      importExcel: async (formData: FormData) => {
        try {
          const result = await importApi.importExcel(formData);
          const count = result.transactions_created || 0;
          toast.showSuccess(`Successfully imported ${count} transactions from Excel`);
          return result;
        } catch (error) {
          toast.showError(`Failed to import Excel: ${(error as Error).message}`);
          throw error;
        }
      },

      importPdfOcr: async (formData: FormData) => {
        try {
          const result = await importApi.importPdfOcr(formData);
          toast.showSuccess('PDF processed successfully. Please review the extracted data.');
          return result;
        } catch (error) {
          toast.showError(`Failed to process PDF: ${(error as Error).message}`);
          throw error;
        }
      },
    },

    // Auth API with toast notifications (if needed beyond context)
    auth: {
      login: async (credentials: any) => {
        try {
          const result = await authService.login(credentials);
          // Toast handled in AuthContext
          return result;
        } catch (error) {
          // Error toast handled in AuthContext
          throw error;
        }
      },

      register: async (data: any) => {
        try {
          const result = await authService.register(data);
          // Toast handled in AuthContext
          return result;
        } catch (error) {
          // Error toast handled in AuthContext
          throw error;
        }
      },

      getCurrentUser: async (token: string) => {
        try {
          return await authService.getCurrentUser(token);
        } catch (error) {
          if ((error as any).message?.includes('Session expired')) {
            toast.showWarning('Your session has expired. Please log in again.');
          }
          throw error;
        }
      },
    },
  };
};
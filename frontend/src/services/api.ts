import axios from 'axios';
import {
  Account,
  Payee,
  Category,
  Transaction,
  CreateAccountDto,
  CreatePayeeDto,
  CreateCategoryDto,
  CreateTransactionDto
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle authentication errors
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
      return Promise.reject(new Error('Session expired. Please login again.'));
    }
    
    // Handle common HTTP errors with user-friendly messages
    if (error.response?.status === 403) {
      return Promise.reject(new Error('You do not have permission to perform this action.'));
    }
    
    if (error.response?.status === 404) {
      return Promise.reject(new Error('The requested resource was not found.'));
    }
    
    if (error.response?.status === 422) {
      // Validation errors
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        const messages = detail.map((err: any) => `${err.loc?.join(' → ') || 'Field'}: ${err.msg}`);
        return Promise.reject(new Error(`Validation error: ${messages.join(', ')}`));
      }
      return Promise.reject(new Error(detail || 'Validation error. Please check your input.'));
    }
    
    if (error.response?.status === 429) {
      return Promise.reject(new Error('Too many requests. Please wait a moment and try again.'));
    }
    
    if (error.response?.status >= 500) {
      return Promise.reject(new Error('Server error. Please try again later.'));
    }
    
    // Return specific error message if available
    if (error.response?.data?.detail) {
      return Promise.reject(new Error(error.response.data.detail));
    }
    
    // Network error or CORS error
    if (!error.response) {
      if (error.code === 'ERR_NETWORK') {
        return Promise.reject(new Error('Network error or CORS issue. Please check your internet connection and ensure the API server is running.'));
      }
      return Promise.reject(new Error('Network error. Please check your internet connection.'));
    }
    
    // Generic error
    return Promise.reject(new Error('An unexpected error occurred. Please try again.'));
  }
);

// Accounts API
export const accountsApi = {
  getAll: (): Promise<Account[]> => api.get('/accounts').then(res => res.data),
  getById: (id: string): Promise<Account> => api.get(`/accounts/${id}`).then(res => res.data),
  create: (data: CreateAccountDto): Promise<Account> => api.post('/accounts', data).then(res => res.data),
  update: (id: string, data: Partial<CreateAccountDto>): Promise<Account> => 
    api.put(`/accounts/${id}`, data).then(res => res.data),
  delete: (id: string): Promise<void> => api.delete(`/accounts/${id}`).then(res => res.data),
  recalculateBalances: (): Promise<any> => api.post('/accounts/recalculate-balances').then(res => res.data),
};

// Payees API
export const payeesApi = {
  getAll: (search?: string): Promise<Payee[]> => 
    api.get('/payees', { params: { search } }).then(res => res.data),
  getById: (id: string): Promise<Payee> => api.get(`/payees/${id}`).then(res => res.data),
  create: (data: CreatePayeeDto): Promise<Payee> => api.post('/payees', data).then(res => res.data),
  update: (id: string, data: Partial<CreatePayeeDto>): Promise<Payee> => 
    api.put(`/payees/${id}`, data).then(res => res.data),
  delete: (id: string): Promise<void> => api.delete(`/payees/${id}`).then(res => res.data),
  reassignColors: (): Promise<any> => api.post('/payees/reassign-colors').then(res => res.data),
  deleteUnused: (): Promise<any> => api.delete('/payees/unused').then(res => res.data),
};

// Categories API
export const categoriesApi = {
  getAll: (search?: string): Promise<Category[]> => 
    api.get('/categories', { params: { search } }).then(res => res.data),
  getById: (id: string): Promise<Category> => api.get(`/categories/${id}`).then(res => res.data),
  create: (data: CreateCategoryDto): Promise<Category> => api.post('/categories', data).then(res => res.data),
  update: (id: string, data: Partial<CreateCategoryDto>): Promise<Category> => 
    api.put(`/categories/${id}`, data).then(res => res.data),
  delete: (id: string): Promise<void> => api.delete(`/categories/${id}`).then(res => res.data),
  reassignColors: (): Promise<any> => api.post('/categories/reassign-colors').then(res => res.data),
  deleteUnused: (): Promise<any> => api.delete('/categories/unused').then(res => res.data),
};

// Transactions API
export const transactionsApi = {
  getAll: (params?: {
    page?: number;
    size?: number;
    account_ids?: string;
    category_ids?: string;
    payee_ids?: string;
    transaction_type?: string;
    start_date?: string;
    end_date?: string;
  }) => api.get('/transactions', { params }).then(res => res.data),
  getSummary: (params?: {
    account_ids?: string;
    category_ids?: string;
    payee_ids?: string;
    transaction_type?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<any> => api.get('/transactions/summary', { params }).then(res => res.data),
  getById: (id: string): Promise<Transaction> => api.get(`/transactions/${id}`).then(res => res.data),
  create: (data: CreateTransactionDto): Promise<Transaction> => 
    api.post('/transactions', data).then(res => res.data),
  update: (id: string, data: Partial<CreateTransactionDto>): Promise<Transaction> => 
    api.put(`/transactions/${id}`, data).then(res => res.data),
  bulkUpdate: (transaction_ids: string[], updates: any): Promise<any> => 
    api.put('/transactions/bulk', { transaction_ids, updates }).then(res => res.data),
  delete: (id: string): Promise<void> => api.delete(`/transactions/${id}`).then(res => res.data),
  recalculateAccountBalances: (accountId: string): Promise<any> => 
    api.post(`/transactions/recalculate-balances/${accountId}`).then(res => res.data),
  cleanupDescriptions: (filters?: any): Promise<any> => 
    api.post('/transactions/cleanup-descriptions', filters || {}).then(res => res.data),
  clearFields: (filters?: any): Promise<any> => 
    api.post('/transactions/clear-fields', filters || {}).then(res => res.data),
  exportToExcel: (params?: {
    account_ids?: string;
    category_ids?: string;
    payee_ids?: string;
    transaction_type?: string;
    start_date?: string;
    end_date?: string;
  }) => api.get('/transactions/export', { 
    params, 
    responseType: 'blob' 
  }).then(res => res),
};


// Import API
export const importApi = {
  importCsv: (formData: FormData): Promise<any> => 
    api.post('/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),
  
  importExcel: (formData: FormData): Promise<any> => 
    api.post('/import/excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),
  
  importPdfOcr: (formData: FormData): Promise<any> => 
    api.post('/import/pdf-ocr', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),
  
  // PDF LLM Import APIs
  getPdfLlmStatus: (): Promise<any> => 
    api.get('/import/pdf-llm/status').then(res => res.data),
  
  previewPdfLlm: (formData: FormData): Promise<any> => 
    api.post('/import/pdf-llm/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),
  
  importPdfLlm: (formData: FormData): Promise<any> => 
    api.post('/import/pdf-llm', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),

  // XLS LLM Import APIs
  getXlsLlmStatus: (): Promise<any> => 
    api.get('/import/xls-llm/status').then(res => res.data),
  
  previewXlsLlm: (formData: FormData): Promise<any> => 
    api.post('/import/xls-llm/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),
  
  importXlsLlm: (formData: FormData): Promise<any> => 
    api.post('/import/xls-llm', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),
  
  getColumnMapping: (formData: FormData, fileType: string): Promise<any> => 
    api.post(`/import/column-mapping/${fileType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),
  
  // Batch import pre-processed transactions
  importTransactionsBatch: (transactionsData: any[], accountId: string): Promise<any> => 
    api.post('/import/transactions/batch', { 
      transactions_data: transactionsData, 
      account_id: accountId 
    }).then(res => res.data),
};

export default api;
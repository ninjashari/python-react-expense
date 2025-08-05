import axios from 'axios';
import {
  Account,
  Payee,
  Category,
  Transaction,
  CreateAccountDto,
  CreatePayeeDto,
  CreateCategoryDto,
  CreateTransactionDto,
  ReportSummary,
  CategoryReport,
  PayeeReport,
  AccountReport,
  MonthlyTrend
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
  getById: (id: number): Promise<Account> => api.get(`/accounts/${id}`).then(res => res.data),
  create: (data: CreateAccountDto): Promise<Account> => api.post('/accounts', data).then(res => res.data),
  update: (id: number, data: Partial<CreateAccountDto>): Promise<Account> => 
    api.put(`/accounts/${id}`, data).then(res => res.data),
  delete: (id: number): Promise<void> => api.delete(`/accounts/${id}`).then(res => res.data),
  recalculateBalances: (): Promise<any> => api.post('/accounts/recalculate-balances').then(res => res.data),
};

// Payees API
export const payeesApi = {
  getAll: (search?: string): Promise<Payee[]> => 
    api.get('/payees', { params: { search } }).then(res => res.data),
  getById: (id: number): Promise<Payee> => api.get(`/payees/${id}`).then(res => res.data),
  create: (data: CreatePayeeDto): Promise<Payee> => api.post('/payees', data).then(res => res.data),
  update: (id: number, data: Partial<CreatePayeeDto>): Promise<Payee> => 
    api.put(`/payees/${id}`, data).then(res => res.data),
  delete: (id: number): Promise<void> => api.delete(`/payees/${id}`).then(res => res.data),
};

// Categories API
export const categoriesApi = {
  getAll: (search?: string): Promise<Category[]> => 
    api.get('/categories', { params: { search } }).then(res => res.data),
  getById: (id: number): Promise<Category> => api.get(`/categories/${id}`).then(res => res.data),
  create: (data: CreateCategoryDto): Promise<Category> => api.post('/categories', data).then(res => res.data),
  update: (id: number, data: Partial<CreateCategoryDto>): Promise<Category> => 
    api.put(`/categories/${id}`, data).then(res => res.data),
  delete: (id: number): Promise<void> => api.delete(`/categories/${id}`).then(res => res.data),
};

// Transactions API
export const transactionsApi = {
  getAll: (params?: {
    skip?: number;
    limit?: number;
    account_id?: number;
    category_id?: number;
    payee_id?: number;
    transaction_type?: string;
  }): Promise<Transaction[]> => api.get('/transactions', { params }).then(res => res.data),
  getById: (id: number): Promise<Transaction> => api.get(`/transactions/${id}`).then(res => res.data),
  create: (data: CreateTransactionDto): Promise<Transaction> => 
    api.post('/transactions', data).then(res => res.data),
  update: (id: number, data: Partial<CreateTransactionDto>): Promise<Transaction> => 
    api.put(`/transactions/${id}`, data).then(res => res.data),
  delete: (id: number): Promise<void> => api.delete(`/transactions/${id}`).then(res => res.data),
};

// Reports API
export const reportsApi = {
  getSummary: (params?: {
    start_date?: string;
    end_date?: string;
    account_ids?: number[];
    category_ids?: number[];
    payee_ids?: number[];
  }): Promise<ReportSummary> => api.get('/reports/summary', { params }).then(res => res.data),
  
  getByCategory: (params?: {
    start_date?: string;
    end_date?: string;
    account_ids?: number[];
    transaction_type?: string;
  }): Promise<CategoryReport[]> => api.get('/reports/by-category', { params }).then(res => res.data),
  
  getByPayee: (params?: {
    start_date?: string;
    end_date?: string;
    account_ids?: number[];
    transaction_type?: string;
  }): Promise<PayeeReport[]> => api.get('/reports/by-payee', { params }).then(res => res.data),
  
  getByAccount: (params?: {
    start_date?: string;
    end_date?: string;
    category_ids?: number[];
    payee_ids?: number[];
    transaction_type?: string;
  }): Promise<AccountReport[]> => api.get('/reports/by-account', { params }).then(res => res.data),
  
  getMonthlyTrend: (params?: {
    start_date?: string;
    end_date?: string;
    account_ids?: number[];
  }): Promise<MonthlyTrend[]> => api.get('/reports/monthly-trend', { params }).then(res => res.data),
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
  
  getColumnMapping: (formData: FormData, fileType: string): Promise<any> => 
    api.post(`/import/column-mapping/${fileType}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),
};

export default api;
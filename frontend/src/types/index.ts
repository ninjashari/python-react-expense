export interface Account {
  id: number;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment';
  balance: number;
  opening_date: string;
  credit_limit?: number;
  bill_generation_date?: number;
  payment_due_date?: number;
  created_at: string;
  updated_at?: string;
}

export interface Payee {
  id: number;
  name: string;
  created_at: string;
  updated_at?: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  created_at: string;
  updated_at?: string;
}

export interface Transaction {
  id: number;
  date: string;
  amount: number;
  description?: string;
  type: 'income' | 'expense' | 'transfer';
  account_id: number;
  to_account_id?: number;
  payee_id?: number;
  category_id?: number;
  created_at: string;
  updated_at?: string;
  account?: Account;
  to_account?: Account;
  payee?: Payee;
  category?: Category;
}

export interface CreateAccountDto {
  name: string;
  type: Account['type'];
  balance?: number;
  opening_date: string;
  credit_limit?: number;
  bill_generation_date?: number;
  payment_due_date?: number;
}

export interface CreatePayeeDto {
  name: string;
}

export interface CreateCategoryDto {
  name: string;
  color?: string;
}

export interface CreateTransactionDto {
  date: string;
  amount: number;
  description?: string;
  type: Transaction['type'];
  account_id: number;
  to_account_id?: number;
  payee_id?: number;
  category_id?: number;
}

export interface ReportSummary {
  total_income: number;
  total_expenses: number;
  total_transfers: number;
  net_income: number;
  transaction_count: number;
}

export interface CategoryReport {
  category_name: string;
  category_color: string;
  total_amount: number;
  transaction_count: number;
}

export interface PayeeReport {
  payee_name: string;
  total_amount: number;
  transaction_count: number;
}

export interface AccountReport {
  account_name: string;
  account_type: string;
  total_amount: number;
  transaction_count: number;
}

export interface MonthlyTrend {
  month: string;
  transaction_type: string;
  total_amount: number;
}

// PDF LLM Import Types
export interface LLMTransactionData {
  date: string;
  amount: number;
  description: string;
  transaction_type: string;
  payee?: string;
  category?: string;
  confidence: number;
}

export interface PDFLLMSystemStatus {
  pdf_processor: string;
  ollama_service: string;
  available_models: string[];
  recommended_models: string[];
}

export interface PDFLLMPreviewResponse {
  extraction_method: string;
  text_length: number;
  has_financial_data: boolean;
  estimated_processing_time: number;
  preview_text: string;
  error?: string;
}

export interface PDFLLMImportResponse {
  status: string;
  extraction_method: string;
  extracted_text: string;
  transactions: LLMTransactionData[];
  processing_notes: string[];
  transaction_count?: number;
  transactions_created?: number;
  import_errors?: string[];
  message?: string;
  error?: string;
}
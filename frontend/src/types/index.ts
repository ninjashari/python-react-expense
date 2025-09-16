export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'ppf';
  balance: number;
  opening_date: string;
  
  // Account details
  account_number?: string;
  
  // Card details
  card_number?: string;  // Last 4 digits only for security
  card_expiry_month?: number;  // 1-12
  card_expiry_year?: number;   // YYYY format
  
  // Credit card specific fields
  credit_limit?: number;
  bill_generation_date?: number;
  payment_due_date?: number;
  
  // PPF specific fields
  interest_rate?: number;  // Annual interest rate percentage
  
  created_at: string;
  updated_at?: string;
}

export interface Payee {
  id: string;
  name: string;
  color?: string;
  created_at: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at?: string;
}

export interface TransactionSplit {
  id?: string;
  category_id: string;
  amount: number;
  description?: string;
  category?: Category;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description?: string;
  type: 'income' | 'expense' | 'transfer';
  account_id: string;
  to_account_id?: string;
  payee_id?: string;
  category_id?: string;
  balance_after_transaction?: number;
  to_account_balance_after?: number;
  created_at: string;
  updated_at?: string;
  account?: Account;
  to_account?: Account;
  payee?: Payee;
  category?: Category;
  splits?: TransactionSplit[];
  is_split?: boolean;
}

export interface CreateAccountDto {
  name: string;
  type: Account['type'];
  balance?: number;
  opening_date: string;
  
  // Account details
  account_number?: string;
  
  // Card details
  card_number?: string;
  card_expiry_month?: number;
  card_expiry_year?: number;
  
  // Credit card specific fields
  credit_limit?: number;
  bill_generation_date?: number;
  payment_due_date?: number;
  
  // PPF specific fields
  interest_rate?: number;
}

export interface CreatePayeeDto {
  name: string;
  color?: string;
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
  account_id: string;
  to_account_id?: string;
  payee_id?: string;
  category_id?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface TransactionSummary {
  total_income: number;
  total_expense: number;
  net_amount: number;
  transaction_count: number;
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

// XLS LLM Import Types
export interface XLSLLMSystemStatus {
  xls_processor: string;
  ollama_service: string;
  available_models: string[];
  recommended_models: string[];
  supported_formats: string[];
}

export interface XLSLLMPreviewResponse {
  extraction_method: string;
  text_length: number;
  has_financial_data: boolean;
  estimated_processing_time: number;
  preview_text: string;
  file_info: any;
  sheet_count: number;
  error?: string;
}

export interface XLSLLMImportResponse {
  status: string;
  extraction_method: string;
  extracted_text: string;
  transactions: LLMTransactionData[];
  processing_notes: string[];
  file_info: any;
  transaction_count?: number;
  transactions_created?: number;
  import_errors?: string[];
  ai_predictions_made?: number;
  training_stats?: any;
  message?: string;
  error?: string;
}
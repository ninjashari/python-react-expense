import React, { useState } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  Autocomplete,
  Chip,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import { Add, Edit, Delete, FilterList, Clear, ArrowUpward, ArrowDownward, CleaningServices, Calculate } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { transactionsApi, accountsApi, payeesApi, categoriesApi } from '../services/api';
import { Transaction, CreateTransactionDto, PaginatedResponse } from '../types';
import { formatCurrency } from '../utils/formatters';
import { useCreateWithConfirm, useUpdateWithConfirm, useDeleteWithConfirm } from '../hooks/useApiWithConfirm';
import { useToast } from '../contexts/ToastContext';
import { usePageTitle, getPageTitle } from '../hooks/usePageTitle';
import SmartInlineEdit from '../components/SmartInlineEdit';
import SmartAutocomplete from '../components/SmartAutocomplete';
import SmartAutomation from '../components/SmartAutomation';
import InlineTextEdit from '../components/InlineTextEdit';
import InlineDateEdit from '../components/InlineDateEdit';
import InlineToggleEdit from '../components/InlineToggleEdit';
import { useEnhancedSuggestions, useLearningMetrics } from '../hooks/useLearning';
import { usePersistentFilters } from '../hooks/usePersistentFilters';

// Resizable TableCell component
const ResizableTableCell = ({ 
  children, 
  column, 
  width, 
  onResizeStart, 
  isResizing,
  ...props 
}: any) => (
  <TableCell
    {...props}
    sx={{
      ...props.sx,
      width: width,
      minWidth: width,
      maxWidth: width,
      position: 'relative',
      userSelect: isResizing ? 'none' : 'auto',
      '&:hover .resize-handle': {
        opacity: 1,
      }
    }}
  >
    {children}
    <Box
      className="resize-handle"
      sx={{
        position: 'absolute',
        top: 0,
        right: -2,
        width: 4,
        height: '100%',
        cursor: 'col-resize',
        opacity: 0,
        transition: 'opacity 0.2s',
        backgroundColor: 'primary.main',
        zIndex: 10,
        '&:hover': {
          opacity: 1,
          backgroundColor: 'primary.dark',
        }
      }}
      onMouseDown={(e) => onResizeStart(e, column)}
    />
  </TableCell>
);

const transactionTypes = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' },
];

const transactionTypeOptions = [
  { value: 'income', label: 'Income', color: 'success' as const },
  { value: 'expense', label: 'Expense', color: 'error' as const },
  { value: 'transfer', label: 'Transfer', color: 'info' as const },
];

const pageSizeOptions = [
  { value: 10, label: '10 per page' },
  { value: 20, label: '20 per page' },
  { value: 50, label: '50 per page' },
  { value: 100, label: '100 per page' },
  { value: 200, label: '200 per page' },
];

interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  categoryIds?: string[];
  payeeIds?: string[];
  page: number;
  size: number;
  showAll: boolean;
  sortField?: SortField;
  sortDirection: SortDirection;
}

type SortField = 'date' | 'description' | 'account' | 'payee' | 'category' | 'type' | 'amount';
type SortDirection = 'asc' | 'desc';

// SortState is now part of TransactionFilters interface

const Transactions: React.FC = () => {
  usePageTitle(getPageTitle('transactions', 'Income & Expenses'));
  const { showError } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const defaultFilters: TransactionFilters = {
    page: 1,
    size: 50,
    showAll: false,
    sortDirection: 'asc' as SortDirection
  };
  
  const { filters, setFilters, clearSavedFilters } = usePersistentFilters<TransactionFilters>(
    'transactions-filters',
    defaultFilters
  );
  
  // showAll is now managed in persistent filters

  // Initialize month/year dropdowns based on existing filter dates
  React.useEffect(() => {
    if (filters.startDate) {
      const date = new Date(filters.startDate);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString();
      setSelectedMonth(month);
      setSelectedYear(year);
    }
  }, [filters.startDate]); // Re-run when startDate changes
  const [showFilters, setShowFilters] = useState(false);
  const [savingTransactions, setSavingTransactions] = useState<Set<string>>(new Set());
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  
  // Column width management
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('transactions-column-widths');
    return saved ? JSON.parse(saved) : {
      checkbox: 60,
      date: 120,
      description: 250,
      account: 150,
      payee: 150,
      category: 150,
      type: 100,
      amount: 120,
      balance: 120,
      actions: 100
    };
  });
  const [isResizing, setIsResizing] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [bulkCategoryDialogOpen, setBulkCategoryDialogOpen] = useState(false);
  const [selectedCategoryForBulk, setSelectedCategoryForBulk] = useState<string>('');
  const [bulkPayeeDialogOpen, setBulkPayeeDialogOpen] = useState(false);
  const [selectedPayeeForBulk, setSelectedPayeeForBulk] = useState<string>('');
  const [bulkUpdateDialogOpen, setBulkUpdateDialogOpen] = useState(false);
  // sortState is now managed in persistent filters
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [isRecalculatingBalances, setIsRecalculatingBalances] = useState(false);
  const [recalculateResult, setRecalculateResult] = useState<any>(null);
  const [recalculateDialogOpen, setRecalculateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<CreateTransactionDto>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      description: '',
      type: 'expense',
      account_id: '',
    },
  });

  const watchTransactionType = watch('type');

  const { data: transactionData, isLoading: transactionsLoading } = useQuery<PaginatedResponse<Transaction>>({
    queryKey: ['transactions', filters],
    queryFn: () => transactionsApi.getAll({ 
      page: filters.showAll ? 1 : filters.page,
      size: filters.showAll ? 10000 : filters.size, // Use large number for show all
      start_date: filters.startDate,
      end_date: filters.endDate,
      account_ids: filters.accountId,
      category_ids: filters.categoryIds?.join(','),
      payee_ids: filters.payeeIds?.join(','),
    }),
  });


  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const { data: payees } = useQuery({
    queryKey: ['payees'],
    queryFn: () => payeesApi.getAll(),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll(),
  });

  // Smart suggestions state
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState<number | undefined>();
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const { trackSuggestionShown, trackSuggestionAccepted } = useLearningMetrics();
  
  // Get enhanced suggestions for form (only when dialog is open)
  const {
    data: formSuggestions,
    isLoading: suggestionsLoading
  } = useEnhancedSuggestions(
    dialogOpen ? formDescription : '',
    dialogOpen ? formAmount : undefined,
    dialogOpen ? selectedAccount?.id : undefined,
    dialogOpen ? selectedAccount?.type : undefined,
    dialogOpen ? (payees || []) : [],
    dialogOpen ? (categories || []) : []
  );

  const createMutation = useCreateWithConfirm(transactionsApi.create, {
    resourceName: 'Transaction',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useUpdateWithConfirm(
    ({ id, data }: { id: string; data: Partial<CreateTransactionDto> }) =>
      transactionsApi.update(id, data),
    {
      resourceName: 'Transaction',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        handleCloseDialog();
      },
    }
  );

  const deleteMutation = useDeleteWithConfirm(transactionsApi.delete, {
    resourceName: 'Transaction',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const bulkUpdateMutation = useUpdateWithConfirm(
    ({ transaction_ids, updates }: { transaction_ids: string[]; updates: any }) =>
      transactionsApi.bulkUpdate(transaction_ids, updates),
    {
      resourceName: 'Transactions',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
      },
    }
  );

  // Inline editing functions
  const handleInlineUpdate = async (transactionId: string, field: 'category_id' | 'payee_id' | 'description' | 'type' | 'date', value: string | null) => {
    setSavingTransactions(prev => new Set(prev).add(transactionId));
    
    try {
      const updateData = { [field]: value || undefined };
      await updateMutation.mutateAsync({
        id: transactionId,
        data: updateData
      });
    } catch (error) {
      // Error handling is already done by the mutation hook
    } finally {
      setSavingTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
  };

  const handleInlineCategoryChange = async (transactionId: string, categoryId: string | null) => {
    await handleInlineUpdate(transactionId, 'category_id', categoryId);
  };

  const handleInlinePayeeChange = async (transactionId: string, payeeId: string | null) => {
    await handleInlineUpdate(transactionId, 'payee_id', payeeId);
  };

  const handleInlineDescriptionChange = async (transactionId: string, description: string) => {
    await handleInlineUpdate(transactionId, 'description', description);
  };

  const handleInlineTypeChange = async (transactionId: string, type: string) => {
    await handleInlineUpdate(transactionId, 'type', type);
  };

  // Create new payee function
  const handleCreatePayee = async (name: string): Promise<{ id: string; name: string; color?: string }> => {
    try {
      const newPayee = await payeesApi.create({ name });
      // Invalidate payees query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['payees'] });
      return newPayee;
    } catch (error) {
      showError('Failed to create payee');
      throw error;
    }
  };

  // Create new category function
  const handleCreateCategory = async (name: string): Promise<{ id: string; name: string; color?: string }> => {
    try {
      const newCategory = await categoriesApi.create({ name });
      // Invalidate categories query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      return newCategory;
    } catch (error) {
      showError('Failed to create category');
      throw error;
    }
  };

  const handleInlineDateChange = async (transactionId: string, date: string) => {
    await handleInlineUpdate(transactionId, 'date', date);
  };

  const handleOpenDialog = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      const account = accounts?.find(a => a.id === transaction.account_id);
      setSelectedAccount(account);
      setFormDescription(transaction.description || '');
      setFormAmount(transaction.amount);
      reset({
        date: transaction.date,
        amount: transaction.amount,
        description: transaction.description,
        type: transaction.type,
        account_id: transaction.account_id,
        to_account_id: transaction.to_account_id,
        payee_id: transaction.payee_id,
        category_id: transaction.category_id,
      });
    } else {
      setEditingTransaction(null);
      setSelectedAccount(null);
      setFormDescription('');
      setFormAmount(undefined);
      reset({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        description: '',
        type: 'expense',
        account_id: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTransaction(null);
    setSelectedAccount(null);
    setFormDescription('');
    setFormAmount(undefined);
    reset();
  };

  const onSubmit = (data: CreateTransactionDto) => {
    const submitData = {
      ...data,
      payee_id: data.payee_id || undefined,
      category_id: data.category_id || undefined,
      to_account_id: data.to_account_id || undefined,
    };

    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (transactionToDelete) {
      deleteMutation.mutate(transactionToDelete.id);
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setTransactionToDelete(null);
  };

  // Column resize handlers
  const handleColumnResize = (column: string, width: number) => {
    const newWidths = { ...columnWidths, [column]: Math.max(50, width) };
    setColumnWidths(newWidths);
    localStorage.setItem('transactions-column-widths', JSON.stringify(newWidths));
  };

  const handleResizeStart = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = columnWidths[column];
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = startWidth + diff;
      handleColumnResize(column, newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Batch selection functions
  const handleSelectTransaction = (transactionId: string) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allTransactionIds = transactionData?.items?.map(t => t.id) || [];
    setSelectedTransactions(new Set(allTransactionIds));
  };

  const handleClearSelection = () => {
    setSelectedTransactions(new Set());
  };

  const handleBatchDelete = () => {
    setBatchDeleteDialogOpen(true);
  };

  const handleConfirmBatchDelete = async () => {
    const selectedIds = Array.from(selectedTransactions);
    try {
      // Delete all selected transactions
      await Promise.all(selectedIds.map(id => 
        deleteMutation.mutateAsync(id)
      ));
      setBatchDeleteDialogOpen(false);
      setSelectedTransactions(new Set());
    } catch (error) {
      // Error handling is done by the mutation hook
    }
  };

  const handleCancelBatchDelete = () => {
    setBatchDeleteDialogOpen(false);
  };

  // Description cleanup handler
  const handleCleanupDescriptions = () => {
    setCleanupDialogOpen(true);
  };

  const handleConfirmCleanup = async () => {
    setCleanupDialogOpen(false);

    setIsCleaningUp(true);
    setCleanupResult(null);

    try {
      // Prepare filters to send to backend
      const cleanupFilters: any = {};
      
      if (filters.startDate) cleanupFilters.start_date = filters.startDate;
      if (filters.endDate) cleanupFilters.end_date = filters.endDate;
      if (filters.accountId) cleanupFilters.account_ids = [filters.accountId];
      if (filters.categoryIds && filters.categoryIds.length > 0) cleanupFilters.category_ids = filters.categoryIds;
      if (filters.payeeIds && filters.payeeIds.length > 0) cleanupFilters.payee_ids = filters.payeeIds;

      const result = await transactionsApi.cleanupDescriptions(cleanupFilters);
      setCleanupResult(result);
      
      // Refresh transactions to show updated descriptions
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      
    } catch (error: any) {
      setCleanupResult({
        error: true,
        message: error.response?.data?.detail || 'Failed to cleanup descriptions'
      });
    } finally {
      setIsCleaningUp(false);
    }
  };


  // Recalculate balances handler
  const handleRecalculateBalances = () => {
    if (!filters.accountId) {
      showError('Please select an account to recalculate balances for.');
      return;
    }
    setRecalculateDialogOpen(true);
  };

  const handleConfirmRecalculate = async () => {
    setRecalculateDialogOpen(false);

    setIsRecalculatingBalances(true);
    setRecalculateResult(null);

    try {
      if (!filters.accountId) {
        throw new Error('No account selected');
      }
      const result = await transactionsApi.recalculateAccountBalances(filters.accountId);
      
      setRecalculateResult({
        success: true,
        message: result.message,
        transactions_updated: result.transactions_updated,
        account_name: result.account_name
      });

      // Refresh transaction data
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });

    } catch (error: any) {
      console.error('Error recalculating balances:', error);
      setRecalculateResult({
        error: true,
        message: error.response?.data?.detail || 'Failed to recalculate balances'
      });
    } finally {
      setIsRecalculatingBalances(false);
    }
  };

  // Bulk category edit functions
  // const handleBulkCategoryEdit = () => {
  //   setBulkCategoryDialogOpen(true);
  // };

  const handleConfirmBulkCategoryUpdate = async () => {
    if (!selectedCategoryForBulk) return;
    
    const selectedIds = Array.from(selectedTransactions);
    try {
      // Update category for all selected transactions
      await Promise.all(selectedIds.map(id => 
        updateMutation.mutateAsync({
          id: id,
          data: { category_id: selectedCategoryForBulk === 'none' ? undefined : selectedCategoryForBulk }
        })
      ));
      setBulkCategoryDialogOpen(false);
      setSelectedTransactions(new Set());
      setSelectedCategoryForBulk('');
    } catch (error) {
      showError('Bulk category update failed');
    }
  };

  const handleCancelBulkCategoryUpdate = () => {
    setBulkCategoryDialogOpen(false);
    setSelectedCategoryForBulk('');
  };

  // Bulk payee edit functions
  // const handleBulkPayeeEdit = () => {
  //   setBulkPayeeDialogOpen(true);
  // };

  const handleConfirmBulkPayeeUpdate = async () => {
    if (!selectedPayeeForBulk) return;
    
    const selectedIds = Array.from(selectedTransactions);
    try {
      // Update payee for all selected transactions
      await Promise.all(selectedIds.map(id => 
        updateMutation.mutateAsync({
          id: id,
          data: { payee_id: selectedPayeeForBulk === 'none' ? undefined : selectedPayeeForBulk }
        })
      ));
      setBulkPayeeDialogOpen(false);
      setSelectedTransactions(new Set());
      setSelectedPayeeForBulk('');
    } catch (error) {
      showError('Bulk payee update failed');
    }
  };

  const handleCancelBulkPayeeUpdate = () => {
    setBulkPayeeDialogOpen(false);
    setSelectedPayeeForBulk('');
  };

  const handleConfirmBulkUpdate = async () => {
    if (!selectedCategoryForBulk && !selectedPayeeForBulk) {
      return;
    }

    const selectedIds = Array.from(selectedTransactions);
    
    try {
      const updates: any = {};
      if (selectedCategoryForBulk) {
        updates.category_id = selectedCategoryForBulk === 'none' ? undefined : selectedCategoryForBulk;
      }
      if (selectedPayeeForBulk) {
        updates.payee_id = selectedPayeeForBulk === 'none' ? undefined : selectedPayeeForBulk;
      }

      // Ensure we have at least one update to send
      if (Object.keys(updates).length === 0) {
        showError('Please select at least one field to update');
        return;
      }

      await bulkUpdateMutation.mutateAsync({
        transaction_ids: selectedIds,
        updates
      });

      // Clear selection and close dialog
      setSelectedTransactions(new Set());
      setBulkUpdateDialogOpen(false);
      setSelectedCategoryForBulk('');
      setSelectedPayeeForBulk('');
    } catch (error) {
      showError('Failed to update transactions');
    }
  };

  const handleCancelBulkUpdate = () => {
    setBulkUpdateDialogOpen(false);
    setSelectedCategoryForBulk('');
    setSelectedPayeeForBulk('');
  };

  // Helper function to get the last day of a month
  const getLastDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 0).getDate();
  };

  // Helper function to adjust end date when start date changes
  const adjustEndDateForMonth = (startDate: string, currentEndDate?: string): string => {
    if (!startDate) return currentEndDate || '';
    
    const start = new Date(startDate);
    const startYear = start.getFullYear();
    const startMonth = start.getMonth() + 1; // getMonth() returns 0-11
    
    // If we have an existing end date, check if it's in the same month
    if (currentEndDate) {
      const end = new Date(currentEndDate);
      const endYear = end.getFullYear();
      const endMonth = end.getMonth() + 1;
      
      // If they're in the same month and year, update to last day of month
      if (startYear === endYear && startMonth === endMonth) {
        const lastDay = getLastDayOfMonth(startYear, startMonth);
        return `${startYear}-${startMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      }
    } else {
      // If no end date, set to last day of the start date's month
      const lastDay = getLastDayOfMonth(startYear, startMonth);
      return `${startYear}-${startMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    }
    
    return currentEndDate || '';
  };

  const handleFilterChange = (field: keyof TransactionFilters, value: any) => {
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [field]: value === '' ? undefined : value,
        page: field !== 'page' && field !== 'size' ? 1 : prev.page // Reset to first page when changing filters
      };

      // Smart date handling: when start date changes, potentially adjust end date
      if (field === 'startDate' && value) {
        const adjustedEndDate = adjustEndDateForMonth(value, prev.endDate);
        if (adjustedEndDate && adjustedEndDate !== prev.endDate) {
          newFilters.endDate = adjustedEndDate;
        }
      }

      return newFilters;
    });

    // Sync month/year dropdowns when dates are changed manually
    if (field === 'startDate' && value) {
      const date = new Date(value);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString();
      setSelectedMonth(month);
      setSelectedYear(year);
    } else if (field === 'startDate' && !value) {
      // Clear month/year when start date is cleared
      setSelectedMonth('');
      setSelectedYear('');
    }
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (event: any) => {
    setFilters(prev => ({ 
      ...prev, 
      size: event.target.value,
      page: 1 // Reset to first page when changing page size
    }));
  };

  const clearFilters = () => {
    clearSavedFilters();
    setSelectedMonth('');
    setSelectedYear('');
  };

  // Helper function to generate month options
  const getMonthOptions = () => [
    { value: '', label: 'All Months' },
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  // Helper function to generate year options from 2014 to current year
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    years.push({ value: '', label: 'All Years' });
    
    // Generate years from current year down to 2014
    for (let year = currentYear; year >= 2014; year--) {
      years.push({ value: year.toString(), label: year.toString() });
    }
    
    return years;
  };

  // Handle month/year selection
  const handleMonthYearChange = (type: 'month' | 'year', value: string) => {
    if (type === 'month') {
      setSelectedMonth(value);
    } else {
      setSelectedYear(value);
    }

    // Update date filters based on month/year selection
    const month = type === 'month' ? value : selectedMonth;
    const year = type === 'year' ? value : selectedYear;

    if (month && year) {
      // Both month and year selected - set specific month range
      const startDate = `${year}-${month}-01`;
      const lastDay = getLastDayOfMonth(parseInt(year), parseInt(month));
      const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`;
      
      setFilters(prev => ({
        ...prev,
        startDate,
        endDate,
        page: 1
      }));
    } else if (year && !month) {
      // Only year selected - set full year range
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      
      setFilters(prev => ({
        ...prev,
        startDate,
        endDate,
        page: 1
      }));
    } else if (!month && !year) {
      // Both cleared - clear date filters
      setFilters(prev => ({
        ...prev,
        startDate: undefined,
        endDate: undefined,
        page: 1
      }));
    }
    // If only month is selected without year, don't update dates (invalid state)
  };

  const handleSort = (field: SortField) => {
    setFilters(prev => ({
      ...prev,
      sortField: field,
      sortDirection: prev.sortField === field && prev.sortDirection === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (field: SortField) => {
    if (filters.sortField !== field) return null;
    return filters.sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

  const sortedTransactions = React.useMemo(() => {
    if (!transactionData?.items || !filters.sortField) {
      return transactionData?.items || [];
    }

    const sorted = [...transactionData.items].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (filters.sortField) {
        case 'date':
          aValue = a.date ? new Date(a.date).getTime() : 0;
          bValue = b.date ? new Date(b.date).getTime() : 0;
          break;
        case 'description':
          aValue = (a.description || '').toLowerCase();
          bValue = (b.description || '').toLowerCase();
          break;
        case 'account':
          aValue = (a.account?.name || '').toLowerCase();
          bValue = (b.account?.name || '').toLowerCase();
          break;
        case 'payee':
          aValue = (payees?.find(p => p.id === a.payee_id)?.name || '').toLowerCase();
          bValue = (payees?.find(p => p.id === b.payee_id)?.name || '').toLowerCase();
          break;
        case 'category':
          aValue = (categories?.find(c => c.id === a.category_id)?.name || '').toLowerCase();
          bValue = (categories?.find(c => c.id === b.category_id)?.name || '').toLowerCase();
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'amount':
          aValue = Number(a.amount) || 0;
          bValue = Number(b.amount) || 0;
          break;
        default:
          return 0;
      }

      // Handle null/empty values - always sort them to the end
      if (aValue === '' || aValue === null || aValue === undefined || aValue === 0) {
        if (bValue === '' || bValue === null || bValue === undefined || bValue === 0) {
          return 0;
        }
        return 1;
      }
      if (bValue === '' || bValue === null || bValue === undefined || bValue === 0) {
        return -1;
      }

      if (aValue < bValue) {
        return filters.sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return filters.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [transactionData?.items, filters.sortField, filters.sortDirection, payees, categories]);

  const hasActiveFilters = filters.startDate || filters.endDate || filters.accountId || (filters.categoryIds && filters.categoryIds.length > 0) || (filters.payeeIds && filters.payeeIds.length > 0) || selectedMonth || selectedYear;
  
  // Calculate uncategorized transactions count
  const uncategorizedCount = transactionData?.items?.filter(
    t => !t.payee_id || !t.category_id
  ).length || 0;


  if (transactionsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Transactions</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            sx={{ mr: 2 }}
            onClick={() => setShowFilters(!showFilters)}
            color={hasActiveFilters ? 'primary' : 'inherit'}
          >
            Filters
          </Button>
          <Button
            variant="outlined"
            startIcon={<CleaningServices />}
            sx={{ mr: 2 }}
            onClick={handleCleanupDescriptions}
            disabled={isCleaningUp}
            color="secondary"
            title="Remove '| ' and trim whitespaces from ALL transaction descriptions"
          >
            {isCleaningUp ? 'Cleaning...' : 'Clean Descriptions'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Calculate />}
            sx={{ mr: 2 }}
            onClick={handleRecalculateBalances}
            disabled={isRecalculatingBalances || !filters.accountId}
            color="info"
          >
            {isRecalculatingBalances ? 'Recalculating...' : 'Recalculate Balances'}
          </Button>
          <SmartAutomation 
            uncategorizedCount={uncategorizedCount}
            selectedTransactionIds={Array.from(selectedTransactions)}
            currentFilters={filters}
            onAutomationComplete={() => {
              // Refresh data after automation
              queryClient.invalidateQueries({ queryKey: ['transactions'] });
            }}
          />
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            Add Transaction
          </Button>
          {selectedTransactions.size > 0 && (
            <>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<Edit />}
                onClick={() => setBulkUpdateDialogOpen(true)}
                sx={{ ml: 2 }}
              >
                Update Selected ({selectedTransactions.size})
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={handleBatchDelete}
                sx={{ ml: 2 }}
              >
                Delete Selected ({selectedTransactions.size})
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Filters Card */}
      {showFilters && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3} alignItems="flex-start">
              {/* Date & Time Filters Section */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Date & Time Filters
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  label="Month"
                  value={selectedMonth}
                  onChange={(e) => handleMonthYearChange('month', e.target.value)}
                  fullWidth
                  size="small"
                >
                  {getMonthOptions().map((month) => (
                    <MenuItem key={month.value} value={month.value}>
                      {month.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  label="Year"
                  value={selectedYear}
                  onChange={(e) => handleMonthYearChange('year', e.target.value)}
                  fullWidth
                  size="small"
                >
                  {getYearOptions().map((year) => (
                    <MenuItem key={year.value} value={year.value}>
                      {year.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="End Date"
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Account & Entity Filters Section */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                  Account & Entity Filters
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  select
                  label="Account"
                  value={filters.accountId || ''}
                  onChange={(e) => handleFilterChange('accountId', e.target.value || undefined)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="">All Accounts</MenuItem>
                  {accounts?.sort((a, b) => a.name.localeCompare(b.name)).map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  multiple
                  value={filters.categoryIds ? filters.categoryIds.map(id => 
                    id === 'none' 
                      ? { id: 'none', name: 'No Category' }
                      : categories?.find(c => c.id === id) || { id, name: 'Unknown' }
                  ) : []}
                  onChange={(event, newValue) => {
                    const newIds = newValue.map(v => v.id);
                    handleFilterChange('categoryIds', newIds.length > 0 ? newIds : undefined);
                  }}
                  options={[
                    { id: 'none', name: 'No Category' },
                    ...(categories?.map(c => ({ id: c.id, name: c.name })) || []).sort((a, b) => a.name.localeCompare(b.name))
                  ]}
                  getOptionLabel={(option) => option.name}
                  size="small"
                  renderInput={(params) => (
                    <TextField {...params} label="Categories" size="small" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option.name}
                        size="small"
                        {...getTagProps({ index })}
                        key={option.id}
                      />
                    ))
                  }
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  multiple
                  value={filters.payeeIds ? filters.payeeIds.map(id => 
                    id === 'none' 
                      ? { id: 'none', name: 'No Payee' }
                      : payees?.find(p => p.id === id) || { id, name: 'Unknown' }
                  ) : []}
                  onChange={(event, newValue) => {
                    const newIds = newValue.map(v => v.id);
                    handleFilterChange('payeeIds', newIds.length > 0 ? newIds : undefined);
                  }}
                  options={[
                    { id: 'none', name: 'No Payee' },
                    ...(payees?.map(p => ({ id: p.id, name: p.name })) || []).sort((a, b) => a.name.localeCompare(b.name))
                  ]}
                  getOptionLabel={(option) => option.name}
                  size="small"
                  renderInput={(params) => (
                    <TextField {...params} label="Payees" size="small" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option.name}
                        size="small"
                        {...getTagProps({ index })}
                        key={option.id}
                      />
                    ))
                  }
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                />
              </Grid>
              
              {/* Actions Section */}
              <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  startIcon={<Clear />}
                  size="small"
                  variant="outlined"
                  color="secondary"
                >
                  Clear All Filters
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Cleanup Results */}
      {cleanupResult && (
        <Alert 
          severity={cleanupResult.error ? 'error' : 'success'}
          onClose={() => setCleanupResult(null)}
          sx={{ mb: 2 }}
        >
          {cleanupResult.error ? (
            cleanupResult.message
          ) : (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {cleanupResult.message}
              </Typography>
              <Typography variant="body2">
                • Removed "| " from {cleanupResult.pipe_symbol_removals} transaction descriptions
              </Typography>
              <Typography variant="body2">
                • Removed trailing whitespace from {cleanupResult.trailing_whitespace_removals} transaction descriptions
              </Typography>
              <Typography variant="body2">
                • Total transactions processed: {cleanupResult.total_transactions_processed}
              </Typography>
            </Box>
          )}
        </Alert>
      )}

      {/* Recalculate Balances Results */}
      {recalculateResult && (
        <Alert 
          severity={recalculateResult.error ? 'error' : 'success'}
          onClose={() => setRecalculateResult(null)}
          sx={{ mb: 2 }}
        >
          {recalculateResult.error ? (
            recalculateResult.message
          ) : (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {recalculateResult.message}
              </Typography>
              <Typography variant="body2">
                • Account: {recalculateResult.account_name}
              </Typography>
              <Typography variant="body2">
                • Transactions updated: {recalculateResult.transactions_updated}
              </Typography>
            </Box>
          )}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <ResizableTableCell 
                padding="checkbox" 
                column="checkbox" 
                width={columnWidths.checkbox}
                onResizeStart={handleResizeStart}
                isResizing={isResizing}
              >
                <Checkbox
                  indeterminate={selectedTransactions.size > 0 && selectedTransactions.size < (transactionData?.items?.length || 0)}
                  checked={(transactionData?.items?.length || 0) > 0 && selectedTransactions.size === (transactionData?.items?.length || 0)}
                  onChange={(e) => e.target.checked ? handleSelectAll() : handleClearSelection()}
                />
              </ResizableTableCell>
              <ResizableTableCell 
                sx={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('date')}
                column="date"
                width={columnWidths.date}
                onResizeStart={handleResizeStart}
                isResizing={isResizing}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  Date
                  {getSortIcon('date')}
                </Box>
              </ResizableTableCell>
              <ResizableTableCell 
                sx={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('description')}
                column="description"
                width={columnWidths.description}
                onResizeStart={handleResizeStart}
                isResizing={isResizing}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  Description
                  {getSortIcon('description')}
                </Box>
              </ResizableTableCell>
              <ResizableTableCell 
                sx={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('account')}
                column="account"
                width={columnWidths.account}
                onResizeStart={handleResizeStart}
                isResizing={isResizing}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  Account
                  {getSortIcon('account')}
                </Box>
              </ResizableTableCell>
              <ResizableTableCell 
                sx={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('payee')}
                column="payee"
                width={columnWidths.payee}
                onResizeStart={handleResizeStart}
                isResizing={isResizing}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  Payee
                  {getSortIcon('payee')}
                </Box>
              </ResizableTableCell>
              <ResizableTableCell 
                sx={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('category')}
                column="category"
                width={columnWidths.category}
                onResizeStart={handleResizeStart}
                isResizing={isResizing}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  Category
                  {getSortIcon('category')}
                </Box>
              </ResizableTableCell>
              <ResizableTableCell 
                sx={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('type')}
                column="type"
                width={columnWidths.type}
                onResizeStart={handleResizeStart}
                isResizing={isResizing}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  Type
                  {getSortIcon('type')}
                </Box>
              </ResizableTableCell>
              <ResizableTableCell 
                align="right"
                sx={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('amount')}
                column="amount"
                width={columnWidths.amount}
                onResizeStart={handleResizeStart}
                isResizing={isResizing}
              >
                <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
                  Amount
                  {getSortIcon('amount')}
                </Box>
              </ResizableTableCell>
              <ResizableTableCell 
                align="right"
                column="balance"
                width={columnWidths.balance}
                onResizeStart={handleResizeStart}
                isResizing={isResizing}
              >
                Balance
              </ResizableTableCell>
              <ResizableTableCell 
                align="center"
                column="actions"
                width={columnWidths.actions}
                onResizeStart={handleResizeStart}
                isResizing={isResizing}
              >
                Actions
              </ResizableTableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedTransactions?.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell padding="checkbox" sx={{ width: columnWidths.checkbox, minWidth: columnWidths.checkbox, maxWidth: columnWidths.checkbox }}>
                  <Checkbox
                    checked={selectedTransactions.has(transaction.id)}
                    onChange={() => handleSelectTransaction(transaction.id)}
                  />
                </TableCell>
                <TableCell sx={{ width: columnWidths.date, minWidth: columnWidths.date, maxWidth: columnWidths.date }}>
                  <InlineDateEdit
                    value={transaction.date}
                    onSave={(newValue) => handleInlineDateChange(transaction.id, newValue)}
                    isSaving={savingTransactions.has(transaction.id)}
                  />
                </TableCell>
                <TableCell sx={{ 
                  width: columnWidths.description,
                  minWidth: columnWidths.description,
                  maxWidth: columnWidths.description,
                  '& .MuiBox-root': {
                    maxWidth: `${columnWidths.description - 20}px`
                  },
                  '& .MuiTypography-root': {
                    maxWidth: `${columnWidths.description - 20}px`,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }
                }}>
                  <InlineTextEdit
                    value={transaction.description || ''}
                    onSave={(newValue) => handleInlineDescriptionChange(transaction.id, newValue)}
                    placeholder="Enter description..."
                    emptyDisplay="-"
                    isSaving={savingTransactions.has(transaction.id)}
                    maxLength={255}
                  />
                </TableCell>
                <TableCell sx={{ width: columnWidths.account, minWidth: columnWidths.account, maxWidth: columnWidths.account }}>
                  {transaction.type === 'transfer' ? (
                    <Box>
                      <Typography variant="body2">
                        {transaction.account?.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        → {transaction.to_account?.name}
                      </Typography>
                    </Box>
                  ) : (
                    transaction.account?.name
                  )}
                </TableCell>
                <TableCell sx={{ width: columnWidths.payee, minWidth: columnWidths.payee, maxWidth: columnWidths.payee }}>
                  <SmartInlineEdit
                    transactionId={transaction.id}
                    transactionDescription={transaction.description || ''}
                    transactionAmount={Number(transaction.amount)}
                    accountType={transaction.account?.type}
                    fieldType="payee"
                    currentValue={payees?.find(p => p.id === transaction.payee_id) || null}
                    allOptions={payees || []}
                    onSelectionChange={async (newValue) => {
                      await handleInlinePayeeChange(transaction.id, newValue?.id || null);
                    }}
                    onCreateNew={handleCreatePayee}
                    isSaving={savingTransactions.has(transaction.id)}
                    placeholder="Select payee..."
                    emptyDisplay="-"
                  />
                </TableCell>
                <TableCell sx={{ width: columnWidths.category, minWidth: columnWidths.category, maxWidth: columnWidths.category }}>
                  <SmartInlineEdit
                    transactionId={transaction.id}
                    transactionDescription={transaction.description || ''}
                    transactionAmount={Number(transaction.amount)}
                    accountType={transaction.account?.type}
                    fieldType="category"
                    currentValue={categories?.find(c => c.id === transaction.category_id) || null}
                    allOptions={categories || []}
                    onSelectionChange={async (newValue) => {
                      await handleInlineCategoryChange(transaction.id, newValue?.id || null);
                    }}
                    onCreateNew={handleCreateCategory}
                    isSaving={savingTransactions.has(transaction.id)}
                    placeholder="Select category..."
                    emptyDisplay="-"
                  />
                </TableCell>
                <TableCell sx={{ width: columnWidths.type, minWidth: columnWidths.type, maxWidth: columnWidths.type }}>
                  <InlineToggleEdit
                    value={transaction.type}
                    options={transactionTypeOptions}
                    onSave={(newValue) => handleInlineTypeChange(transaction.id, newValue)}
                    isSaving={savingTransactions.has(transaction.id)}
                  />
                </TableCell>
                <TableCell align="right" sx={{ width: columnWidths.amount, minWidth: columnWidths.amount, maxWidth: columnWidths.amount }}>
                  {transaction.type === 'transfer' ? (
                    <Box>
                      <Typography color="info.main" variant="body2">
                        {formatCurrency(transaction.amount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Transfer
                      </Typography>
                    </Box>
                  ) : (
                    <Typography
                      color={
                        transaction.type === 'income'
                          ? 'success.main'
                          : 'error.main'
                      }
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right" sx={{ width: columnWidths.balance, minWidth: columnWidths.balance, maxWidth: columnWidths.balance }}>
                  {transaction.type === 'transfer' ? (
                    <Box>
                      <Typography 
                        variant="body2" 
                        color={
                          transaction.balance_after_transaction && transaction.balance_after_transaction < 0
                            ? 'error.main'
                            : 'text.primary'
                        }
                      >
                        {transaction.balance_after_transaction !== undefined 
                          ? formatCurrency(transaction.balance_after_transaction)
                          : '-'
                        }
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        → {transaction.to_account_balance_after !== undefined 
                          ? formatCurrency(transaction.to_account_balance_after)
                          : '-'
                        }
                      </Typography>
                    </Box>
                  ) : (
                    <Typography 
                      variant="body2" 
                      color={
                        transaction.balance_after_transaction && transaction.balance_after_transaction < 0
                          ? 'error.main'
                          : 'text.primary'
                      }
                    >
                      {transaction.balance_after_transaction !== undefined 
                        ? formatCurrency(transaction.balance_after_transaction)
                        : '-'
                      }
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center" sx={{ width: columnWidths.actions, minWidth: columnWidths.actions, maxWidth: columnWidths.actions }}>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(transaction)}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(transaction)}
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {/* Performance Warning for Large Datasets */}
        {filters.showAll && transactionData && transactionData.total > 500 && (
          <Alert severity="info" sx={{ m: 2 }}>
            <Typography variant="body2">
              Showing all {transactionData.total} transactions may affect performance. 
              Consider using filters or pagination for better performance.
            </Typography>
          </Alert>
        )}
        
        {/* Pagination */}
        {transactionData && (
          <Box display="flex" justifyContent="space-between" alignItems="center" p={2} flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <Typography variant="body2" color="textSecondary">
                {filters.showAll 
                  ? `Showing all ${transactionData.total} transactions`
                  : `Showing ${((transactionData.page - 1) * transactionData.size) + 1} to ${Math.min(transactionData.page * transactionData.size, transactionData.total)} of ${transactionData.total} transactions`
                }
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={filters.showAll}
                    onChange={(e) => setFilters(prev => ({ ...prev, showAll: e.target.checked }))}
                    size="small"
                  />
                }
                label="Show All"
                sx={{ ml: 1 }}
              />
              
              {!filters.showAll && (
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Per page</InputLabel>
                  <Select
                    value={filters.size}
                    label="Per page"
                    onChange={handlePageSizeChange}
                  >
                    {pageSizeOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
            {!filters.showAll && transactionData.pages > 1 && (
              <Pagination
                count={transactionData.pages}
                page={transactionData.page}
                onChange={handlePageChange}
                color="primary"
                showFirstButton
                showLastButton
              />
            )}
          </Box>
        )}
      </TableContainer>

      {/* Transaction Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
          </DialogTitle>
          <DialogContent>
            <Controller
              name="date"
              control={control}
              rules={{ required: 'Date is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Date"
                  type="date"
                  fullWidth
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                  error={!!errors.date}
                  helperText={errors.date?.message}
                />
              )}
            />

            <Controller
              name="amount"
              control={control}
              rules={{ required: 'Amount is required', min: { value: 0.01, message: 'Amount must be greater than 0' } }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Amount"
                  type="number"
                  fullWidth
                  margin="normal"
                  error={!!errors.amount}
                  helperText={errors.amount?.message}
                  onChange={(e) => {
                    field.onChange(e);
                    setFormAmount(parseFloat(e.target.value) || undefined);
                  }}
                />
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Description"
                  fullWidth
                  margin="normal"
                  multiline
                  rows={2}
                  onChange={(e) => {
                    field.onChange(e);
                    setFormDescription(e.target.value);
                  }}
                />
              )}
            />

            <Controller
              name="type"
              control={control}
              rules={{ required: 'Transaction type is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Transaction Type"
                  fullWidth
                  margin="normal"
                  error={!!errors.type}
                  helperText={errors.type?.message}
                >
                  {transactionTypes.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="account_id"
              control={control}
              rules={{ required: 'Account is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Account"
                  fullWidth
                  margin="normal"
                  error={!!errors.account_id}
                  helperText={errors.account_id?.message}
                  onChange={(e) => {
                    field.onChange(e);
                    const account = accounts?.find(a => a.id === e.target.value);
                    setSelectedAccount(account);
                  }}
                >
                  {accounts?.sort((a, b) => a.name.localeCompare(b.name)).map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            {watchTransactionType === 'transfer' && (
              <Controller
                name="to_account_id"
                control={control}
                rules={{ required: 'Destination account is required for transfers' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="To Account"
                    fullWidth
                    margin="normal"
                    error={!!errors.to_account_id}
                    helperText={errors.to_account_id?.message}
                  >
                    {accounts?.sort((a, b) => a.name.localeCompare(b.name)).map((account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            )}

            <Controller
              name="payee_id"
              control={control}
              render={({ field }) => (
                <SmartAutocomplete
                  value={payees?.find(p => p.id === field.value) || null}
                  onChange={(event, newValue) => field.onChange(newValue?.id || '')}
                  options={
                    formSuggestions?.payee_suggestions || 
                    (payees?.map(p => ({
                      id: p.id,
                      name: p.name,
                      type: 'existing' as const,
                      confidence: 0.5,
                      reason: 'Existing payee',
                      isExisting: true,
                    })) || []).slice().sort((a, b) => a.name.localeCompare(b.name)) // Debug: sort payees
                  }
                  getOptionLabel={(option) => option?.name || ''}
                  loading={suggestionsLoading}
                  placeholder="Select or search payee..."
                  label="Payee"
                  fieldType="payee"
                  variant="outlined"
                  size="medium"
                  allowCreate={true}
                  onCreateNew={handleCreatePayee}
                  onSuggestionShown={trackSuggestionShown}
                  onSuggestionAccepted={trackSuggestionAccepted}
                  sx={{ mt: 2 }}
                />
              )}
            />

            <Controller
              name="category_id"
              control={control}
              render={({ field }) => (
                <SmartAutocomplete
                  value={categories?.find(c => c.id === field.value) || null}
                  onChange={(event, newValue) => field.onChange(newValue?.id || '')}
                  options={
                    formSuggestions?.category_suggestions || 
                    (categories?.map(c => ({
                      id: c.id,
                      name: c.name,
                      type: 'existing' as const,
                      confidence: 0.5,
                      reason: 'Existing category',
                      color: c.color,
                      isExisting: true,
                    })) || []).slice().sort((a, b) => a.name.localeCompare(b.name)) // Debug: log and sort categories
                  }
                  getOptionLabel={(option) => option?.name || ''}
                  loading={suggestionsLoading}
                  placeholder="Select or search category..."
                  label="Category"
                  fieldType="category"
                  variant="outlined"
                  size="medium"
                  allowCreate={true}
                  onCreateNew={handleCreateCategory}
                  onSuggestionShown={trackSuggestionShown}
                  onSuggestionAccepted={trackSuggestionAccepted}
                  sx={{ mt: 2 }}
                />
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingTransaction ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this transaction?
          </Typography>
          {transactionToDelete && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Date:</strong> {new Date(transactionToDelete.date).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Description:</strong> {transactionToDelete.description || 'No description'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Amount:</strong> {formatCurrency(transactionToDelete.amount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Account:</strong> {transactionToDelete.account?.name}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error" 
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Delete Confirmation Dialog */}
      <Dialog
        open={batchDeleteDialogOpen}
        onClose={handleCancelBatchDelete}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Batch Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedTransactions.size} selected transaction{selectedTransactions.size > 1 ? 's' : ''}?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This action cannot be undone.
          </Typography>
          
          {/* Show preview of selected transactions */}
          {transactionData?.items && (
            <Box sx={{ mt: 2, maxHeight: 300, overflow: 'auto' }}>
              <Typography variant="subtitle2" gutterBottom>
                Selected Transactions:
              </Typography>
              {transactionData.items
                .filter(t => selectedTransactions.has(t.id))
                .slice(0, 10) // Show only first 10 for preview
                .map((transaction) => (
                  <Box 
                    key={transaction.id} 
                    sx={{ 
                      p: 1, 
                      mb: 1, 
                      backgroundColor: 'grey.50', 
                      borderRadius: 1,
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box>
                      <Typography variant="body2">
                        {transaction.description || 'No description'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(transaction.date).toLocaleDateString()} • {transaction.account?.name}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color={transaction.type === 'income' ? 'success.main' : 'error.main'}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </Typography>
                  </Box>
                ))}
              {selectedTransactions.size > 10 && (
                <Typography variant="caption" color="text.secondary">
                  ... and {selectedTransactions.size - 10} more transactions
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelBatchDelete}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmBatchDelete} 
            color="error" 
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : `Delete ${selectedTransactions.size} Transaction${selectedTransactions.size > 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Category Edit Dialog */}
      <Dialog
        open={bulkCategoryDialogOpen}
        onClose={handleCancelBulkCategoryUpdate}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Category for Selected Transactions</DialogTitle>
        <DialogContent>
          <Typography>
            Update the category for {selectedTransactions.size} selected transaction{selectedTransactions.size > 1 ? 's' : ''}:
          </Typography>
          
          {/* Show preview of selected transactions */}
          {transactionData?.items && (
            <Box sx={{ mt: 2, mb: 3, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="subtitle2" gutterBottom>
                Selected Transactions:
              </Typography>
              {transactionData.items
                .filter(t => selectedTransactions.has(t.id))
                .slice(0, 5) // Show only first 5 for preview
                .map((transaction) => (
                  <Box 
                    key={transaction.id} 
                    sx={{ 
                      p: 1, 
                      mb: 1, 
                      backgroundColor: 'grey.50', 
                      borderRadius: 1,
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box>
                      <Typography variant="body2">
                        {transaction.description || 'No description'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Current: {categories?.find(c => c.id === transaction.category_id)?.name || 'No category'}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color={transaction.type === 'income' ? 'success.main' : 'error.main'}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </Typography>
                  </Box>
                ))}
              {selectedTransactions.size > 5 && (
                <Typography variant="caption" color="text.secondary">
                  ... and {selectedTransactions.size - 5} more transactions
                </Typography>
              )}
            </Box>
          )}

          {/* Category Selection with Create Option */}
          <SmartAutocomplete
            value={selectedCategoryForBulk ? (selectedCategoryForBulk === 'none' ? { id: 'none', name: 'No Category' } : categories?.find(c => c.id === selectedCategoryForBulk) || null) : null}
            onChange={(event, newValue) => setSelectedCategoryForBulk(newValue?.id || '')}
            options={[
              { id: 'none', name: 'No Category', type: 'existing' as const, confidence: 1, reason: 'Remove category' },
              ...(categories?.map(c => ({
                id: c.id,
                name: c.name,
                type: 'existing' as const,
                confidence: 1,
                reason: 'Existing category',
                color: c.color,
              })) || []).sort((a, b) => a.name.localeCompare(b.name))
            ]}
            getOptionLabel={(option) => option?.name || ''}
            placeholder="Select or create category..."
            label="New Category"
            fieldType="category"
            variant="outlined"
            size="medium"
            allowCreate={true}
            onCreateNew={handleCreateCategory}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelBulkCategoryUpdate}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmBulkCategoryUpdate} 
            color="primary" 
            variant="contained"
            disabled={!selectedCategoryForBulk || updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Updating...' : `Update ${selectedTransactions.size} Transaction${selectedTransactions.size > 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Payee Edit Dialog */}
      <Dialog
        open={bulkPayeeDialogOpen}
        onClose={handleCancelBulkPayeeUpdate}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Payee for Selected Transactions</DialogTitle>
        <DialogContent>
          <Typography>
            Update the payee for {selectedTransactions.size} selected transaction{selectedTransactions.size > 1 ? 's' : ''}:
          </Typography>
          
          {/* Show preview of selected transactions */}
          {transactionData?.items && (
            <Box sx={{ mt: 2, mb: 3, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="subtitle2" gutterBottom>
                Selected Transactions:
              </Typography>
              {transactionData.items
                .filter(t => selectedTransactions.has(t.id))
                .slice(0, 5) // Show only first 5 for preview
                .map((transaction) => (
                  <Box 
                    key={transaction.id} 
                    sx={{ 
                      p: 1, 
                      mb: 1, 
                      backgroundColor: 'grey.50', 
                      borderRadius: 1,
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box>
                      <Typography variant="body2">
                        {transaction.description || 'No description'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Current: {payees?.find(p => p.id === transaction.payee_id)?.name || 'No payee'}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color={transaction.type === 'income' ? 'success.main' : 'error.main'}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </Typography>
                  </Box>
                ))}
              {selectedTransactions.size > 5 && (
                <Typography variant="caption" color="text.secondary">
                  ... and {selectedTransactions.size - 5} more transactions
                </Typography>
              )}
            </Box>
          )}

          {/* Payee Selection with Create Option */}
          <SmartAutocomplete
            value={selectedPayeeForBulk ? (selectedPayeeForBulk === 'none' ? { id: 'none', name: 'No Payee' } : payees?.find(p => p.id === selectedPayeeForBulk) || null) : null}
            onChange={(event, newValue) => setSelectedPayeeForBulk(newValue?.id || '')}
            options={[
              { id: 'none', name: 'No Payee', type: 'existing' as const, confidence: 1, reason: 'Remove payee' },
              ...(payees?.map(p => ({
                id: p.id,
                name: p.name,
                type: 'existing' as const,
                confidence: 1,
                reason: 'Existing payee',
                color: p.color,
              })) || []).sort((a, b) => a.name.localeCompare(b.name))
            ]}
            getOptionLabel={(option) => option?.name || ''}
            placeholder="Select or create payee..."
            label="New Payee"
            fieldType="payee"
            variant="outlined"
            size="medium"
            allowCreate={true}
            onCreateNew={handleCreatePayee}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelBulkPayeeUpdate}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmBulkPayeeUpdate} 
            color="secondary" 
            variant="contained"
            disabled={!selectedPayeeForBulk || updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Updating...' : `Update ${selectedTransactions.size} Transaction${selectedTransactions.size > 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unified Bulk Update Dialog */}
      <Dialog
        open={bulkUpdateDialogOpen}
        onClose={handleCancelBulkUpdate}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Selected Transactions</DialogTitle>
        <DialogContent>
          <Typography>
            Update {selectedTransactions.size} selected transaction{selectedTransactions.size > 1 ? 's' : ''}:
          </Typography>
          
          {/* Show preview of selected transactions */}
          {transactionData?.items && (
            <Box sx={{ mt: 2, mb: 3, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="subtitle2" gutterBottom>
                Selected Transactions:
              </Typography>
              {transactionData.items
                .filter(t => selectedTransactions.has(t.id))
                .slice(0, 5) // Show only first 5 for preview
                .map((transaction) => (
                  <Box 
                    key={transaction.id} 
                    sx={{ 
                      p: 1, 
                      mb: 1, 
                      backgroundColor: 'grey.50', 
                      borderRadius: 1,
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box>
                      <Typography variant="body2">
                        {transaction.description || 'No description'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Current: {categories?.find(c => c.id === transaction.category_id)?.name || 'No category'} | {payees?.find(p => p.id === transaction.payee_id)?.name || 'No payee'}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color={transaction.type === 'income' ? 'success.main' : 'error.main'}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </Typography>
                  </Box>
                ))}
              {selectedTransactions.size > 5 && (
                <Typography variant="caption" color="text.secondary">
                  ... and {selectedTransactions.size - 5} more transactions
                </Typography>
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Category (optional)
              </Typography>
              <Autocomplete
                options={categories || []}
                getOptionLabel={(option) => option.name}
                value={categories?.find(c => c.id === selectedCategoryForBulk) || null}
                onChange={(_, value) => setSelectedCategoryForBulk(value?.id || '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Keep current categories"
                    size="small"
                  />
                )}
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Payee (optional)
              </Typography>
              <Autocomplete
                options={payees || []}
                getOptionLabel={(option) => option.name}
                value={payees?.find(p => p.id === selectedPayeeForBulk) || null}
                onChange={(_, value) => setSelectedPayeeForBulk(value?.id || '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Keep current payees"
                    size="small"
                  />
                )}
                size="small"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelBulkUpdate}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmBulkUpdate} 
            color="primary" 
            variant="contained"
            disabled={(!selectedCategoryForBulk && !selectedPayeeForBulk) || bulkUpdateMutation.isPending}
          >
            {bulkUpdateMutation.isPending ? 'Updating...' : `Update ${selectedTransactions.size} Transaction${selectedTransactions.size > 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clean Descriptions Confirmation Dialog */}
      <Dialog open={cleanupDialogOpen} onClose={() => setCleanupDialogOpen(false)}>
        <DialogTitle>Clean Transaction Descriptions</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            This will clean up descriptions for ALL your transactions:
          </Typography>
          <Box component="ul" sx={{ mt: 1, mb: 2 }}>
            <Typography component="li" variant="body2">
              Remove "| " (pipe symbols with spaces) from all transaction descriptions
            </Typography>
            <Typography component="li" variant="body2">
              Remove leading and trailing whitespaces from all transaction descriptions
            </Typography>
          </Box>
          <Typography variant="body2" color="warning.main" sx={{ fontWeight: 'bold' }}>
            ⚠️ This applies to ALL transactions, not just the filtered ones.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone. Continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCleanupDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmCleanup} 
            color="primary" 
            variant="contained"
            disabled={isCleaningUp}
          >
            {isCleaningUp ? 'Cleaning...' : 'Clean Descriptions'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recalculate Balances Confirmation Dialog */}
      <Dialog open={recalculateDialogOpen} onClose={() => setRecalculateDialogOpen(false)}>
        <DialogTitle>Recalculate Transaction Balances</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            This will recalculate per-transaction balances for account "{accounts?.find(acc => acc.id === filters.accountId)?.name}".
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This process will update all transaction balances for this account based on chronological order. 
            This is useful for maintaining data integrity.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecalculateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmRecalculate} 
            color="primary" 
            variant="contained"
            disabled={isRecalculatingBalances}
          >
            {isRecalculatingBalances ? 'Recalculating...' : 'Recalculate Balances'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Transactions;
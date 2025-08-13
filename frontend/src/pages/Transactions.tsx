import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import { Add, Edit, Delete, Upload, FilterList, Clear, Analytics } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { transactionsApi, accountsApi, payeesApi, categoriesApi } from '../services/api';
import { Transaction, CreateTransactionDto, PaginatedResponse } from '../types';
import { formatCurrency } from '../utils/formatters';
import { useCreateWithToast, useUpdateWithToast, useDeleteWithToast } from '../hooks/useApiWithToast';
import { usePageTitle, getPageTitle } from '../hooks/usePageTitle';
import SmartInlineEdit from '../components/SmartInlineEdit';
import SmartAutocomplete from '../components/SmartAutocomplete';
import SmartAutomation from '../components/SmartAutomation';
import InlineTextEdit from '../components/InlineTextEdit';
import InlineDateEdit from '../components/InlineDateEdit';
import InlineToggleEdit from '../components/InlineToggleEdit';
import { useEnhancedSuggestions, useLearningMetrics } from '../hooks/useLearning';

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
  page: number;
  size: number;
}

const Transactions: React.FC = () => {
  usePageTitle(getPageTitle('transactions', 'Income & Expenses'));
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>({
    page: 1,
    size: 50
  });
  const [showFilters, setShowFilters] = useState(false);
  const [savingTransactions, setSavingTransactions] = useState<Set<string>>(new Set());
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
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
      page: filters.page,
      size: filters.size,
      start_date: filters.startDate,
      end_date: filters.endDate,
      account_ids: filters.accountId,
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
  
  // Get enhanced suggestions for form
  const {
    data: formSuggestions,
    isLoading: suggestionsLoading
  } = useEnhancedSuggestions(
    formDescription,
    formAmount,
    selectedAccount?.id,
    selectedAccount?.type,
    payees || [],
    categories || []
  );

  const createMutation = useCreateWithToast(transactionsApi.create, {
    resourceName: 'Transaction',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useUpdateWithToast(
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

  const deleteMutation = useDeleteWithToast(transactionsApi.delete, {
    resourceName: 'Transaction',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

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

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleFilterChange = (field: keyof TransactionFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value,
      page: field !== 'page' && field !== 'size' ? 1 : prev.page // Reset to first page when changing filters
    }));
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
    setFilters({
      page: 1,
      size: 50
    });
  };

  const hasActiveFilters = filters.startDate || filters.endDate || filters.accountId;
  
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
            startIcon={<Analytics />}
            sx={{ mr: 2 }}
            onClick={() => navigate('/transactions/analysis')}
          >
            Analysis
          </Button>
          <Button
            variant="outlined"
            startIcon={<Upload />}
            sx={{ mr: 2 }}
            onClick={() => navigate('/import')}
          >
            Import
          </Button>
          <SmartAutomation 
            uncategorizedCount={uncategorizedCount}
            selectedTransactionIds={Array.from(selectedTransactions)}
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
        </Box>
      </Box>

      {/* Filters Card */}
      {showFilters && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3}>
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
              <Grid item xs={12} sm={3}>
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
              <Grid item xs={12} sm={4}>
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
              <Grid item xs={12} sm={2}>
                <Button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  startIcon={<Clear />}
                  fullWidth
                  size="small"
                >
                  Clear
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Account</TableCell>
              <TableCell>Payee</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactionData?.items?.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell sx={{ minWidth: 120 }}>
                  <InlineDateEdit
                    value={transaction.date}
                    onSave={(newValue) => handleInlineDateChange(transaction.id, newValue)}
                    isSaving={savingTransactions.has(transaction.id)}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 200 }}>
                  <InlineTextEdit
                    value={transaction.description || ''}
                    onSave={(newValue) => handleInlineDescriptionChange(transaction.id, newValue)}
                    placeholder="Enter description..."
                    emptyDisplay="-"
                    isSaving={savingTransactions.has(transaction.id)}
                    maxLength={255}
                  />
                </TableCell>
                <TableCell>{transaction.account?.name}</TableCell>
                <TableCell sx={{ minWidth: 150 }}>
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
                    isSaving={savingTransactions.has(transaction.id)}
                    placeholder="Select payee..."
                    emptyDisplay="-"
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 150 }}>
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
                    isSaving={savingTransactions.has(transaction.id)}
                    placeholder="Select category..."
                    emptyDisplay="-"
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <InlineToggleEdit
                    value={transaction.type}
                    options={transactionTypeOptions}
                    onSave={(newValue) => handleInlineTypeChange(transaction.id, newValue)}
                    isSaving={savingTransactions.has(transaction.id)}
                  />
                </TableCell>
                <TableCell align="right">
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
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(transaction)}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(transaction.id)}
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {/* Pagination */}
        {transactionData && (
          <Box display="flex" justifyContent="space-between" alignItems="center" p={2} flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <Typography variant="body2" color="textSecondary">
                Showing {((transactionData.page - 1) * transactionData.size) + 1} to {Math.min(transactionData.page * transactionData.size, transactionData.total)} of {transactionData.total} transactions
              </Typography>
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
            </Box>
            {transactionData.pages > 1 && (
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
    </Box>
  );
};

export default Transactions;
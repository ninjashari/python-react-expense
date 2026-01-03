import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  CircularProgress,
  LinearProgress,
  Backdrop,
  Alert,
} from '@mui/material';
import { Add, Edit, Delete, Refresh, Calculate, FileDownload, FileUpload } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { accountsApi, transactionsApi } from '../services/api';
import { Account, CreateAccountDto } from '../types';
import { formatCurrency, formatAccountType } from '../utils/formatters';
import { useCreateWithConfirm, useUpdateWithConfirm, useDeleteWithConfirm } from '../hooks/useApiWithConfirm';

const accountTypes = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
  { value: 'ppf', label: 'PPF (Public Provident Fund)' },
];

const Accounts: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateDialogOpen, setRecalculateDialogOpen] = useState(false);
  const [accountToRecalculate, setAccountToRecalculate] = useState<Account | null>(null);
  const [recalculateResult, setRecalculateResult] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const queryClient = useQueryClient();

  // Helper function to calculate credit utilization percentage
  const getCreditUtilization = (balance: number, creditLimit: number) => {
    if (!creditLimit || creditLimit === 0) return 0;
    // For credit cards, positive balance = debt, negative balance = credit balance
    const utilization = Math.max(0, (balance / creditLimit) * 100);
    return Math.min(utilization, 100);
  };

  // Helper function to get available credit
  const getAvailableCredit = (balance: number, creditLimit: number) => {
    // For credit cards: available = limit - debt (positive balance)
    // If balance is negative (credit balance), add it to available credit
    return creditLimit - Math.max(0, balance);
  };

  // Helper function to determine balance color for credit cards
  const getCreditBalanceColor = (balance: number) => {
    // For credit cards: positive balance = debt (bad), negative balance = credit (good)
    return balance > 0 ? 'error.main' : 'success.main';
  };

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<CreateAccountDto>({
    defaultValues: {
      name: '',
      type: 'checking',
      balance: 0,
      opening_date: new Date().toISOString().split('T')[0],
      account_number: '',
      card_number: '',
      card_expiry_month: undefined,
      card_expiry_year: undefined,
      interest_rate: undefined,
    },
  });

  const watchAccountType = watch('type');

  const { data: accounts, isLoading, error, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const createMutation = useCreateWithConfirm(accountsApi.create, {
    resourceName: 'Account',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useUpdateWithConfirm(
    ({ id, data }: { id: string; data: Partial<CreateAccountDto> }) =>
      accountsApi.update(id, data),
    {
      resourceName: 'Account',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        handleCloseDialog();
      },
    }
  );

  const deleteMutation = useDeleteWithConfirm(accountsApi.delete, {
    resourceName: 'Account',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const handleOpenDialog = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      reset({
        name: account.name,
        type: account.type,
        balance: account.balance,
        opening_date: account.opening_date,
        account_number: account.account_number || '',
        card_number: account.card_number || '',
        card_expiry_month: account.card_expiry_month,
        card_expiry_year: account.card_expiry_year,
        credit_limit: account.credit_limit,
        bill_generation_date: account.bill_generation_date,
        payment_due_date: account.payment_due_date,
        interest_rate: account.interest_rate,
      });
    } else {
      setEditingAccount(null);
      reset({
        name: '',
        type: 'checking',
        balance: 0,
        opening_date: new Date().toISOString().split('T')[0],
        account_number: '',
        card_number: '',
        card_expiry_month: undefined,
        card_expiry_year: undefined,
        interest_rate: undefined,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAccount(null);
    reset();
  };

  const onSubmit = (data: CreateAccountDto) => {
    // Ensure numeric fields are properly converted
    const submitData = {
      ...data,
      balance: Number(data.balance) || 0,
      account_number: data.account_number || undefined,
      card_number: data.card_number || undefined,
      card_expiry_month: data.card_expiry_month ? Number(data.card_expiry_month) : undefined,
      card_expiry_year: data.card_expiry_year ? Number(data.card_expiry_year) : undefined,
      credit_limit: data.credit_limit ? Number(data.credit_limit) : undefined,
      bill_generation_date: data.bill_generation_date ? Number(data.bill_generation_date) : undefined,
      payment_due_date: data.payment_due_date ? Number(data.payment_due_date) : undefined,
      interest_rate: data.interest_rate ? Number(data.interest_rate) : undefined,
    };


    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (account: Account) => {
    if (window.confirm(`Are you sure you want to delete the account "${account.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(account.id);
    }
  };

  const handleRecalculateBalances = (account: Account) => {
    setAccountToRecalculate(account);
    setRecalculateDialogOpen(true);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Recalculate balances for all accounts first
      await accountsApi.recalculateBalances();
      
      // Then refresh accounts data
      await refetch();
      
      // Also invalidate related queries for a comprehensive refresh
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error) {
      console.error('Failed to refresh accounts:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConfirmRecalculate = async () => {
    if (!accountToRecalculate) return;
    
    setRecalculateDialogOpen(false);
    setIsRecalculating(true);
    setRecalculateResult(null);
    
    try {
      const result = await transactionsApi.recalculateAccountBalances(accountToRecalculate.id);
      
      setRecalculateResult({
        success: true,
        message: result.message,
        transactions_updated: result.transactions_updated,
        account_name: result.account_name
      });
      
      // Refresh accounts and transactions data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      
    } catch (error: any) {
      console.error('Failed to recalculate balances:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to recalculate balances';
      setRecalculateResult({
        error: true,
        message: errorMessage
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleExport = async () => {
    if (!accounts || accounts.length === 0) {
      return;
    }

    try {
      const response = await accountsApi.exportToExcel();
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'accounts_export.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error: any) {
      console.error('Export failed:', error);
    }
  };

  const handleImportFile = async (file: File) => {
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await accountsApi.import(formData);
      setImportResult(result);
      
      // Refresh accounts to show new data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      
    } catch (error: any) {
      setImportResult({
        error: true,
        message: error.response?.data?.detail || 'Failed to import accounts'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls,.csv';
    fileInput.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleImportFile(file);
      }
    };
    fileInput.click();
  };

  if (isLoading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Accounts</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            disabled
          >
            Add Account
          </Button>
        </Box>
        
        <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="400px">
          <CircularProgress size={48} />
          <Typography variant="h6" mt={2} color="textSecondary">
            Loading accounts...
          </Typography>
          <Typography variant="body2" color="textSecondary" mt={1}>
            Fetching your account data
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Accounts</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            Add Account
          </Button>
        </Box>
        
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? 'Retrying...' : 'Retry'}
            </Button>
          }
        >
          Failed to load accounts. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Accounts</Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<FileUpload />}
            onClick={handleImport}
            disabled={isImporting || isRecalculating}
            color="primary"
          >
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={handleExport}
            disabled={!accounts || accounts.length === 0 || isRecalculating}
            color="primary"
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={isRecalculating || isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            disabled={isRecalculating}
          >
            Add Account
          </Button>
        </Box>
      </Box>

      {/* Import Results */}
      {importResult && (
        <Alert 
          severity={importResult.error ? 'error' : 'success'}
          onClose={() => setImportResult(null)}
          sx={{ mb: 2 }}
        >
          {importResult.error ? (
            importResult.message
          ) : (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {importResult.message}
              </Typography>
              <Typography variant="body2">
                • Total rows processed: {importResult.total_rows}
              </Typography>
              <Typography variant="body2">
                • New accounts created: {importResult.created_count}
              </Typography>
              <Typography variant="body2">
                • Existing accounts updated: {importResult.updated_count}
              </Typography>
              <Typography variant="body2">
                • Accounts skipped (no changes): {importResult.skipped_count}
              </Typography>
              {importResult.error_count > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="error">
                    • Errors encountered: {importResult.error_count}
                  </Typography>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <Box sx={{ ml: 2 }}>
                      {importResult.errors.map((error: string, index: number) => (
                        <Typography key={index} variant="body2" color="error">
                          {error}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Alert>
      )}

      {/* Group accounts by type */}
      {(() => {
        const sortedAccounts = accounts?.sort((a, b) => a.name.localeCompare(b.name)) || [];
        const groupedAccounts: { [key: string]: Account[] } = {};
        
        sortedAccounts.forEach((account) => {
          if (!groupedAccounts[account.type]) {
            groupedAccounts[account.type] = [];
          }
          groupedAccounts[account.type].push(account);
        });

        // Define order of account types
        const typeOrder = ['checking', 'savings', 'credit', 'cash', 'investment', 'ppf'];
        
        return typeOrder.map((type) => {
          const accountsOfType = groupedAccounts[type];
          if (!accountsOfType || accountsOfType.length === 0) return null;

          return (
            <Box key={type} mb={4}>
              <Typography variant="h5" gutterBottom sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                {formatAccountType(type)} Accounts ({accountsOfType.length})
              </Typography>
              <Grid container spacing={3}>
                {accountsOfType.map((account) => (
          <Grid item xs={12} sm={6} md={4} key={account.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {account.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {formatAccountType(account.type)}
                    </Typography>
                    <Typography
                      variant="h5"
                      color={account.type === 'credit' ? getCreditBalanceColor(Number(account.balance || 0)) : (account.balance >= 0 ? 'success.main' : 'error.main')}
                      gutterBottom
                    >
                      {account.type === 'credit' && account.balance > 0 ? `${formatCurrency(account.balance)} debt` : formatCurrency(account.balance)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Opened: {new Date(account.opening_date).toLocaleDateString()}
                    </Typography>
                    {account.type === 'credit' && (
                      <Box mt={1}>
                        {account.credit_limit && (
                          <>
                            <Typography variant="caption" display="block">
                              Credit Limit: {formatCurrency(account.credit_limit)}
                            </Typography>
                            <Typography variant="caption" display="block" color="textSecondary">
                              Available: {formatCurrency(getAvailableCredit(Number(account.balance || 0), account.credit_limit))}
                            </Typography>
                            <Box mt={1}>
                              <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                                <Typography variant="caption" color="textSecondary">
                                  Credit Utilization
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {getCreditUtilization(Number(account.balance || 0), account.credit_limit).toFixed(1)}%
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={getCreditUtilization(Number(account.balance || 0), account.credit_limit)}
                                color={
                                  getCreditUtilization(Number(account.balance || 0), account.credit_limit) > 90
                                    ? 'error'
                                    : getCreditUtilization(Number(account.balance || 0), account.credit_limit) > 70
                                    ? 'warning'
                                    : 'primary'
                                }
                                sx={{ height: 6, borderRadius: 3 }}
                              />
                            </Box>
                          </>
                        )}
                        {account.bill_generation_date && (
                          <Typography variant="caption" display="block" mt={1}>
                            Bill Date: {account.bill_generation_date}th of month
                          </Typography>
                        )}
                        {account.payment_due_date && (
                          <Typography variant="caption" display="block">
                            Payment Due: {account.payment_due_date}th of month
                          </Typography>
                        )}
                      </Box>
                    )}
                    {account.type === 'ppf' && account.interest_rate && (
                      <Box mt={1}>
                        <Typography variant="caption" display="block">
                          Interest Rate: {account.interest_rate}% per annum
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(account)}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleRecalculateBalances(account)}
                      disabled={isRecalculating}
                      title="Recalculate transaction balances"
                    >
                      {isRecalculating ? <CircularProgress size={16} /> : <Calculate />}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(account)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
                ))}
              </Grid>
            </Box>
          );
        });
      })()}

      {/* Calculation Overlay */}
      <Backdrop
        sx={{ 
          color: '#fff', 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'rgba(0, 0, 0, 0.3)'
        }}
        open={isRecalculating && !isLoading}
      >
        <Box display="flex" flexDirection="column" alignItems="center">
          <CircularProgress color="inherit" size={48} />
          <Typography variant="h6" mt={2}>
            Recalculating balances...
          </Typography>
          <Typography variant="body2" mt={1} textAlign="center">
            Processing transactions to ensure accurate account balances
          </Typography>
        </Box>
      </Backdrop>

      {/* Account Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingAccount ? 'Edit Account' : 'Add Account'}
          </DialogTitle>
          <DialogContent>
            <Controller
              name="name"
              control={control}
              rules={{ required: 'Account name is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Account Name"
                  fullWidth
                  margin="normal"
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              )}
            />

            <Controller
              name="type"
              control={control}
              rules={{ required: 'Account type is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Account Type"
                  fullWidth
                  margin="normal"
                  error={!!errors.type}
                  helperText={errors.type?.message}
                >
                  {accountTypes.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="balance"
              control={control}
              rules={{ required: 'Balance is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Initial Balance"
                  type="number"
                  fullWidth
                  margin="normal"
                  error={!!errors.balance}
                  helperText={errors.balance?.message}
                />
              )}
            />

            <Controller
              name="opening_date"
              control={control}
              rules={{ required: 'Opening date is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Opening Date"
                  type="date"
                  fullWidth
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                  error={!!errors.opening_date}
                  helperText={errors.opening_date?.message}
                />
              )}
            />

            <Controller
              name="account_number"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Account Number"
                  fullWidth
                  margin="normal"
                  helperText="Bank account number (optional)"
                />
              )}
            />

            {(watchAccountType === 'checking' || watchAccountType === 'savings' || watchAccountType === 'credit') && (
              <>
                <Controller
                  name="card_number"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Card Number (Last 4 digits)"
                      fullWidth
                      margin="normal"
                      inputProps={{ maxLength: 4, pattern: '[0-9]*' }}
                      helperText="Only enter last 4 digits for security"
                    />
                  )}
                />

                <Box display="flex" gap={2}>
                  <Controller
                    name="card_expiry_month"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Expiry Month"
                        type="number"
                        fullWidth
                        margin="normal"
                        inputProps={{ min: 1, max: 12 }}
                        helperText="MM (1-12)"
                      />
                    )}
                  />

                  <Controller
                    name="card_expiry_year"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Expiry Year"
                        type="number"
                        fullWidth
                        margin="normal"
                        inputProps={{ min: new Date().getFullYear(), max: new Date().getFullYear() + 20 }}
                        helperText="YYYY"
                      />
                    )}
                  />
                </Box>
              </>
            )}

            {watchAccountType === 'credit' && (
              <>
                <Controller
                  name="credit_limit"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Credit Limit"
                      type="number"
                      fullWidth
                      margin="normal"
                    />
                  )}
                />

                <Controller
                  name="bill_generation_date"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Bill Generation Date (Day of Month)"
                      type="number"
                      fullWidth
                      margin="normal"
                      inputProps={{ min: 1, max: 31 }}
                    />
                  )}
                />

                <Controller
                  name="payment_due_date"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Payment Due Date (Day of Month)"
                      type="number"
                      fullWidth
                      margin="normal"
                      inputProps={{ min: 1, max: 31 }}
                      helperText="Enter day of month (1-31)"
                    />
                  )}
                />
              </>
            )}

            {watchAccountType === 'ppf' && (
              <Controller
                name="interest_rate"
                control={control}
                rules={{ 
                  required: 'Interest rate is required for PPF accounts',
                  min: { value: 0.1, message: 'Interest rate must be greater than 0' },
                  max: { value: 50, message: 'Interest rate cannot exceed 50%' }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Annual Interest Rate (%)"
                    type="number"
                    fullWidth
                    margin="normal"
                    inputProps={{ 
                      min: 0.1, 
                      max: 50, 
                      step: 0.1 
                    }}
                    helperText="Enter annual interest rate percentage (e.g., 7.1 for 7.1%)"
                    error={!!errors.interest_rate}
                  />
                )}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingAccount ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Recalculate Balances Confirmation Dialog */}
      <Dialog open={recalculateDialogOpen} onClose={() => setRecalculateDialogOpen(false)}>
        <DialogTitle>Recalculate Transaction Balances</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Recalculate transaction balances for "{accountToRecalculate?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This will recalculate the balance_after_transaction field for all transactions in this account. 
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
            disabled={isRecalculating}
          >
            {isRecalculating ? 'Recalculating...' : 'Recalculate Balances'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recalculate Results */}
      {recalculateResult && (
        <Backdrop open={true} sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
          <Dialog 
            open={true} 
            onClose={() => setRecalculateResult(null)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {recalculateResult.error ? 'Recalculation Failed' : 'Recalculation Complete'}
            </DialogTitle>
            <DialogContent>
              <Alert severity={recalculateResult.error ? 'error' : 'success'} sx={{ mb: 2 }}>
                {recalculateResult.message}
              </Alert>
              {!recalculateResult.error && (
                <Typography variant="body2">
                  Transactions updated: {recalculateResult.transactions_updated}
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRecalculateResult(null)} variant="contained">
                OK
              </Button>
            </DialogActions>
          </Dialog>
        </Backdrop>
      )}
    </Box>
  );
};

export default Accounts;
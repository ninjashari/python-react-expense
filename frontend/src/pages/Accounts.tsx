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
import { Add, Edit, Delete, Refresh } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { accountsApi } from '../services/api';
import { Account, CreateAccountDto } from '../types';
import { formatCurrency, formatAccountType } from '../utils/formatters';
import { useCreateWithConfirm, useUpdateWithConfirm, useDeleteWithConfirm } from '../hooks/useApiWithConfirm';

const accountTypes = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
];

const Accounts: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
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
    },
  });

  const watchAccountType = watch('type');

  const { data: accounts, isLoading, error, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      // Show specific loading state for recalculation
      setIsRecalculating(true);
      
      try {
        await accountsApi.recalculateBalances();
      } catch (error) {
        console.warn('Failed to recalculate balances:', error);
        // Continue with fetching accounts even if recalculation fails
      } finally {
        setIsRecalculating(false);
      }
      
      return accountsApi.getAll();
    },
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
        credit_limit: account.credit_limit,
        bill_generation_date: account.bill_generation_date,
        payment_due_date: account.payment_due_date,
      });
    } else {
      setEditingAccount(null);
      reset({
        name: '',
        type: 'checking',
        balance: 0,
        opening_date: new Date().toISOString().split('T')[0],
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
      credit_limit: data.credit_limit ? Number(data.credit_limit) : undefined,
      bill_generation_date: data.bill_generation_date ? Number(data.bill_generation_date) : undefined,
      payment_due_date: data.payment_due_date ? Number(data.payment_due_date) : undefined,
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
            {isRecalculating ? 'Recalculating account balances...' : 'Loading accounts...'}
          </Typography>
          <Typography variant="body2" color="textSecondary" mt={1}>
            {isRecalculating ? 'Processing all transactions to ensure accurate balances' : 'Fetching your account data'}
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
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
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
            startIcon={<Refresh />}
            onClick={() => refetch()}
            disabled={isRecalculating}
          >
            {isRecalculating ? 'Recalculating...' : 'Refresh'}
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

      <Grid container spacing={3}>
        {accounts?.sort((a, b) => a.name.localeCompare(b.name)).map((account) => (
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
    </Box>
  );
};

export default Accounts;
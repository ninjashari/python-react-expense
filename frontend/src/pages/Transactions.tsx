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
  Chip,
  CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete, Upload } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { transactionsApi, accountsApi, payeesApi, categoriesApi } from '../services/api';
import { Transaction, CreateTransactionDto } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useCreateWithToast, useUpdateWithToast, useDeleteWithToast } from '../hooks/useApiWithToast';
import { usePageTitle, getPageTitle } from '../hooks/usePageTitle';

const transactionTypes = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' },
];

const Transactions: React.FC = () => {
  usePageTitle(getPageTitle('transactions', 'Income & Expenses'));
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<CreateTransactionDto>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      description: '',
      type: 'expense',
      account_id: 0,
    },
  });

  const watchTransactionType = watch('type');

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => transactionsApi.getAll({ limit: 100 }),
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

  const createMutation = useCreateWithToast(transactionsApi.create, {
    resourceName: 'Transaction',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useUpdateWithToast(
    ({ id, data }: { id: number; data: Partial<CreateTransactionDto> }) =>
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

  const handleOpenDialog = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
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
      reset({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        description: '',
        type: 'expense',
        account_id: 0,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTransaction(null);
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

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      deleteMutation.mutate(id);
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'success';
      case 'expense':
        return 'error';
      case 'transfer':
        return 'info';
      default:
        return 'default';
    }
  };

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
            startIcon={<Upload />}
            sx={{ mr: 2 }}
            onClick={() => navigate('/import')}
          >
            Import
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            Add Transaction
          </Button>
        </Box>
      </Box>

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
            {transactions?.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{formatDate(transaction.date)}</TableCell>
                <TableCell>{transaction.description || '-'}</TableCell>
                <TableCell>{transaction.account?.name}</TableCell>
                <TableCell>{transaction.payee?.name || '-'}</TableCell>
                <TableCell>
                  {transaction.category ? (
                    <Chip
                      label={transaction.category.name}
                      size="small"
                      sx={{
                        backgroundColor: transaction.category.color,
                        color: 'white',
                      }}
                    />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={transaction.type}
                    size="small"
                    color={getTransactionTypeColor(transaction.type) as any}
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
                >
                  {accounts?.map((account) => (
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
                    {accounts?.map((account) => (
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
                <TextField
                  {...field}
                  select
                  label="Payee (Optional)"
                  fullWidth
                  margin="normal"
                >
                  <MenuItem value="">None</MenuItem>
                  {payees?.map((payee) => (
                    <MenuItem key={payee.id} value={payee.id}>
                      {payee.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="category_id"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Category (Optional)"
                  fullWidth
                  margin="normal"
                >
                  <MenuItem value="">None</MenuItem>
                  {categories?.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </TextField>
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
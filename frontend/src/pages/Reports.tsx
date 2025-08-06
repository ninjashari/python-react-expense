import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Paper,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { MultiValue } from 'react-select';
import { reportsApi, accountsApi, categoriesApi, payeesApi } from '../services/api';
import MultiSelectDropdown, { Option } from '../components/MultiSelectDropdown';
import { formatCurrency } from '../utils/formatters';
import { useUserInteractionNotifications } from '../hooks/useUserInteractionNotifications';
import { useToast } from '../contexts/ToastContext';
import { usePageTitle, getPageTitle } from '../hooks/usePageTitle';
import { Transaction } from '../types';

const Reports: React.FC = () => {
  usePageTitle(getPageTitle('reports', 'Transaction Filters & Analysis'));
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<MultiValue<Option>>([]);
  const [selectedCategories, setSelectedCategories] = useState<MultiValue<Option>>([]);
  const [selectedPayees, setSelectedPayees] = useState<MultiValue<Option>>([]);
  const [selectedTransactionType, setSelectedTransactionType] = useState<string>('');
  
  const toast = useToast();
  const userNotifications = useUserInteractionNotifications();

  // Get filter data
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll(),
  });

  const { data: payees } = useQuery({
    queryKey: ['payees'],
    queryFn: () => payeesApi.getAll(),
  });

  // Build filter parameters
  const getFilterParams = () => ({
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    account_ids: selectedAccounts.length > 0 ? selectedAccounts.map(acc => acc.value) : undefined,
    category_ids: selectedCategories.length > 0 ? selectedCategories.map(cat => cat.value) : undefined,
    payee_ids: selectedPayees.length > 0 ? selectedPayees.map(payee => payee.value) : undefined,
    transaction_type: selectedTransactionType || undefined,
  });

  // Get filtered transactions
  const { data: filteredTransactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ['reports', 'filtered-transactions', getFilterParams()],
    queryFn: () => reportsApi.getFilteredTransactions(getFilterParams()),
    enabled: false,
  });

  // Convert data to options for multi-select
  const accountOptions: Option[] = accounts?.sort((a, b) => a.name.localeCompare(b.name)).map(acc => ({
    value: acc.id,
    label: acc.name,
  })) || [];

  const categoryOptions: Option[] = categories?.sort((a, b) => a.name.localeCompare(b.name)).map(cat => ({
    value: cat.id,
    label: cat.name,
    color: cat.color,
  })) || [];

  const payeeOptions: Option[] = payees?.sort((a, b) => a.name.localeCompare(b.name)).map(payee => ({
    value: payee.id,
    label: payee.name,
  })) || [];


  const handleGenerateReport = async () => {
    toast.showInfo('Loading filtered transactions...');
    
    try {
      await refetchTransactions();
      toast.showSuccess('Transactions loaded successfully!');
    } catch (error) {
      toast.showError('Failed to load transactions. Please try again.');
    }
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedAccounts([]);
    setSelectedCategories([]);
    setSelectedPayees([]);
    setSelectedTransactionType('');
    userNotifications.showFiltersCleared();
  };

  // Calculate summary from filtered transactions
  const calculateSummary = (transactions: Transaction[] | undefined) => {
    if (!transactions || transactions.length === 0) {
      return {
        totalIncome: 0,
        totalExpense: 0,
        totalTransfer: 0,
        netAmount: 0,
        transactionCount: 0,
      };
    }

    let totalIncome = 0;
    let totalExpense = 0;
    let totalTransfer = 0;

    transactions.forEach(transaction => {
      const amount = Number(transaction.amount);
      switch (transaction.type) {
        case 'income':
          totalIncome += amount;
          break;
        case 'expense':
          totalExpense += amount;
          break;
        case 'transfer':
          totalTransfer += amount;
          break;
      }
    });

    return {
      totalIncome,
      totalExpense,
      totalTransfer,
      netAmount: totalIncome - totalExpense,
      transactionCount: transactions.length,
    };
  };

  const summary = calculateSummary(filteredTransactions);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Transaction Reports
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Apply filters to view and analyze your transactions
      </Typography>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filter Transactions
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <MultiSelectDropdown
                label="Accounts"
                options={accountOptions}
                value={selectedAccounts}
                onChange={setSelectedAccounts}
                placeholder="Select accounts to filter by..."
              />
            </Grid>

            <Grid item xs={12}>
              <MultiSelectDropdown
                label="Categories"
                options={categoryOptions}
                value={selectedCategories}
                onChange={setSelectedCategories}
                placeholder="Select categories to filter by..."
              />
            </Grid>

            <Grid item xs={12}>
              <MultiSelectDropdown
                label="Payees"
                options={payeeOptions}
                value={selectedPayees}
                onChange={setSelectedPayees}
                placeholder="Select payees to filter by..."
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Transaction Type</InputLabel>
                <Select
                  value={selectedTransactionType}
                  label="Transaction Type"
                  onChange={(e) => setSelectedTransactionType(e.target.value)}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="income">Income</MenuItem>
                  <MenuItem value="expense">Expense</MenuItem>
                  <MenuItem value="transfer">Transfer</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" gap={2}>
                <Button
                  variant="contained"
                  onClick={handleGenerateReport}
                  disabled={transactionsLoading}
                >
                  {transactionsLoading ? 'Loading...' : 'Apply Filters'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary */}
      {filteredTransactions && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Summary ({summary.transactionCount} transactions)
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">
                    {formatCurrency(summary.totalIncome)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Income
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="error.main">
                    {formatCurrency(summary.totalExpense)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Expenses
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="info.main">
                    {formatCurrency(summary.totalTransfer)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Transfers
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography
                    variant="h4"
                    color={summary.netAmount >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(summary.netAmount)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Net Amount
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Filtered Transactions Table */}
      {filteredTransactions && filteredTransactions.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Filtered Transactions ({filteredTransactions.length})
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Account</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Payee</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {new Date(transaction.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell>{transaction.account?.name}</TableCell>
                      <TableCell>
                        {transaction.category && (
                          <Chip
                            label={transaction.category.name}
                            size="small"
                            sx={{
                              backgroundColor: transaction.category.color,
                              color: 'white',
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell>{transaction.payee?.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={transaction.type}
                          size="small"
                          color={
                            transaction.type === 'income'
                              ? 'success'
                              : transaction.type === 'expense'
                              ? 'error'
                              : 'info'
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          color={
                            transaction.type === 'income'
                              ? 'success.main'
                              : transaction.type === 'expense'
                              ? 'error.main'
                              : 'text.primary'
                          }
                        >
                          {formatCurrency(transaction.amount)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {filteredTransactions && filteredTransactions.length === 0 && (
        <Alert severity="info">
          No transactions found matching the selected filters. Try adjusting your filter criteria.
        </Alert>
      )}

      {/* Loading indicator */}
      {transactionsLoading && (
        <Box display="flex" justifyContent="center" mt={3}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
};

export default Reports;
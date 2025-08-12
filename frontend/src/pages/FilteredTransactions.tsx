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
  Chip,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Pagination,
  TextField,
  MenuItem,
  Alert,
  FormControl,
  InputLabel,
  Select,
  Autocomplete,
  CircularProgress as MuiCircularProgress,
} from '@mui/material';
import { Clear } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, accountsApi, payeesApi, categoriesApi } from '../services/api';
import { Transaction, PaginatedResponse, Account, Category, Payee } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { usePageTitle, getPageTitle } from '../hooks/usePageTitle';
import MultiSelectDropdown, { Option } from '../components/MultiSelectDropdown';
import { useUpdateWithToast } from '../hooks/useApiWithToast';

interface FilteredTransactionFilters {
  startDate?: string;
  endDate?: string;
  accountIds: Option[];
  categoryIds: Option[];
  payeeIds: Option[];
  transactionType?: string;
  page: number;
  size: number;
}

const transactionTypes = [
  { value: '', label: 'All Types' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' },
];

const pageSizeOptions = [
  { value: 10, label: '10 per page' },
  { value: 20, label: '20 per page' },
  { value: 50, label: '50 per page' },
  { value: 100, label: '100 per page' },
  { value: 200, label: '200 per page' },
];

const FilteredTransactions: React.FC = () => {
  usePageTitle(getPageTitle('filtered-transactions', 'Transaction Analysis'));
  
  const [filters, setFilters] = useState<FilteredTransactionFilters>({
    accountIds: [],
    categoryIds: [],
    payeeIds: [],
    page: 1,
    size: 50
  });
  
  const [savingTransactions, setSavingTransactions] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch reference data
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

  // Build API parameters
  const getApiParams = () => ({
    page: filters.page,
    size: filters.size,
    start_date: filters.startDate,
    end_date: filters.endDate,
    account_ids: filters.accountIds.length > 0 ? filters.accountIds.map(opt => opt.value).join(',') : undefined,
    category_ids: filters.categoryIds.length > 0 ? filters.categoryIds.map(opt => opt.value).join(',') : undefined,
    payee_ids: filters.payeeIds.length > 0 ? filters.payeeIds.map(opt => opt.value).join(',') : undefined,
    transaction_type: filters.transactionType || undefined,
  });

  // Fetch transactions
  const { data: transactionData, isLoading: transactionsLoading } = useQuery<PaginatedResponse<Transaction>>({
    queryKey: ['filtered-transactions', filters],
    queryFn: () => transactionsApi.getAll(getApiParams()),
  });

  // Define hasActiveFilters before using it
  const hasActiveFilters = () => {
    return filters.startDate || 
           filters.endDate || 
           filters.accountIds.length > 0 || 
           filters.categoryIds.length > 0 || 
           filters.payeeIds.length > 0 || 
           (filters.transactionType && filters.transactionType !== '');
  };

  // Fetch summary
  const { data: summary } = useQuery({
    queryKey: ['transaction-summary', filters],
    queryFn: () => transactionsApi.getSummary(getApiParams()),
    enabled: !!hasActiveFilters(),
  });

  // Mutation for inline updates
  const updateMutation = useUpdateWithToast(
    ({ id, data }: { id: string; data: Partial<any> }) =>
      transactionsApi.update(id, data),
    {
      resourceName: 'Transaction',
      onSuccess: () => {
        // Invalidate both filtered transactions and summary
        queryClient.invalidateQueries({ queryKey: ['filtered-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['transaction-summary'] });
      },
    }
  );

  // Inline editing functions
  const handleInlineUpdate = async (transactionId: string, field: 'category_id' | 'payee_id', value: string | null) => {
    setSavingTransactions(prev => new Set(prev).add(transactionId));
    
    try {
      await updateMutation.mutateAsync({
        id: transactionId,
        data: { [field]: value || undefined }
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

  const handleInlineCategoryChange = (transactionId: string, categoryId: string | null) => {
    handleInlineUpdate(transactionId, 'category_id', categoryId);
  };

  const handleInlinePayeeChange = (transactionId: string, payeeId: string | null) => {
    handleInlineUpdate(transactionId, 'payee_id', payeeId);
  };

  const handleFilterChange = (field: keyof FilteredTransactionFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
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
      accountIds: [],
      categoryIds: [],
      payeeIds: [],
      page: 1,
      size: 50
    });
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

  const formatAccountOptions = (accounts: Account[] = []) => 
    accounts.map(account => ({ value: account.id, label: account.name }));

  const formatCategoryOptions = (categories: Category[] = []) => 
    categories.map(category => ({ value: category.id, label: category.name }));

  const formatPayeeOptions = (payees: Payee[] = []) => 
    payees.map(payee => ({ value: payee.id, label: payee.name }));

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
        <Typography variant="h4">Transaction Analysis</Typography>
        <Button
          onClick={clearFilters}
          disabled={!hasActiveFilters()}
          startIcon={<Clear />}
          variant="outlined"
        >
          Clear All Filters
        </Button>
      </Box>

      {/* Filters Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            {/* Date Filters */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Start Date"
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
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
                onChange={(e) => handleFilterChange('endDate', e.target.value || undefined)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Transaction Type Filter */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Transaction Type"
                value={filters.transactionType || ''}
                onChange={(e) => handleFilterChange('transactionType', e.target.value || undefined)}
                fullWidth
                size="small"
              >
                {transactionTypes.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Multi-select filters */}
            <Grid item xs={12} sm={6} md={3}>
              <MultiSelectDropdown
                label="Accounts"
                options={formatAccountOptions(accounts)}
                value={filters.accountIds}
                onChange={(values) => handleFilterChange('accountIds', values || [])}
                placeholder="Select accounts..."
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <MultiSelectDropdown
                label="Categories"
                options={formatCategoryOptions(categories)}
                value={filters.categoryIds}
                onChange={(values) => handleFilterChange('categoryIds', values || [])}
                placeholder="Select categories..."
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <MultiSelectDropdown
                label="Payees"
                options={formatPayeeOptions(payees)}
                value={filters.payeeIds}
                onChange={(values) => handleFilterChange('payeeIds', values || [])}
                placeholder="Select payees..."
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Box display="flex" alignItems="center" height="100%">
                <Typography variant="body2" color="textSecondary">
                  {hasActiveFilters() 
                    ? `${transactionData?.total || 0} transactions found`
                    : 'Apply filters to analyze transactions'
                  }
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary Card */}
      {summary && hasActiveFilters() && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Summary
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">
                    {formatCurrency(summary.total_income)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Income
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="error.main">
                    {formatCurrency(summary.total_expense)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Expense
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography 
                    variant="h4" 
                    color={summary.net_amount >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(summary.net_amount)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Net Amount
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary.main">
                    {summary.transaction_count}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Transactions
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* No filters message */}
      {!hasActiveFilters() && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Select filters above to analyze your transactions. You can filter by date range, accounts, categories, payees, and transaction type.
        </Alert>
      )}

      {/* Results */}
      {hasActiveFilters() && (
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
              </TableRow>
            </TableHead>
            <TableBody>
              {transactionData?.items?.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{formatDate(transaction.date)}</TableCell>
                  <TableCell>{transaction.description || '-'}</TableCell>
                  <TableCell>{transaction.account?.name}</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>
                  <Box sx={{ position: 'relative' }}>
                    <Autocomplete
                      size="small"
                      value={payees?.find(p => p.id === transaction.payee_id) || null}
                      onChange={(_, newValue) => handleInlinePayeeChange(transaction.id, newValue?.id || null)}
                      options={payees?.sort((a, b) => a.name.localeCompare(b.name)) || []}
                      getOptionLabel={(option) => option.name}
                      renderInput={(params) => {
                        return (
                          <TextField
                            {...params}
                            variant="standard"
                            placeholder=""
                            InputProps={{
                              ...params.InputProps,
                              disableUnderline: true,
                              sx: { 
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'action.hover'
                                },
                                '& .MuiInputBase-input': {
                                  cursor: 'pointer',
                                  padding: '6px 8px !important',
                                  color: 'transparent !important',
                                  caretColor: 'text.primary'
                                }
                              }
                            }}
                          />
                        );
                      }}
                      sx={{
                        '& .MuiAutocomplete-endAdornment': {
                          display: 'none'
                        },
                        '& .MuiAutocomplete-input': {
                          fontSize: '0.875rem'
                        }
                      }}
                    />
                    {!savingTransactions.has(transaction.id) && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          position: 'absolute',
                          left: 8,
                          top: 6,
                          pointerEvents: 'none',
                          color: 'text.primary'
                        }}
                      >
                        {payees?.find(p => p.id === transaction.payee_id)?.name || '-'}
                      </Typography>
                    )}
                    {savingTransactions.has(transaction.id) && (
                      <MuiCircularProgress 
                        size={16} 
                        sx={{ 
                          position: 'absolute', 
                          right: 8, 
                          top: '50%', 
                          transform: 'translateY(-50%)' 
                        }} 
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell sx={{ minWidth: 150 }}>
                  <Box sx={{ position: 'relative' }}>
                    <Autocomplete
                      size="small"
                      value={categories?.find(c => c.id === transaction.category_id) || null}
                      onChange={(_, newValue) => handleInlineCategoryChange(transaction.id, newValue?.id || null)}
                      options={categories?.sort((a, b) => a.name.localeCompare(b.name)) || []}
                      getOptionLabel={(option) => option.name}
                      renderInput={(params) => {
                        return (
                          <TextField
                            {...params}
                            variant="standard"
                            placeholder=""
                            InputProps={{
                              ...params.InputProps,
                              disableUnderline: true,
                              sx: { 
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'action.hover'
                                },
                                '& .MuiInputBase-input': {
                                  cursor: 'pointer',
                                  padding: '6px 8px !important',
                                  color: 'transparent !important',
                                  caretColor: 'text.primary'
                                }
                              }
                            }}
                          />
                        );
                      }}
                      renderOption={(props, option) => (
                        <li {...props}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: option.color,
                              }}
                            />
                            {option.name}
                          </Box>
                        </li>
                      )}
                      sx={{
                        '& .MuiAutocomplete-endAdornment': {
                          display: 'none'
                        },
                        '& .MuiAutocomplete-input': {
                          fontSize: '0.875rem'
                        }
                      }}
                    />
                    {!savingTransactions.has(transaction.id) && (
                      <Box sx={{ 
                        position: 'absolute',
                        left: 8,
                        top: 6,
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}>
                        {categories?.find(c => c.id === transaction.category_id) ? (
                          <>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: categories.find(c => c.id === transaction.category_id)?.color,
                              }}
                            />
                            <Typography variant="body2">
                              {categories.find(c => c.id === transaction.category_id)?.name}
                            </Typography>
                          </>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </Box>
                    )}
                    {savingTransactions.has(transaction.id) && (
                      <MuiCircularProgress 
                        size={16} 
                        sx={{ 
                          position: 'absolute', 
                          right: 8, 
                          top: '50%', 
                          transform: 'translateY(-50%)' 
                        }} 
                      />
                    )}
                  </Box>
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
      )}
    </Box>
  );
};

export default FilteredTransactions;
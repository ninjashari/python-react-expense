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
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Clear, FilterList, Analytics, TrendingUp, FileDownload } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, accountsApi, payeesApi, categoriesApi } from '../services/api';
import { Transaction, PaginatedResponse, Account, Category, Payee } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { usePageTitle, getPageTitle } from '../hooks/usePageTitle';
import MultiSelectDropdown, { Option } from '../components/MultiSelectDropdown';
import { useUpdateWithConfirm } from '../hooks/useApiWithConfirm';
import SmartInlineEdit from '../components/SmartInlineEdit';
import { usePersistentFilters } from '../hooks/usePersistentFilters';

interface FilteredTransactionFilters {
  startDate?: string;
  endDate?: string;
  accountIds: Option[];
  categoryIds: Option[];
  payeeIds: Option[];
  transactionTypeIds: Option[];
  page: number;
  size: number;
}

const transactionTypes = [
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
  usePageTitle(getPageTitle('reports', 'Reports'));
  
  const defaultFilters: FilteredTransactionFilters = {
    accountIds: [],
    categoryIds: [],
    payeeIds: [],
    transactionTypeIds: [],
    page: 1,
    size: 50
  };

  const { filters, setFilters, clearSavedFilters } = usePersistentFilters<FilteredTransactionFilters>(
    'filtered-transactions-filters',
    defaultFilters
  );
  
  const [savingTransactions, setSavingTransactions] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [showAll, setShowAll] = useState(false);
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
    page: showAll ? 1 : filters.page,
    size: showAll ? 10000 : filters.size,
    start_date: filters.startDate,
    end_date: filters.endDate,
    account_ids: filters.accountIds.length > 0 ? filters.accountIds.map(opt => opt.value).join(',') : undefined,
    category_ids: filters.categoryIds.length > 0 ? filters.categoryIds.map(opt => opt.value).join(',') : undefined,
    payee_ids: filters.payeeIds.length > 0 ? filters.payeeIds.map(opt => opt.value).join(',') : undefined,
    transaction_type: filters.transactionTypeIds.length > 0 ? filters.transactionTypeIds.map(opt => opt.value).join(',') : undefined,
  });

  // Fetch transactions
  const { data: transactionData, isLoading: transactionsLoading } = useQuery<PaginatedResponse<Transaction>>({
    queryKey: ['filtered-transactions', filters, showAll],
    queryFn: () => transactionsApi.getAll(getApiParams()),
  });

  // Define hasActiveFilters before using it
  const hasActiveFilters = () => {
    return filters.startDate || 
           filters.endDate || 
           filters.accountIds.length > 0 || 
           filters.categoryIds.length > 0 || 
           filters.payeeIds.length > 0 || 
           filters.transactionTypeIds.length > 0;
  };

  // Fetch summary
  const { data: summary } = useQuery({
    queryKey: ['transaction-summary', filters],
    queryFn: () => transactionsApi.getSummary(getApiParams()),
    enabled: !!hasActiveFilters(),
  });

  // Mutation for inline updates
  const updateMutation = useUpdateWithConfirm(
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

  const handleInlineCategoryChange = async (transactionId: string, categoryId: string | null) => {
    await handleInlineUpdate(transactionId, 'category_id', categoryId);
  };

  const handleInlinePayeeChange = async (transactionId: string, payeeId: string | null) => {
    await handleInlineUpdate(transactionId, 'payee_id', payeeId);
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
    clearSavedFilters();
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
    accounts
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(account => ({ value: account.id, label: account.name }));

  const formatCategoryOptions = (categories: Category[] = []) => 
    categories
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(category => ({ value: category.id, label: category.name }));

  const formatPayeeOptions = (payees: Payee[] = []) => 
    payees
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(payee => ({ value: payee.id, label: payee.name }));

  const handleExport = async () => {
    if (!transactionData?.total) return;
    
    setIsExporting(true);
    try {
      const exportParams = getApiParams();
      const response = await transactionsApi.exportToExcel(exportParams);
      
      // Create blob and download
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from response headers or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'transactions_export.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      // TODO: Add toast notification for error
    } finally {
      setIsExporting(false);
    }
  };

  // Date range helper functions
  const getDateString = (date: Date) => {
    // Use local timezone to avoid date shifting issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };


  const getSelectedMonth = () => {
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && 
          start.getDate() === 1 && end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()) {
        return (start.getMonth() + 1).toString().padStart(2, '0');
      }
    }
    return '';
  };

  const getSelectedYear = () => {
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      if (start.getFullYear() === end.getFullYear() && 
          start.getMonth() === 0 && start.getDate() === 1 &&
          end.getMonth() === 11 && end.getDate() === 31) {
        return start.getFullYear().toString();
      }
    }
    return '';
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 10; year--) {
      years.push(year.toString());
    }
    return years;
  };

  const handleMonthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const month = event.target.value;
    if (month === '') {
      setFilters(prev => ({ ...prev, startDate: undefined, endDate: undefined, page: 1 }));
    } else {
      // Get current year from year dropdown or use current year
      const currentYear = getSelectedYear() || new Date().getFullYear().toString();
      const year = parseInt(currentYear);
      const monthNum = parseInt(month);
      
      // Create start date (first day of month)
      const startDate = new Date(year, monthNum - 1, 1);
      // Create end date (last day of month)
      const endDate = new Date(year, monthNum, 0);
      
      setFilters(prev => ({
        ...prev,
        startDate: getDateString(startDate),
        endDate: getDateString(endDate),
        page: 1
      }));
    }
  };

  const handleYearChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const year = event.target.value;
    if (year === '') {
      setFilters(prev => ({ ...prev, startDate: undefined, endDate: undefined, page: 1 }));
    } else {
      // Get current month selection if any
      const currentMonth = getSelectedMonth();
      const yearNum = parseInt(year);
      
      if (currentMonth) {
        // If month is selected, update for that specific month in the new year
        const monthNum = parseInt(currentMonth);
        const startDate = new Date(yearNum, monthNum - 1, 1);
        const endDate = new Date(yearNum, monthNum, 0);
        setFilters(prev => ({
          ...prev,
          startDate: getDateString(startDate),
          endDate: getDateString(endDate),
          page: 1
        }));
      } else {
        // If no month selected, show entire year
        const startDate = new Date(yearNum, 0, 1);
        const endDate = new Date(yearNum, 11, 31);
        setFilters(prev => ({
          ...prev,
          startDate: getDateString(startDate),
          endDate: getDateString(endDate),
          page: 1
        }));
      }
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
      {/* Enhanced Header */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Box display="flex" alignItems="center" gap={2} mb={1}>
              <Analytics color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h4" component="h1">
                Reports
              </Typography>
            </Box>
            <Typography variant="body1" color="textSecondary">
              Filter and analyze your transactions to gain insights into your spending patterns
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={isExporting ? <CircularProgress size={16} /> : <FileDownload />}
            onClick={handleExport}
            disabled={isExporting || transactionsLoading || !transactionData?.total}
            sx={{ alignSelf: 'flex-start' }}
          >
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </Button>
        </Box>
        {hasActiveFilters() && (
          <Alert severity="info" icon={<TrendingUp />} sx={{ mt: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
              <Typography variant="body2">
                Analyzing <strong>{transactionData?.total || 0}</strong> transactions
                {filters.startDate && filters.endDate && (
                  <> from <strong>{formatDate(filters.startDate)}</strong> to <strong>{formatDate(filters.endDate)}</strong></>
                )}
              </Typography>
            </Box>
          </Alert>
        )}
      </Box>

      {/* Enhanced Filters Card */}
      <Card sx={{ mb: 4, border: '1px solid', borderColor: 'divider', overflow: 'visible' }}>
        <CardContent sx={{ pb: 3, overflow: 'visible' }}>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <FilterList color="action" />
            <Typography variant="h6" component="h2">
              Filter Options
            </Typography>
          </Box>
          
          <Grid container spacing={3} alignItems="stretch">
            {/* Date Filters Section */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom sx={{ mb: 2 }}>
                Date Filters
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Month"
                value={getSelectedMonth()}
                onChange={handleMonthChange}
                fullWidth
                size="small"
                helperText="Select specific month"
              >
                <MenuItem value="">All Months</MenuItem>
                <MenuItem value="01">January</MenuItem>
                <MenuItem value="02">February</MenuItem>
                <MenuItem value="03">March</MenuItem>
                <MenuItem value="04">April</MenuItem>
                <MenuItem value="05">May</MenuItem>
                <MenuItem value="06">June</MenuItem>
                <MenuItem value="07">July</MenuItem>
                <MenuItem value="08">August</MenuItem>
                <MenuItem value="09">September</MenuItem>
                <MenuItem value="10">October</MenuItem>
                <MenuItem value="11">November</MenuItem>
                <MenuItem value="12">December</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Year"
                value={getSelectedYear()}
                onChange={handleYearChange}
                fullWidth
                size="small"
                helperText="Select specific year"
              >
                <MenuItem value="">All Years</MenuItem>
                {getYearOptions().map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Start Date"
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                helperText="Custom start date"
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
                helperText="Custom end date"
              />
            </Grid>

            {/* Transaction Filters Section */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom sx={{ mt: 3, mb: 2 }}>
                Transaction Filters
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MultiSelectDropdown
                label="Transaction Type"
                options={transactionTypes}
                value={filters.transactionTypeIds || []}
                onChange={(values) => handleFilterChange('transactionTypeIds', values || [])}
                placeholder="Select types..."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MultiSelectDropdown
                label="Accounts"
                options={formatAccountOptions(accounts)}
                value={filters.accountIds}
                onChange={(values) => handleFilterChange('accountIds', values || [])}
                placeholder="Select accounts..."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MultiSelectDropdown
                label="Categories"
                options={formatCategoryOptions(categories)}
                value={filters.categoryIds}
                onChange={(values) => handleFilterChange('categoryIds', values || [])}
                placeholder="Select categories..."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MultiSelectDropdown
                label="Payees"
                options={formatPayeeOptions(payees)}
                value={filters.payeeIds}
                onChange={(values) => handleFilterChange('payeeIds', values || [])}
                placeholder="Select payees..."
              />
            </Grid>

            {/* Actions Section */}
            <Grid item xs={12}>
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  mt: 3, 
                  pt: 3, 
                  borderTop: 1, 
                  borderColor: 'divider',
                  flexWrap: 'wrap',
                  gap: 2
                }}
              >
                <Button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters()}
                  startIcon={<Clear />}
                  size="small"
                  variant="outlined"
                  color="secondary"
                >
                  Clear All Filters
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Enhanced Summary Card */}
      {summary && hasActiveFilters() && (
        <Card 
          sx={{ 
            mb: 4, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 200,
              height: 200,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '50%',
              transform: 'translate(50%, -50%)',
            }}
          />
          <CardContent sx={{ position: 'relative', zIndex: 1 }}>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <TrendingUp sx={{ fontSize: 28 }} />
              <Typography variant="h5" component="h3" fontWeight="bold">
                Analysis Summary
              </Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" p={2}>
                  <Typography variant="h4" fontWeight="bold" sx={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                    {formatCurrency(summary.total_income)}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ opacity: 0.9, fontWeight: 500 }}>
                    Total Income
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" p={2}>
                  <Typography variant="h4" fontWeight="bold" sx={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                    {formatCurrency(summary.total_expense)}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ opacity: 0.9, fontWeight: 500 }}>
                    Total Expense
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" p={2}>
                  <Typography 
                    variant="h4" 
                    fontWeight="bold"
                    sx={{ 
                      textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      color: summary.net_amount >= 0 ? '#4caf50' : '#f44336'
                    }}
                  >
                    {summary.net_amount >= 0 ? '+' : ''}{formatCurrency(summary.net_amount)}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ opacity: 0.9, fontWeight: 500 }}>
                    Net Amount
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" p={2}>
                  <Typography variant="h4" fontWeight="bold" sx={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                    {summary.transaction_count}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ opacity: 0.9, fontWeight: 500 }}>
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
        <>
          {transactionData?.items?.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center', mb: 3 }}>
              <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                <Analytics sx={{ fontSize: 64, color: 'text.disabled' }} />
                <Typography variant="h6" color="textSecondary">
                  No transactions found
                </Typography>
                <Typography variant="body2" color="textSecondary" maxWidth={400}>
                  Try adjusting your filters or expanding the date range to find matching transactions.
                </Typography>
                <Button
                  variant="outlined"
                  onClick={clearFilters}
                  startIcon={<Clear />}
                  sx={{ mt: 2 }}
                >
                  Clear Filters
                </Button>
              </Box>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
              <Table>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Account</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Payee</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactionData?.items?.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{formatDate(transaction.date)}</TableCell>
                  <TableCell 
                    sx={{ 
                      maxWidth: 200,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={transaction.description || '-'}
                  >
                    {transaction.description || '-'}
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
                          : transaction.type === 'expense'
                          ? 'error.main'
                          : 'info.main'
                      }
                      fontWeight={500}
                    >
                      {transaction.type === 'income' && '+'}
                      {transaction.type === 'expense' && '-'}
                      {formatCurrency(transaction.amount)}
                    </Typography>
                  </TableCell>
                </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Enhanced Pagination */}
              {transactionData && transactionData.total > 0 && (
                <Box 
                  display="flex" 
                  justifyContent="space-between" 
                  alignItems="center" 
                  p={2} 
                  borderTop={1}
                  borderColor="divider"
                  flexWrap="wrap" 
                  gap={2}
                  bgcolor="grey.50"
                >
                  <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" sx={{ minWidth: 'fit-content' }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ whiteSpace: 'nowrap' }}>
                      {showAll 
                        ? `Showing all ${transactionData.total} transactions`
                        : `Showing ${((transactionData.page - 1) * transactionData.size) + 1} to ${Math.min(transactionData.page * transactionData.size, transactionData.total)} of ${transactionData.total} transactions`
                      }
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showAll}
                          onChange={(e) => setShowAll(e.target.checked)}
                          size="small"
                        />
                      }
                      label="Show All"
                      sx={{ ml: 1 }}
                    />
                    {!showAll && (
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
                  {!showAll && transactionData.pages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <Pagination
                        count={transactionData.pages}
                        page={transactionData.page}
                        onChange={handlePageChange}
                        color="primary"
                        showFirstButton
                        showLastButton
                        size="medium"
                        siblingCount={1}
                        boundaryCount={1}
                      />
                    </Box>
                  )}
                </Box>
              )}
            </TableContainer>
          )}
        </>
      )}
    </Box>
  );
};

export default FilteredTransactions;
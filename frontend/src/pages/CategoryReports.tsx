import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  IconButton,
  Chip,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Download,
  TrendingUp,
  TrendingDown,
  ShowChart,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi, accountsApi } from '../services/api';
import CategoryPieChart from '../components/CategoryPieChart';
import ReportHeader from '../components/ReportHeader';
import MultiSelectDropdown, { Option } from '../components/MultiSelectDropdown';
import { usePersistentFilters } from '../hooks/usePersistentFilters';
import { formatCurrency } from '../utils/formatters';
import { usePageTitle } from '../hooks/usePageTitle';

interface CategoryReportFilters {
  startDate: string;
  endDate: string;
  accountIds: Option[];
  expandedCategories: string[];
}

// Get current financial year (April 1 to March 31 for India)
const getCurrentFinancialYear = () => {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentYear = now.getFullYear();
  
  let fyStart: Date;
  let fyEnd: Date;
  
  if (currentMonth < 3) { // Jan, Feb, Mar - FY started last year
    fyStart = new Date(currentYear - 1, 3, 1); // April 1 of last year
    fyEnd = new Date(currentYear, 2, 31); // March 31 of this year
  } else { // Apr to Dec - FY started this year
    fyStart = new Date(currentYear, 3, 1); // April 1 of this year
    fyEnd = new Date(currentYear + 1, 2, 31); // March 31 of next year
  }
  
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    start: formatDate(fyStart),
    end: formatDate(fyEnd),
  };
};

const defaultFilters: CategoryReportFilters = {
  startDate: getCurrentFinancialYear().start,
  endDate: getCurrentFinancialYear().end,
  accountIds: [],
  expandedCategories: [],
};

const CategoryReports: React.FC = () => {
  usePageTitle({ title: 'Reports by Category' });
  const [activeTab, setActiveTab] = useState(0);
  const { filters, setFilters } = usePersistentFilters<CategoryReportFilters>(
    'category-reports-filters',
    defaultFilters
  );

  // Fetch accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  // Fetch category data
  const {
    data: categoryData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['category-reports', filters.startDate, filters.endDate, filters.accountIds],
    queryFn: () =>
      transactionsApi.getByCategory({
        start_date: filters.startDate,
        end_date: filters.endDate,
        account_ids: filters.accountIds.map(a => a.value).join(','),
      }),
  });

  const handleFilterChange = (field: keyof CategoryReportFilters, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    setFilters(prev => ({
      ...prev,
      expandedCategories: prev.expandedCategories.includes(categoryId)
        ? prev.expandedCategories.filter(id => id !== categoryId)
        : [...prev.expandedCategories, categoryId],
    }));
  };

  const expandAll = () => {
    const allIds = categoryData?.map((c: any) => c.id) || [];
    setFilters(prev => ({ ...prev, expandedCategories: allIds }));
  };

  const collapseAll = () => {
    setFilters(prev => ({ ...prev, expandedCategories: [] }));
  };

  // Separate income and expense categories
  const { incomeCategories, expenseCategories, totals } = useMemo(() => {
    if (!categoryData) {
      return { incomeCategories: [], expenseCategories: [], totals: { income: 0, expense: 0, net: 0, grand: 0 } };
    }

    const income = categoryData.filter((c: any) => c.income > 0);
    const expense = categoryData.filter((c: any) => c.expense > 0);

    const totalIncome = income.reduce((sum: number, c: any) => sum + c.income, 0);
    const totalExpense = expense.reduce((sum: number, c: any) => sum + Math.abs(c.expense), 0);
    const netAmount = totalIncome - totalExpense;
    const grandTotal = totalIncome + totalExpense;

    // Sort by amount descending (highest percentage first)
    income.sort((a: any, b: any) => b.income - a.income);
    expense.sort((a: any, b: any) => Math.abs(b.expense) - Math.abs(a.expense));

    return {
      incomeCategories: income,
      expenseCategories: expense,
      totals: {
        income: totalIncome,
        expense: totalExpense,
        net: netAmount,
        grand: grandTotal,
      },
    };
  }, [categoryData]);

  const accountOptions = useMemo(
    () =>
      accounts
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(account => ({ value: account.id, label: account.name })),
    [accounts]
  );

  const handleExport = () => {
    // Create CSV content
    const lines: string[] = [];
    
    // Header
    lines.push('Category Breakdown Report');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Period: ${filters.startDate} to ${filters.endDate}`);
    lines.push('');
    
    // Summary
    lines.push('Summary');
    lines.push(`Total Income,${totals.income.toFixed(2)}`);
    lines.push(`Total Expenses,${totals.expense.toFixed(2)}`);
    lines.push(`Net Amount,${totals.net.toFixed(2)}`);
    lines.push('');
    
    // Expenses
    if (expenseCategories.length > 0) {
      lines.push('Expenses');
      lines.push('Category,Amount,Transactions,Average,Percentage');
      expenseCategories.forEach((cat: any) => {
        const amount = Math.abs(cat.expense);
        const percentage = ((amount / totals.grand) * 100).toFixed(2);
        lines.push(
          `${cat.name},${amount.toFixed(2)},${cat.transaction_count},${cat.average_amount.toFixed(2)},${percentage}%`
        );
      });
      lines.push('');
    }
    
    // Income
    if (incomeCategories.length > 0) {
      lines.push('Income');
      lines.push('Category,Amount,Transactions,Average,Percentage');
      incomeCategories.forEach((cat: any) => {
        const amount = cat.income;
        const percentage = ((amount / totals.grand) * 100).toFixed(2);
        lines.push(
          `${cat.name},${amount.toFixed(2)},${cat.transaction_count},${cat.average_amount.toFixed(2)},${percentage}%`
        );
      });
    }
    
    // Download
    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `category-report-${filters.startDate}-to-${filters.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const renderCategoryTable = (categories: any[], type: 'income' | 'expense') => {
    if (categories.length === 0) {
      return (
        <Box textAlign="center" py={3}>
          <Typography color="text.secondary">
            No {type} categories for the selected period
          </Typography>
        </Box>
      );
    }

    return (
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="40px" />
              <TableCell>Category</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">%</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((category: any) => {
              const amount = type === 'income' ? category.income : Math.abs(category.expense);
              const percentage = ((amount / totals.grand) * 100).toFixed(1);
              const isExpanded = filters.expandedCategories.includes(category.id);

              return (
                <React.Fragment key={category.id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => toggleCategoryExpansion(category.id)}
                      >
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            backgroundColor: category.color,
                            borderRadius: 1,
                            border: '1px solid rgba(0,0,0,0.12)',
                          }}
                        />
                        <Typography variant="body2">{category.name}</Typography>
                        <Chip
                          size="small"
                          label={`${category.transaction_count} txns`}
                          variant="outlined"
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">
                        {formatCurrency(amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {percentage}%
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 0, borderBottom: 'none' }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" color="text.secondary">
                                Average Amount
                              </Typography>
                              <Typography variant="body2">
                                {formatCurrency(category.average_amount)}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" color="text.secondary">
                                Transaction Count
                              </Typography>
                              <Typography variant="body2">
                                {category.transaction_count} transactions
                              </Typography>
                            </Grid>
                            {category.monthly_trend && category.monthly_trend.length > 0 && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">
                                  Monthly Trend
                                </Typography>
                                <Box sx={{ mt: 1 }}>
                                  {category.monthly_trend.slice(0, 6).map((month: any) => (
                                    <Box key={month.month} display="flex" justifyContent="space-between" mb={0.5}>
                                      <Typography variant="caption">{month.month_name}</Typography>
                                      <Typography variant="caption">
                                        {formatCurrency(Math.abs(month.amount))} ({month.count} txns)
                                      </Typography>
                                    </Box>
                                  ))}
                                </Box>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Error loading category reports: {(error as Error).message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <ReportHeader
        title="Where the Money Goes and Comes - Category Analysis"
        startDate={filters.startDate}
        endDate={filters.endDate}
        selectedAccounts={filters.accountIds}
      />

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                label="Start Date"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="End Date"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <MultiSelectDropdown
                label="Accounts"
                options={accountOptions}
                value={filters.accountIds}
                onChange={(values) => handleFilterChange('accountIds', values || [])}
                placeholder="All accounts"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={handleExport}
                fullWidth
              >
                Export
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)' }}>
            <CardContent>
              <Typography variant="body2" color="white" gutterBottom>
                Total Income
              </Typography>
              <Typography variant="h5" color="white" fontWeight="bold">
                {formatCurrency(totals.income)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #f44336 0%, #e57373 100%)' }}>
            <CardContent>
              <Typography variant="body2" color="white" gutterBottom>
                Total Expenses
              </Typography>
              <Typography variant="h5" color="white" fontWeight="bold">
                {formatCurrency(totals.expense)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: `linear-gradient(135deg, ${totals.net >= 0 ? '#2196f3' : '#ff9800'} 0%, ${totals.net >= 0 ? '#64b5f6' : '#ffb74d'} 100%)` }}>
            <CardContent>
              <Typography variant="body2" color="white" gutterBottom>
                Net Amount
              </Typography>
              <Typography variant="h5" color="white" fontWeight="bold">
                {formatCurrency(totals.net)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab icon={<TrendingDown />} label="Expenses" iconPosition="start" />
          <Tab icon={<TrendingUp />} label="Income" iconPosition="start" />
          <Tab icon={<ShowChart />} label="Combined" iconPosition="start" />
        </Tabs>
      </Box>

      {/* Expenses Tab */}
      {activeTab === 0 && (
        <Box>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <CategoryPieChart
                data={expenseCategories.map((c: any) => ({
                  ...c,
                  total_amount: c.expense,
                }))}
                title="Expenses by Category"
                transactionType="expense"
                startDate={filters.startDate}
                endDate={filters.endDate}
                accountIds={filters.accountIds}
                grandTotal={totals.grand}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box mb={2} display="flex" gap={1} justifyContent="flex-end">
                <Button size="small" onClick={expandAll}>
                  Expand All
                </Button>
                <Button size="small" onClick={collapseAll}>
                  Collapse All
                </Button>
              </Box>
              {renderCategoryTable(expenseCategories, 'expense')}
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Income Tab */}
      {activeTab === 1 && (
        <Box>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <CategoryPieChart
                data={incomeCategories.map((c: any) => ({
                  ...c,
                  total_amount: c.income,
                }))}
                title="Income by Category"
                transactionType="income"
                startDate={filters.startDate}
                endDate={filters.endDate}
                accountIds={filters.accountIds}
                grandTotal={totals.grand}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box mb={2} display="flex" gap={1} justifyContent="flex-end">
                <Button size="small" onClick={expandAll}>
                  Expand All
                </Button>
                <Button size="small" onClick={collapseAll}>
                  Collapse All
                </Button>
              </Box>
              {renderCategoryTable(incomeCategories, 'income')}
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Combined Tab */}
      {activeTab === 2 && (
        <Box>
          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} md={6}>
              <CategoryPieChart
                data={expenseCategories.map((c: any) => ({
                  ...c,
                  total_amount: c.expense,
                }))}
                title="Expenses by Category"
                transactionType="expense"
                startDate={filters.startDate}
                endDate={filters.endDate}
                accountIds={filters.accountIds}
                grandTotal={totals.grand}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <CategoryPieChart
                data={incomeCategories.map((c: any) => ({
                  ...c,
                  total_amount: c.income,
                }))}
                title="Income by Category"
                transactionType="income"
                startDate={filters.startDate}
                endDate={filters.endDate}
                accountIds={filters.accountIds}
                grandTotal={totals.grand}
              />
            </Grid>
          </Grid>

          <Box mb={2} display="flex" gap={1} justifyContent="flex-end">
            <Button size="small" onClick={expandAll}>
              Expand All
            </Button>
            <Button size="small" onClick={collapseAll}>
              Collapse All
            </Button>
          </Box>

          <Typography variant="h6" gutterBottom>
            Expense Categories
          </Typography>
          {renderCategoryTable(expenseCategories, 'expense')}

          <Box mt={4}>
            <Typography variant="h6" gutterBottom>
              Income Categories
            </Typography>
            {renderCategoryTable(incomeCategories, 'income')}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default CategoryReports;

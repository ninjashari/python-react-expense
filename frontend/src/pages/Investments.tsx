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
  Chip,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  IconButton,
  Collapse,
  TablePagination,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  PieChart as PieChartIcon,
  Receipt,
  Download,
  ExpandMore,
  ExpandLess,
  FilterList,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi, accountsApi, categoriesApi } from '../services/api';
import CategoryPieChart from '../components/CategoryPieChart';
import MultiSelectDropdown, { Option } from '../components/MultiSelectDropdown';
import { usePersistentFilters } from '../hooks/usePersistentFilters';
import { formatCurrency, formatDate, formatAccountType } from '../utils/formatters';
import { usePageTitle } from '../hooks/usePageTitle';
import { Account } from '../types';

interface InvestmentFilters {
  startDate: string;
  endDate: string;
  accountIds: Option[];
  categoryIds: Option[];
  expandedCategories: string[];
  transactionType: string;
}

const getCurrentFinancialYear = () => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  let fyStart: Date;
  let fyEnd: Date;
  if (currentMonth < 3) {
    fyStart = new Date(currentYear - 1, 3, 1);
    fyEnd = new Date(currentYear, 2, 31);
  } else {
    fyStart = new Date(currentYear, 3, 1);
    fyEnd = new Date(currentYear + 1, 2, 31);
  }
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(fyStart), end: fmt(fyEnd) };
};

const defaultFilters: InvestmentFilters = {
  startDate: getCurrentFinancialYear().start,
  endDate: getCurrentFinancialYear().end,
  accountIds: [],
  categoryIds: [],
  expandedCategories: [],
  transactionType: '',
};

const INVESTMENT_RELATED_CATEGORY_KEYWORDS = [
  'interest',
  'demat',
  'recurring deposit',
  'rd ',
  'rd-',
  'ppf',
  'fixed deposit',
  'fd ',
  'fd-',
  'fd return',
  'brokerage',
  'mutual fund',
  'mf ',
  'mf-',
  'mf return',
  'cryptocurrency',
  'national pension',
  'nps',
];

const SummaryCard: React.FC<{
  title: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  subtitle?: string;
}> = ({ title, value, color, icon, subtitle }) => (
  <Card sx={{ background: color, height: '100%' }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" color="white" gutterBottom sx={{ opacity: 0.9 }}>
            {title}
          </Typography>
          <Typography variant="h5" color="white" fontWeight="bold">
            {formatCurrency(value)}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="white" sx={{ opacity: 0.8 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ color: 'white', opacity: 0.8 }}>{icon}</Box>
      </Box>
    </CardContent>
  </Card>
);

const Investments: React.FC = () => {
  usePageTitle({ title: 'Investments' });
  const [activeTab, setActiveTab] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const { filters, setFilters } = usePersistentFilters<InvestmentFilters>(
    'investments-filters',
    defaultFilters
  );

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll(),
  });

  const isInvestmentCategory = (name: string): boolean => {
    const lower = name.toLowerCase();
    return INVESTMENT_RELATED_CATEGORY_KEYWORDS.some(keyword => lower.includes(keyword));
  };

  const investmentCategories = useMemo(
    () => categories.filter(c => isInvestmentCategory(c.name)),
    [categories]
  );

  const effectiveAccountIds = useMemo(() => {
    if (filters.accountIds.length > 0) {
      return filters.accountIds.map(a => a.value as string);
    }
    return allAccounts.map(a => a.id);
  }, [filters.accountIds, allAccounts]);

  const accountIdsParam = effectiveAccountIds.join(',');

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['investments-summary', accountIdsParam, filters.startDate, filters.endDate],
    queryFn: () =>
      transactionsApi.getSummary({
        account_ids: accountIdsParam,
        start_date: filters.startDate,
        end_date: filters.endDate,
        transaction_type: filters.transactionType || undefined,
      }),
    enabled: effectiveAccountIds.length > 0,
  });

  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: ['investments-by-category', accountIdsParam, filters.startDate, filters.endDate],
    queryFn: () =>
      transactionsApi.getByCategory({
        account_ids: accountIdsParam,
        start_date: filters.startDate,
        end_date: filters.endDate,
      }),
    enabled: effectiveAccountIds.length > 0,
  });

  const { data: transactionsData, isLoading: txLoading } = useQuery({
    queryKey: [
      'investments-transactions',
      accountIdsParam,
      filters.startDate,
      filters.endDate,
      filters.categoryIds,
      filters.transactionType,
      page,
      rowsPerPage,
    ],
    queryFn: () =>
      transactionsApi.getAll({
        account_ids: accountIdsParam,
        category_ids: filters.categoryIds.map(c => c.value).join(',') || undefined,
        transaction_type: filters.transactionType || undefined,
        start_date: filters.startDate,
        end_date: filters.endDate,
        page: page + 1,
        size: rowsPerPage,
        sort_by: 'date',
        sort_order: 'desc',
      }),
    enabled: effectiveAccountIds.length > 0,
  });

  const accountOptions = useMemo(
    () =>
      allAccounts
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(a => ({ value: a.id, label: `${a.name} (${formatAccountType(a.type)})` })),
    [allAccounts]
  );

  const categoryOptions = useMemo(
    () =>
      investmentCategories
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(c => ({ value: c.id, label: c.name })),
    [investmentCategories]
  );

  const accountMap = useMemo(
    () => new Map(allAccounts.map(a => [a.id, a])),
    [allAccounts]
  );

  const { incomeCategories, expenseCategories, categoryGrandTotal } = useMemo(() => {
    if (!categoryData) return { incomeCategories: [], expenseCategories: [], categoryGrandTotal: 0 };
    const income = categoryData.filter((c: any) => c.income > 0).sort((a: any, b: any) => b.income - a.income);
    const expense = categoryData.filter((c: any) => c.expense > 0).sort((a: any, b: any) => Math.abs(b.expense) - Math.abs(a.expense));
    const grand =
      income.reduce((s: number, c: any) => s + c.income, 0) +
      expense.reduce((s: number, c: any) => s + Math.abs(c.expense), 0);
    return { incomeCategories: income, expenseCategories: expense, categoryGrandTotal: grand };
  }, [categoryData]);

  const portfolioValue = useMemo(
    () => effectiveAccountIds.reduce((sum, id) => {
      const acc = accountMap.get(id);
      return sum + (acc ? Number(acc.balance) : 0);
    }, 0),
    [effectiveAccountIds, accountMap]
  );

  const handleFilterChange = (field: keyof InvestmentFilters, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    if (field !== 'expandedCategories') setPage(0);
  };

  const toggleCategory = (id: string) => {
    setFilters(prev => ({
      ...prev,
      expandedCategories: prev.expandedCategories.includes(id)
        ? prev.expandedCategories.filter(i => i !== id)
        : [...prev.expandedCategories, id],
    }));
  };

  const handleExportCSV = () => {
    const lines: string[] = [];
    lines.push('Investment Analysis Report');
    lines.push(`Period: ${filters.startDate} to ${filters.endDate}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('Account Summary');
    lines.push('Account,Type,Balance,Interest Rate');
    effectiveAccountIds.forEach(id => {
      const acc = accountMap.get(id);
      if (acc) {
        lines.push(`${acc.name},${formatAccountType(acc.type)},${Number(acc.balance).toFixed(2)},${acc.interest_rate ?? '-'}`);
      }
    });
    lines.push('');
    lines.push('Period Summary');
    lines.push(`Total Invested (Income),${(summary?.total_income ?? 0).toFixed(2)}`);
    lines.push(`Total Withdrawn (Expense),${(summary?.total_expense ?? 0).toFixed(2)}`);
    lines.push(`Net,${(summary?.net_amount ?? 0).toFixed(2)}`);
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investments-${filters.startDate}-to-${filters.endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const renderCategoryTable = (cats: any[], type: 'income' | 'expense') => {
    if (cats.length === 0) {
      return (
        <Box textAlign="center" py={3}>
          <Typography color="text.secondary">No {type} categories for the selected period</Typography>
        </Box>
      );
    }
    return (
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={40} />
              <TableCell>Category</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Transactions</TableCell>
              <TableCell align="right">Avg</TableCell>
              <TableCell align="right">%</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cats.map((cat: any) => {
              const amount = type === 'income' ? cat.income : Math.abs(cat.expense);
              const pct = categoryGrandTotal > 0 ? ((amount / categoryGrandTotal) * 100).toFixed(1) : '0.0';
              const isExpanded = filters.expandedCategories.includes(cat.id);
              return (
                <React.Fragment key={cat.id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton size="small" onClick={() => toggleCategory(cat.id)}>
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box sx={{ width: 14, height: 14, backgroundColor: cat.color, borderRadius: 0.5, border: '1px solid rgba(0,0,0,0.12)', flexShrink: 0 }} />
                        <Typography variant="body2">{cat.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium" color={type === 'income' ? 'success.main' : 'error.main'}>
                        {formatCurrency(amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={cat.transaction_count} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">
                        {formatCurrency(cat.average_amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">{pct}%</Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 0, borderBottom: 'none' }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                          {cat.monthly_trend && cat.monthly_trend.length > 0 && (
                            <>
                              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                                Monthly Trend
                              </Typography>
                              {cat.monthly_trend.slice(0, 6).map((m: any) => (
                                <Box key={m.month} display="flex" justifyContent="space-between" mb={0.25}>
                                  <Typography variant="caption">{m.month_name}</Typography>
                                  <Typography variant="caption">{formatCurrency(Math.abs(m.amount))} ({m.count} txns)</Typography>
                                </Box>
                              ))}
                            </>
                          )}
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

  if (allAccounts.length === 0) {
    return (
      <Box p={3}>
        <Typography variant="h4" gutterBottom fontWeight="bold">Investments</Typography>
        <Alert severity="info">
          No accounts found. Create an account to see investment data here.
        </Alert>
      </Box>
    );
  }

  if (investmentCategories.length === 0) {
    return (
      <Box p={3}>
        <Typography variant="h4" gutterBottom fontWeight="bold">Investments</Typography>
        <Alert severity="info">
          No investment-related categories found. Create transactions with investment categories (e.g., Mutual Fund, Fixed Deposit, PPF, etc.) to see data here.
        </Alert>
      </Box>
    );
  }

  const isLoading = summaryLoading || categoryLoading || txLoading;
  const transactions = transactionsData?.items ?? [];
  const totalTransactions = transactionsData?.total ?? 0;

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold">Investments</Typography>
          <Typography variant="body2" color="text.secondary">
            {allAccounts.length} account{allAccounts.length !== 1 ? 's' : ''} • {investmentCategories.length} investment categor{investmentCategories.length !== 1 ? 'ies' : 'y'}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Download />} onClick={handleExportCSV}>
          Export CSV
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <FilterList fontSize="small" color="action" />
            <Typography variant="subtitle2" color="text.secondary">Filters</Typography>
          </Box>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Start Date"
                type="date"
                value={filters.startDate}
                onChange={e => handleFilterChange('startDate', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="End Date"
                type="date"
                value={filters.endDate}
                onChange={e => handleFilterChange('endDate', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MultiSelectDropdown
                label="Accounts"
                options={accountOptions}
                value={filters.accountIds}
                onChange={vals => handleFilterChange('accountIds', vals ?? [])}
                placeholder="All accounts"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MultiSelectDropdown
                label="Investment Categories"
                options={categoryOptions}
                value={filters.categoryIds}
                onChange={vals => handleFilterChange('categoryIds', vals ?? [])}
                placeholder="All investment categories"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Transaction Type"
                select
                value={filters.transactionType}
                onChange={e => handleFilterChange('transactionType', e.target.value)}
                fullWidth
                size="small"
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
              >
                <option value="">All types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Portfolio Value"
            value={portfolioValue}
            color="linear-gradient(135deg, #1565c0 0%, #42a5f5 100%)"
            icon={<AccountBalance />}
            subtitle="Current balance across selected accounts"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Total Invested"
            value={summary?.total_income ?? 0}
            color="linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%)"
            icon={<TrendingUp />}
            subtitle={`${filters.startDate} – ${filters.endDate}`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Total Withdrawn"
            value={summary?.total_expense ?? 0}
            color="linear-gradient(135deg, #c62828 0%, #ef5350 100%)"
            icon={<TrendingDown />}
            subtitle={`${summary?.transaction_count ?? 0} transactions`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard
            title="Net for Period"
            value={summary?.net_amount ?? 0}
            color={
              (summary?.net_amount ?? 0) >= 0
                ? 'linear-gradient(135deg, #6a1b9a 0%, #ba68c8 100%)'
                : 'linear-gradient(135deg, #e65100 0%, #ffa726 100%)'
            }
            icon={<Receipt />}
            subtitle="Invested minus withdrawn"
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab icon={<AccountBalance />} label="Account Summary" iconPosition="start" />
          <Tab icon={<PieChartIcon />} label="By Category" iconPosition="start" />
          <Tab icon={<Receipt />} label="Transactions" iconPosition="start" />
        </Tabs>
      </Box>

      {isLoading && activeTab !== 0 && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Tab 0: Account Summary */}
      {activeTab === 0 && (
        <Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><Typography fontWeight="bold">Account</Typography></TableCell>
                  <TableCell><Typography fontWeight="bold">Type</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Current Balance</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Interest Rate</Typography></TableCell>
                  <TableCell><Typography fontWeight="bold">Status</Typography></TableCell>
                  <TableCell><Typography fontWeight="bold">Opened</Typography></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {effectiveAccountIds.map(id => {
                  const acc = accountMap.get(id);
                  if (!acc) return null;
                  return (
                    <TableRow key={acc.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">{acc.name}</Typography>
                        {acc.account_number && (
                          <Typography variant="caption" color="text.secondary">
                            {acc.account_number}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={formatAccountType(acc.type)}
                          color={acc.type === 'ppf' ? 'secondary' : 'primary'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          color={Number(acc.balance) >= 0 ? 'success.main' : 'error.main'}
                        >
                          {formatCurrency(Number(acc.balance))}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {acc.interest_rate != null ? (
                          <Chip size="small" label={`${acc.interest_rate}% p.a.`} color="success" variant="outlined" />
                        ) : (
                          <Typography variant="caption" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={acc.status}
                          color={acc.status === 'active' ? 'success' : acc.status === 'closed' ? 'error' : 'default'}
                          variant="filled"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {acc.opening_date ? formatDate(acc.opening_date) : '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Portfolio total row */}
          <Box mt={2} display="flex" justifyContent="flex-end">
            <Card sx={{ minWidth: 260 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Total Portfolio Value</Typography>
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    {formatCurrency(portfolioValue)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* Tab 1: By Category */}
      {activeTab === 1 && !isLoading && (
        <Box>
          {incomeCategories.length === 0 && expenseCategories.length === 0 ? (
            <Alert severity="info">No category data for the selected period and accounts.</Alert>
          ) : (
            <>
              <Grid container spacing={3} mb={3}>
                {incomeCategories.length > 0 && (
                  <Grid item xs={12} md={expenseCategories.length > 0 ? 6 : 12}>
                    <CategoryPieChart
                      data={incomeCategories.map((c: any) => ({ ...c, total_amount: c.income }))}
                      title="Income by Category"
                      transactionType="income"
                      startDate={filters.startDate}
                      endDate={filters.endDate}
                      accountIds={filters.accountIds}
                      grandTotal={categoryGrandTotal}
                    />
                  </Grid>
                )}
                {expenseCategories.length > 0 && (
                  <Grid item xs={12} md={incomeCategories.length > 0 ? 6 : 12}>
                    <CategoryPieChart
                      data={expenseCategories.map((c: any) => ({ ...c, total_amount: c.expense }))}
                      title="Expense by Category"
                      transactionType="expense"
                      startDate={filters.startDate}
                      endDate={filters.endDate}
                      accountIds={filters.accountIds}
                      grandTotal={categoryGrandTotal}
                    />
                  </Grid>
                )}
              </Grid>

              {incomeCategories.length > 0 && (
                <Box mb={3}>
                  <Typography variant="h6" gutterBottom>Income Categories</Typography>
                  {renderCategoryTable(incomeCategories, 'income')}
                </Box>
              )}
              {expenseCategories.length > 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Expense Categories</Typography>
                  {renderCategoryTable(expenseCategories, 'expense')}
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      {/* Tab 2: Transactions */}
      {activeTab === 2 && !isLoading && (
        <Box>
          {transactions.length === 0 ? (
            <Alert severity="info">No transactions found for the selected filters.</Alert>
          ) : (
            <>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell><Typography fontWeight="bold">Date</Typography></TableCell>
                      <TableCell><Typography fontWeight="bold">Account</Typography></TableCell>
                      <TableCell><Typography fontWeight="bold">Category</Typography></TableCell>
                      <TableCell><Typography fontWeight="bold">Payee</Typography></TableCell>
                      <TableCell><Typography fontWeight="bold">Description</Typography></TableCell>
                      <TableCell><Typography fontWeight="bold">Type</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight="bold">Amount</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight="bold">Balance After</Typography></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.map((tx: any) => (
                      <TableRow key={tx.id} hover>
                        <TableCell>
                          <Typography variant="body2" noWrap>{formatDate(tx.date)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {tx.account?.name ?? accountMap.get(tx.account_id)?.name ?? '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {tx.category ? (
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, backgroundColor: tx.category.color, flexShrink: 0 }} />
                              <Typography variant="body2" noWrap>{tx.category.name}</Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>{tx.payee?.name ?? '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Tooltip title={tx.description ?? ''} placement="top">
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {tx.description ?? '—'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={tx.type}
                            color={tx.type === 'income' ? 'success' : tx.type === 'expense' ? 'error' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            color={tx.type === 'income' ? 'success.main' : tx.type === 'expense' ? 'error.main' : 'text.primary'}
                          >
                            {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                            {formatCurrency(Number(tx.amount))}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary">
                            {tx.balance_after_transaction != null
                              ? formatCurrency(Number(tx.balance_after_transaction))
                              : '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={totalTransactions}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[10, 20, 50, 100]}
              />
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

export default Investments;

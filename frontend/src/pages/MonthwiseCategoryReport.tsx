import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Download,
  ShowChart,
  TrendingUp,
  TrendingDown,
  AccountBalanceWallet,
  CalendarMonth,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi, accountsApi } from '../services/api';
import MultiSelectDropdown, { Option } from '../components/MultiSelectDropdown';
import { usePersistentFilters } from '../hooks/usePersistentFilters';
import { formatCurrency } from '../utils/formatters';
import { usePageTitle } from '../hooks/usePageTitle';

interface MonthwiseReportFilters {
  year: string;
  month: string; // '' = all months of the selected year
  accountIds: Option[];
}

const MONTH_OPTIONS = [
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

// Build a list of selectable years (current year back through 10 years)
const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 11 }, (_, i) => String(currentYear - i));
};

// Derive a start/end date range from a year and optional month
const getDateRange = (year: string, month: string) => {
  if (month) {
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    return {
      start: `${year}-${month}-01`,
      end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
};

const defaultFilters: MonthwiseReportFilters = {
  year: String(new Date().getFullYear()),
  month: '',
  accountIds: [],
};

const MonthwiseCategoryReport: React.FC = () => {
  usePageTitle({ title: 'Month-wise Category Report' });
  const navigate = useNavigate();
  const theme = useTheme();
  const { filters, setFilters } = usePersistentFilters<MonthwiseReportFilters>(
    'monthwise-category-filters-v2',
    defaultFilters
  );

  const { start: startDate, end: endDate } = useMemo(
    () => getDateRange(filters.year, filters.month),
    [filters.year, filters.month]
  );

  const yearOptions = useMemo(() => getYearOptions(), []);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const {
    data: categoryData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['monthwise-category-reports', startDate, endDate, filters.accountIds],
    queryFn: () =>
      transactionsApi.getByCategory({
        start_date: startDate,
        end_date: endDate,
        account_ids: filters.accountIds.map(a => a.value).join(','),
      }),
  });

  const handleFilterChange = (field: keyof MonthwiseReportFilters, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const accountOptions = useMemo(
    () =>
      accounts
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(account => ({ value: account.id, label: account.name })),
    [accounts]
  );

  // Process data for month-wise view
  const { monthColumns, categoryRows, totals } = useMemo(() => {
    if (!categoryData) {
      return { monthColumns: [], categoryRows: [], totals: { byMonth: {}, grandTotal: { income: 0, expense: 0, total: 0 } } };
    }

    const monthSet = new Set<string>();
    const categories: any[] = [];

    categoryData.forEach((cat: any) => {
      if (cat.monthly_trend) {
        cat.monthly_trend.forEach((m: any) => {
          monthSet.add(m.month);
        });
      }

      const hasIncome = cat.income && cat.income > 0;
      const hasExpense = cat.expense && cat.expense > 0;
      // Exclude transfers (where both income and expense are 0, or when they equal each other and represent transfers)
      const isTransfer = cat.income === 0 && cat.expense === 0;

      if ((hasIncome || hasExpense) && !isTransfer) {
        categories.push(cat);
      }
    });

    const months = Array.from(monthSet).sort();

    const monthCols = months.map(month => {
      const [year, monthNum] = month.split('-');
      const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      return {
        key: month,
        label: monthName,
        year: year,
      };
    });

    const rows = categories.map(cat => {
      const isExpenseCategory = (cat.expense || 0) > (cat.income || 0);
      // Net amount in the category's dominant direction (matches the Reports page,
      // where a category with both income and expense nets them out).
      const netTotal = isExpenseCategory
        ? (cat.expense || 0) - (cat.income || 0)
        : (cat.income || 0) - (cat.expense || 0);
      const row: any = {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        income: cat.income || 0,
        expense: cat.expense || 0,
        total: netTotal,
        isExpenseCategory,
        byMonth: {},
      };

      months.forEach(month => {
        row.byMonth[month] = 0;
      });

      if (cat.monthly_trend) {
        cat.monthly_trend.forEach((m: any) => {
          // Net per month in the category's dominant direction
          row.byMonth[m.month] = isExpenseCategory
            ? (m.expense || 0) - (m.income || 0)
            : (m.income || 0) - (m.expense || 0);
        });
      }

      return row;
    });

    const totalsByMonth: any = {};
    months.forEach(month => {
      totalsByMonth[month] = {
        income: 0,
        expense: 0,
        total: 0,
      };
    });

    // Accumulate gross income/expense per month from the raw category trends
    categories.forEach((cat: any) => {
      if (!cat.monthly_trend) return;
      cat.monthly_trend.forEach((m: any) => {
        if (!totalsByMonth[m.month]) return;
        totalsByMonth[m.month].income += m.income || 0;
        totalsByMonth[m.month].expense += m.expense || 0;
      });
    });
    months.forEach(month => {
      totalsByMonth[month].total = totalsByMonth[month].income - totalsByMonth[month].expense;
    });

    const grandTotal = {
      income: rows.reduce((sum, r) => sum + (r.income > 0 ? r.income : 0), 0),
      expense: rows.reduce((sum, r) => sum + (r.expense > 0 ? r.expense : 0), 0),
      total: 0,
    };
    grandTotal.total = grandTotal.income - grandTotal.expense;

    return {
      monthColumns: monthCols,
      categoryRows: rows,
      totals: { byMonth: totalsByMonth, grandTotal },
    };
  }, [categoryData]);

  const filteredRows = useMemo(() => {
    // Show all categories sorted by total amount
    return categoryRows.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [categoryRows]);

  const handleCategoryClick = (categoryId: string, categoryName: string, monthKey?: string) => {
    let clickStartDate = startDate;
    let clickEndDate = endDate;

    if (monthKey) {
      // monthKey format: "2025-04"
      const [year, month] = monthKey.split('-');
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      // First day of the month
      clickStartDate = `${year}-${month}-01`;

      // Last day of the month
      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      clickEndDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    }

    const reportFilters = {
      startDate: clickStartDate,
      endDate: clickEndDate,
      accountIds: filters.accountIds,
      categoryIds: [{ value: categoryId, label: categoryName }],
      payeeIds: [],
      search: '',
      page: 1,
      size: 50,
    };
    localStorage.setItem('filtered-transactions-filters', JSON.stringify(reportFilters));
    navigate('/reports');
  };

  const handleExport = () => {
    const lines: string[] = [];
    
    lines.push('Month-wise Category Report');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Period: ${startDate} to ${endDate}`);
    lines.push('');
    
    const headerRow = ['Category', ...monthColumns.map(m => `${m.label} ${m.year}`), 'Overall'];
    lines.push(headerRow.join(','));
    
    filteredRows.forEach(row => {
      const rowData = [
        row.name,
        ...monthColumns.map(m => row.byMonth[m.key].toFixed(2)),
        row.total.toFixed(2),
      ];
      lines.push(rowData.join(','));
    });
    
    lines.push('');
    const totalsRow = [
      'Total',
      ...monthColumns.map(m => totals.byMonth[m.key]?.total.toFixed(2) || '0.00'),
      totals.grandTotal.total.toFixed(2),
    ];
    lines.push(totalsRow.join(','));
    
    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monthwise-category-report-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
          Error loading report: {(error as Error).message}
        </Alert>
      </Box>
    );
  }

  const periodLabel = filters.month
    ? `${MONTH_OPTIONS.find((m) => m.value === filters.month)?.label ?? ''} ${filters.year}`
    : `Year ${filters.year}`;
  const accountsLabel =
    filters.accountIds.length === 0
      ? 'All accounts'
      : filters.accountIds.map((a) => a.label).join(', ');

  // Theme-aware income/expense colors
  const incomeColor = theme.palette.success.main;
  const expenseColor = theme.palette.error.main;
  const paperBg = theme.palette.background.paper;

  // Sticky-cell background that blends with the row beneath it
  const stickyBg = (base?: string) => base ?? paperBg;

  const summaryCards = [
    {
      label: 'Total Income',
      value: totals.grandTotal.income,
      icon: <TrendingUp />,
      color: incomeColor,
    },
    {
      label: 'Total Expenses',
      value: totals.grandTotal.expense,
      icon: <TrendingDown />,
      color: expenseColor,
    },
    {
      label: 'Net',
      value: totals.grandTotal.total,
      icon: <AccountBalanceWallet />,
      color: totals.grandTotal.total >= 0 ? incomeColor : expenseColor,
    },
  ];

  return (
    <Box p={3}>
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        flexWrap="wrap"
        gap={2}
        mb={3}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Month-wise Analysis
          </Typography>
          <Box display="flex" alignItems="center" gap={0.75} mt={0.5} color="text.secondary">
            <CalendarMonth sx={{ fontSize: '1rem' }} />
            <Typography variant="body2">
              {periodLabel} · {accountsLabel}
            </Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Download />} onClick={handleExport}>
          Export CSV
        </Button>
      </Box>

      {/* Summary KPI cards */}
      <Grid container spacing={3} mb={1}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={4} key={card.label}>
            <Card
              sx={{
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow:
                    theme.palette.mode === 'light'
                      ? '0 12px 24px -8px rgba(0,0,0,0.12)'
                      : '0 12px 24px -8px rgba(0,0,0,0.5)',
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 4,
                  height: '100%',
                  bgcolor: card.color,
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>
                      {card.label}
                    </Typography>
                    <Typography variant="h5" fontWeight={700} color={card.color}>
                      {formatCurrency(card.value)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2.5,
                      background: `linear-gradient(135deg, ${alpha(card.color, 0.18)}, ${alpha(card.color, 0.08)})`,
                      color: card.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Year"
                value={filters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                fullWidth
                size="small"
              >
                {yearOptions.map((year) => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Month"
                value={filters.month}
                onChange={(e) => handleFilterChange('month', e.target.value)}
                fullWidth
                size="small"
                disabled={!filters.year}
                helperText={!filters.year ? 'Select a year first' : undefined}
              >
                <MenuItem value="">All months</MenuItem>
                {MONTH_OPTIONS.map((m) => (
                  <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <MultiSelectDropdown
                label="Accounts"
                options={accountOptions}
                value={filters.accountIds}
                onChange={(values) => handleFilterChange('accountIds', values || [])}
                placeholder="All accounts"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Table section header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ShowChart sx={{ color: 'primary.main' }} />
        <Typography variant="h6" fontWeight={700}>
          Category Breakdown
        </Typography>
      </Box>

      {filteredRows.length === 0 ? (
        <Alert severity="info">No category activity found for {periodLabel}.</Alert>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            maxHeight: '70vh',
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: 'none',
          }}
        >
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    position: 'sticky',
                    left: 0,
                    backgroundColor: paperBg,
                    zIndex: 3,
                    minWidth: 200,
                  }}
                >
                  Category
                </TableCell>
                {monthColumns.map((month) => (
                  <TableCell key={month.key} align="right" sx={{ fontWeight: 700, minWidth: 100 }}>
                    <Typography variant="caption" fontWeight={700} display="block">
                      {month.label}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {month.year}
                    </Typography>
                  </TableCell>
                ))}
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 700,
                    position: 'sticky',
                    right: 0,
                    backgroundColor: paperBg,
                    zIndex: 3,
                    minWidth: 120,
                  }}
                >
                  Overall
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  sx={{ '&:hover .sticky-cell': { backgroundColor: alpha(theme.palette.primary.main, 0.04) } }}
                >
                  <TableCell
                    className="sticky-cell"
                    sx={{
                      position: 'sticky',
                      left: 0,
                      backgroundColor: paperBg,
                      zIndex: 1,
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          backgroundColor: row.color,
                          borderRadius: '50%',
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" fontWeight={500}>{row.name}</Typography>
                    </Box>
                  </TableCell>
                  {monthColumns.map((month) => {
                    const amount: number = row.byMonth[month.key];
                    const color = amount === 0 ? 'text.disabled' : (row.isExpenseCategory ? expenseColor : incomeColor);
                    return (
                      <TableCell key={month.key} align="right">
                        {amount !== 0 ? (
                          <Typography
                            variant="body2"
                            sx={{
                              color,
                              cursor: 'pointer',
                              borderRadius: 1,
                              transition: 'background-color 0.15s ease',
                              '&:hover': { backgroundColor: alpha(color as string, 0.12) },
                            }}
                            onClick={() => handleCategoryClick(row.id, row.name, month.key)}
                          >
                            {formatCurrency(amount)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell
                    className="sticky-cell"
                    align="right"
                    sx={{
                      position: 'sticky',
                      right: 0,
                      backgroundColor: paperBg,
                      zIndex: 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color: row.isExpenseCategory ? expenseColor : incomeColor,
                        fontWeight: 700,
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                      onClick={() => handleCategoryClick(row.id, row.name)}
                    >
                      {formatCurrency(row.total)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}

              {/* Expenses summary row */}
              <TableRow sx={{ backgroundColor: alpha(expenseColor, 0.06) }}>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    position: 'sticky',
                    left: 0,
                    backgroundColor: stickyBg(theme.palette.mode === 'light' ? '#fdeded' : '#3a1f1f'),
                    zIndex: 1,
                  }}
                >
                  Expenses
                </TableCell>
                {monthColumns.map((month) => (
                  <TableCell key={month.key} align="right">
                    <Typography variant="body2" fontWeight={700} color={expenseColor}>
                      {formatCurrency(totals.byMonth[month.key]?.expense || 0)}
                    </Typography>
                  </TableCell>
                ))}
                <TableCell
                  align="right"
                  sx={{
                    position: 'sticky',
                    right: 0,
                    backgroundColor: stickyBg(theme.palette.mode === 'light' ? '#fdeded' : '#3a1f1f'),
                    zIndex: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight={700} color={expenseColor}>
                    {formatCurrency(totals.grandTotal.expense)}
                  </Typography>
                </TableCell>
              </TableRow>

              {/* Income summary row */}
              <TableRow sx={{ backgroundColor: alpha(incomeColor, 0.06) }}>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    position: 'sticky',
                    left: 0,
                    backgroundColor: stickyBg(theme.palette.mode === 'light' ? '#edf7ed' : '#1f3a26'),
                    zIndex: 1,
                  }}
                >
                  Income
                </TableCell>
                {monthColumns.map((month) => (
                  <TableCell key={month.key} align="right">
                    <Typography variant="body2" fontWeight={700} color={incomeColor}>
                      {formatCurrency(totals.byMonth[month.key]?.income || 0)}
                    </Typography>
                  </TableCell>
                ))}
                <TableCell
                  align="right"
                  sx={{
                    position: 'sticky',
                    right: 0,
                    backgroundColor: stickyBg(theme.palette.mode === 'light' ? '#edf7ed' : '#1f3a26'),
                    zIndex: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight={700} color={incomeColor}>
                    {formatCurrency(totals.grandTotal.income)}
                  </Typography>
                </TableCell>
              </TableRow>

              {/* Net total row */}
              <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    position: 'sticky',
                    left: 0,
                    backgroundColor: theme.palette.mode === 'light'
                      ? alpha(theme.palette.primary.main, 0.12)
                      : alpha(theme.palette.primary.main, 0.25),
                    zIndex: 1,
                  }}
                >
                  Net Total
                </TableCell>
                {monthColumns.map((month) => {
                  const displayAmount = totals.byMonth[month.key]?.total || 0;
                  return (
                    <TableCell key={month.key} align="right">
                      <Typography variant="body2" fontWeight={700}>
                        {formatCurrency(displayAmount)}
                      </Typography>
                    </TableCell>
                  );
                })}
                <TableCell
                  align="right"
                  sx={{
                    position: 'sticky',
                    right: 0,
                    backgroundColor: theme.palette.mode === 'light'
                      ? alpha(theme.palette.primary.main, 0.12)
                      : alpha(theme.palette.primary.main, 0.25),
                    zIndex: 1,
                  }}
                >
                  <Typography variant="body2" fontWeight={700} color="primary.main">
                    {formatCurrency(totals.grandTotal.total)}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default MonthwiseCategoryReport;

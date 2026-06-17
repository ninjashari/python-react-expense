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
import {
  Download,
  ShowChart,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi, accountsApi } from '../services/api';
import ReportHeader from '../components/ReportHeader';
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
      const row: any = {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        income: cat.income || 0,
        expense: cat.expense || 0,
        total: cat.total_amount || 0,
        isExpenseCategory,
        byMonth: {},
      };

      months.forEach(month => {
        row.byMonth[month] = 0;
      });

      if (cat.monthly_trend) {
        cat.monthly_trend.forEach((m: any) => {
          row.byMonth[m.month] = m.amount || 0;
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

    rows.forEach(row => {
      months.forEach(month => {
        const amount = row.byMonth[month];
        totalsByMonth[month].total += amount;
        if (row.isExpenseCategory) {
          totalsByMonth[month].expense += amount;
        } else {
          totalsByMonth[month].income += amount;
        }
      });
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

  return (
    <Box p={3}>
      <ReportHeader
        title="Month-wise Category Analysis"
        startDate={startDate}
        endDate={endDate}
        selectedAccounts={filters.accountIds}
      />

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

      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <ShowChart sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Combined View
        </Typography>
      </Box>

      <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 'bold',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#fff',
                  zIndex: 3,
                  minWidth: 180,
                }}
              >
                Category
              </TableCell>
              {monthColumns.map((month) => (
                <TableCell
                  key={month.key}
                  align="right"
                  sx={{ fontWeight: 'bold', minWidth: 100 }}
                >
                  <Box>
                    <Typography variant="caption" display="block">
                      {month.label}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {month.year}
                    </Typography>
                  </Box>
                </TableCell>
              ))}
              <TableCell
                align="right"
                sx={{
                  fontWeight: 'bold',
                  position: 'sticky',
                  right: 0,
                  backgroundColor: '#fff',
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
              <TableRow key={row.id} hover>
                <TableCell
                  sx={{
                    position: 'sticky',
                    left: 0,
                    backgroundColor: '#fff',
                    zIndex: 1,
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        backgroundColor: row.color,
                        borderRadius: '2px',
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="body2">{row.name}</Typography>
                  </Box>
                </TableCell>
                {monthColumns.map((month) => {
                  const amount: number = row.byMonth[month.key];
                  const color = amount === 0 ? 'text.primary' : (row.isExpenseCategory ? '#d32f2f' : '#2e7d32');
                  
                  return (
                    <TableCell key={month.key} align="right">
                      {amount !== 0 && (
                        <Typography
                          variant="body2"
                          sx={{ 
                            color,
                            cursor: 'pointer',
                            '&:hover': {
                              textDecoration: 'underline',
                            },
                          }}
                          onClick={() => handleCategoryClick(row.id, row.name, month.key)}
                        >
                          {formatCurrency(amount)}
                        </Typography>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell
                  align="right"
                  sx={{
                    position: 'sticky',
                    right: 0,
                    backgroundColor: '#fff',
                    zIndex: 1,
                    fontWeight: 'medium',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: row.isExpenseCategory ? '#d32f2f' : '#2e7d32',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                    onClick={() => handleCategoryClick(row.id, row.name)}
                  >
                    {formatCurrency(row.total)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
            
            <>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell
                    sx={{
                      fontWeight: 'bold',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#f5f5f5',
                      zIndex: 1,
                    }}
                  >
                    Expenses
                  </TableCell>
                  {monthColumns.map((month) => (
                    <TableCell key={month.key} align="right">
                      <Typography variant="body2" fontWeight="bold" color="#d32f2f">
                        {formatCurrency(totals.byMonth[month.key]?.expense || 0)}
                      </Typography>
                    </TableCell>
                  ))}
                  <TableCell
                    align="right"
                    sx={{
                      position: 'sticky',
                      right: 0,
                      backgroundColor: '#f5f5f5',
                      zIndex: 1,
                    }}
                  >
                    <Typography variant="body2" fontWeight="bold" color="#d32f2f">
                      {formatCurrency(totals.grandTotal.expense)}
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell
                    sx={{
                      fontWeight: 'bold',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#f5f5f5',
                      zIndex: 1,
                    }}
                  >
                    Income
                  </TableCell>
                  {monthColumns.map((month) => (
                    <TableCell key={month.key} align="right">
                      <Typography variant="body2" fontWeight="bold" color="#2e7d32">
                        {formatCurrency(totals.byMonth[month.key]?.income || 0)}
                      </Typography>
                    </TableCell>
                  ))}
                  <TableCell
                    align="right"
                    sx={{
                      position: 'sticky',
                      right: 0,
                      backgroundColor: '#f5f5f5',
                      zIndex: 1,
                    }}
                  >
                    <Typography variant="body2" fontWeight="bold" color="#2e7d32">
                      {formatCurrency(totals.grandTotal.income)}
                    </Typography>
                  </TableCell>
                </TableRow>
              </>
            <TableRow sx={{ backgroundColor: '#e0e0e0' }}>
              <TableCell
                sx={{
                  fontWeight: 'bold',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#e0e0e0',
                  zIndex: 1,
                }}
              >
                Total
              </TableCell>
              {monthColumns.map((month) => {
                const displayAmount = totals.byMonth[month.key]?.total || 0;
                return (
                  <TableCell key={month.key} align="right">
                    <Typography variant="body2" fontWeight="bold">
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
                  backgroundColor: '#e0e0e0',
                  zIndex: 1,
                }}
              >
                <Typography variant="body2" fontWeight="bold">
                  {formatCurrency(totals.grandTotal.total)}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default MonthwiseCategoryReport;

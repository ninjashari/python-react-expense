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
  CircularProgress,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Download,
  TrendingDown,
  TrendingUp,
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
  startDate: string;
  endDate: string;
  accountIds: Option[];
}

// Get current financial year (April 1 to March 31 for India)
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

const defaultFilters: MonthwiseReportFilters = {
  startDate: getCurrentFinancialYear().start,
  endDate: getCurrentFinancialYear().end,
  accountIds: [],
};

const MonthwiseCategoryReport: React.FC = () => {
  usePageTitle({ title: 'Month-wise Category Report' });
  const [activeTab, setActiveTab] = useState(0);
  const { filters, setFilters } = usePersistentFilters<MonthwiseReportFilters>(
    'monthwise-category-filters',
    defaultFilters
  );

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const {
    data: categoryData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['monthwise-category-reports', filters.startDate, filters.endDate, filters.accountIds],
    queryFn: () =>
      transactionsApi.getByCategory({
        start_date: filters.startDate,
        end_date: filters.endDate,
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

      const hasIncome = cat.income > 0;
      const hasExpense = cat.expense < 0;

      if (hasIncome || hasExpense) {
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
      const row: any = {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        income: cat.income || 0,
        expense: cat.expense || 0,
        total: cat.total_amount || 0,
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
        if (amount > 0) {
          totalsByMonth[month].income += amount;
        } else {
          totalsByMonth[month].expense += Math.abs(amount);
        }
      });
    });

    const grandTotal = {
      income: rows.reduce((sum, r) => sum + (r.income > 0 ? r.income : 0), 0),
      expense: rows.reduce((sum, r) => sum + (r.expense < 0 ? Math.abs(r.expense) : 0), 0),
      total: rows.reduce((sum, r) => sum + r.total, 0),
    };

    return {
      monthColumns: monthCols,
      categoryRows: rows,
      totals: { byMonth: totalsByMonth, grandTotal },
    };
  }, [categoryData]);

  const filteredRows = useMemo(() => {
    if (activeTab === 0) {
      return categoryRows.filter(r => r.expense < 0).sort((a, b) => a.expense - b.expense);
    } else if (activeTab === 1) {
      return categoryRows.filter(r => r.income > 0).sort((a, b) => b.income - a.income);
    } else {
      return categoryRows.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    }
  }, [categoryRows, activeTab]);

  const handleExport = () => {
    const lines: string[] = [];
    
    lines.push('Month-wise Category Report');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Period: ${filters.startDate} to ${filters.endDate}`);
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
      activeTab === 0 ? 'Expenses' : activeTab === 1 ? 'Income' : 'Total',
      ...monthColumns.map(m => totals.byMonth[m.key]?.total.toFixed(2) || '0.00'),
      totals.grandTotal.total.toFixed(2),
    ];
    lines.push(totalsRow.join(','));
    
    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monthwise-category-report-${filters.startDate}-to-${filters.endDate}.csv`;
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
        startDate={filters.startDate}
        endDate={filters.endDate}
        selectedAccounts={filters.accountIds}
      />

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

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab icon={<TrendingDown />} label="Expenses" iconPosition="start" />
          <Tab icon={<TrendingUp />} label="Income" iconPosition="start" />
          <Tab icon={<ShowChart />} label="Both" iconPosition="start" />
        </Tabs>
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
                  const amount = row.byMonth[month.key];
                  return (
                    <TableCell key={month.key} align="right">
                      {amount !== 0 && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: amount < 0 ? '#d32f2f' : amount > 0 ? '#2e7d32' : 'text.primary',
                          }}
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
                      color: row.total < 0 ? '#d32f2f' : row.total > 0 ? '#2e7d32' : 'text.primary',
                      fontWeight: 'bold',
                    }}
                  >
                    {formatCurrency(row.total)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
            
            {activeTab === 2 && (
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
                        {formatCurrency(-totals.byMonth[month.key]?.expense || 0)}
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
                      {formatCurrency(-totals.grandTotal.expense)}
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
            )}
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
              {monthColumns.map((month) => (
                <TableCell key={month.key} align="right">
                  <Typography variant="body2" fontWeight="bold">
                    {formatCurrency(totals.byMonth[month.key]?.total || 0)}
                  </Typography>
                </TableCell>
              ))}
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

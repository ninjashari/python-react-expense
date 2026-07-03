import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  PieChart as PieChartIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { investmentsApi } from '../services/api';
import CategoryPieChart from '../components/CategoryPieChart';
import { usePersistentFilters } from '../hooks/usePersistentFilters';
import { formatCurrency, formatDate, formatAccountType } from '../utils/formatters';
import { usePageTitle } from '../hooks/usePageTitle';

interface InvestmentsFilters {
  startDate: string;
  endDate: string;
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

const defaultFilters: InvestmentsFilters = {
  startDate: getCurrentFinancialYear().start,
  endDate: getCurrentFinancialYear().end,
};

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

  const { filters, setFilters } = usePersistentFilters<InvestmentsFilters>(
    'investments-filters',
    defaultFilters
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['investments-summary', filters.startDate, filters.endDate],
    queryFn: () =>
      investmentsApi.getSummary({
        start_date: filters.startDate,
        end_date: filters.endDate,
      }),
  });

  const groupA = data?.group_a;
  const groupB = data?.group_b;

  const incomeCategoryChartData = useMemo(
    () =>
      (groupB?.categories ?? [])
        .filter(c => c.period_invested > 0)
        .map(c => ({
          id: c.id,
          name: c.name,
          color: c.color,
          total_amount: c.period_invested,
          transaction_count: c.transaction_count,
          average_amount: c.transaction_count > 0 ? c.period_invested / c.transaction_count : 0,
        })),
    [groupB]
  );

  const expenseCategoryChartData = useMemo(
    () =>
      (groupB?.categories ?? [])
        .filter(c => c.period_withdrawn > 0)
        .map(c => ({
          id: c.id,
          name: c.name,
          color: c.color,
          total_amount: c.period_withdrawn,
          transaction_count: c.transaction_count,
          average_amount: c.transaction_count > 0 ? c.period_withdrawn / c.transaction_count : 0,
        })),
    [groupB]
  );

  const handleFilterChange = (field: keyof InvestmentsFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">Failed to load investments summary.</Alert>
      </Box>
    );
  }

  const hasBalanceTrackedAccounts = (groupA?.accounts.length ?? 0) > 0;
  const hasInvestmentCategories = (groupB?.categories.length ?? 0) > 0;

  return (
    <Box p={3}>
      <Box mb={3}>
        <Typography variant="h4" fontWeight="bold">Investments</Typography>
        <Typography variant="body2" color="text.secondary">
          {groupA?.accounts.length ?? 0} balance-tracked account{(groupA?.accounts.length ?? 0) !== 1 ? 's' : ''} • {groupB?.categories.length ?? 0} investment categor{(groupB?.categories.length ?? 0) !== 1 ? 'ies' : 'y'}
        </Typography>
      </Box>

      {/* Group A summary cards */}
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={12} sm={6} md={4}>
          <SummaryCard
            title="Portfolio Value"
            value={groupA?.totals.total_balance ?? 0}
            color="linear-gradient(135deg, #1565c0 0%, #42a5f5 100%)"
            icon={<AccountBalance />}
            subtitle="Current balance of PPF / Investment accounts"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <SummaryCard
            title="Net Invested to Date"
            value={groupA?.totals.total_net_invested ?? 0}
            color="linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%)"
            icon={<TrendingUp />}
            subtitle="Lifetime deposits minus withdrawals"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <SummaryCard
            title="Implied Gain / Loss"
            value={groupA?.totals.total_implied_gain_loss ?? 0}
            color={
              (groupA?.totals.total_implied_gain_loss ?? 0) >= 0
                ? 'linear-gradient(135deg, #6a1b9a 0%, #ba68c8 100%)'
                : 'linear-gradient(135deg, #c62828 0%, #ef5350 100%)'
            }
            icon={<TrendingDown />}
            subtitle="Portfolio value minus net invested"
          />
        </Grid>
      </Grid>

      {!hasBalanceTrackedAccounts && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No PPF or Investment accounts found. Add one from the Accounts page to see its balance and implied gain/loss here.
        </Alert>
      )}

      {hasBalanceTrackedAccounts && (
        <Box sx={{ mb: 4 }}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><Typography fontWeight="bold">Account</Typography></TableCell>
                  <TableCell><Typography fontWeight="bold">Type</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Balance</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Interest Rate</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Net Invested</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Implied Gain/Loss</Typography></TableCell>
                  <TableCell><Typography fontWeight="bold">Status</Typography></TableCell>
                  <TableCell><Typography fontWeight="bold">Opened</Typography></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groupA!.accounts.map(acc => (
                  <TableRow key={acc.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">{acc.name}</Typography>
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
                      <Typography variant="body2" fontWeight="bold">
                        {formatCurrency(acc.balance)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {acc.interest_rate != null ? (
                        <Chip size="small" label={`${acc.interest_rate}% p.a.`} color="success" variant="outlined" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{formatCurrency(acc.net_invested)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        color={acc.implied_gain_loss >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(acc.implied_gain_loss)}
                      </Typography>
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
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      <Divider sx={{ mb: 3 }} />

      <Box mb={2}>
        <Typography variant="h6">Investment-Tagged Cash Flows (Other Accounts)</Typography>
        <Typography variant="body2" color="text.secondary">
          Transactions in categories marked "Investment" on accounts other than the ones above. Cash flow only — not included in the gain/loss figures above, since there's no tracked balance for these to compare against.
        </Typography>
      </Box>

      {!hasInvestmentCategories ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          No categories are marked as investment. Mark a category from the Categories page to see it here.
        </Alert>
      ) : (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={3}>
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
                <Grid item xs={12} sm={6} md={3}>
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
              </Grid>
            </CardContent>
          </Card>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="Invested This Period"
                value={groupB?.totals.period_invested ?? 0}
                color="linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%)"
                icon={<TrendingUp />}
                subtitle={`${filters.startDate} – ${filters.endDate}`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="Withdrawn This Period"
                value={groupB?.totals.period_withdrawn ?? 0}
                color="linear-gradient(135deg, #c62828 0%, #ef5350 100%)"
                icon={<TrendingDown />}
                subtitle={`${filters.startDate} – ${filters.endDate}`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="Lifetime Invested"
                value={groupB?.totals.lifetime_invested ?? 0}
                color="linear-gradient(135deg, #1565c0 0%, #42a5f5 100%)"
                icon={<PieChartIcon />}
                subtitle="All-time"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="Lifetime Withdrawn"
                value={groupB?.totals.lifetime_withdrawn ?? 0}
                color="linear-gradient(135deg, #6a1b9a 0%, #ba68c8 100%)"
                icon={<PieChartIcon />}
                subtitle="All-time"
              />
            </Grid>
          </Grid>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            {incomeCategoryChartData.length > 0 && (
              <Grid item xs={12} md={expenseCategoryChartData.length > 0 ? 6 : 12}>
                <CategoryPieChart
                  data={incomeCategoryChartData}
                  title="Invested by Category (Period)"
                  transactionType="income"
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                  accountIds={[]}
                  grandTotal={incomeCategoryChartData.reduce((s, c) => s + c.total_amount, 0)}
                />
              </Grid>
            )}
            {expenseCategoryChartData.length > 0 && (
              <Grid item xs={12} md={incomeCategoryChartData.length > 0 ? 6 : 12}>
                <CategoryPieChart
                  data={expenseCategoryChartData}
                  title="Withdrawn by Category (Period)"
                  transactionType="expense"
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                  accountIds={[]}
                  grandTotal={expenseCategoryChartData.reduce((s, c) => s + c.total_amount, 0)}
                />
              </Grid>
            )}
          </Grid>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><Typography fontWeight="bold">Category</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Period Invested</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Period Withdrawn</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Lifetime Invested</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Lifetime Withdrawn</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Transactions</Typography></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groupB!.categories.map(cat => (
                  <TableRow key={cat.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box sx={{ width: 14, height: 14, backgroundColor: cat.color, borderRadius: 0.5, border: '1px solid rgba(0,0,0,0.12)', flexShrink: 0 }} />
                        <Typography variant="body2">{cat.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="success.main">{formatCurrency(cat.period_invested)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="error.main">{formatCurrency(cat.period_withdrawn)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">{formatCurrency(cat.lifetime_invested)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">{formatCurrency(cat.lifetime_withdrawn)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={cat.transaction_count} variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
};

export default Investments;

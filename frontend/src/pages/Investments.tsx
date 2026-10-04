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
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  PieChart as PieChartIcon,
  Savings,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { investmentsApi, accountsApi, categoriesApi } from '../services/api';
import CategoryPieChart from '../components/CategoryPieChart';
import InvestmentTimelineChart from '../components/InvestmentTimelineChart';
import InvestmentActivityFeed from '../components/InvestmentActivityFeed';
import MultiSelectDropdown, { Option } from '../components/MultiSelectDropdown';
import { usePersistentFilters } from '../hooks/usePersistentFilters';
import { formatCurrency, formatDate, formatAccountType } from '../utils/formatters';
import { usePageTitle } from '../hooks/usePageTitle';

type Direction = 'invested' | 'withdrawn' | 'both';

interface InvestmentsFilters {
  startDate: string;
  endDate: string;
  accountIds: Option[];
  categoryIds: Option[];
  direction: Direction;
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
  accountIds: [],
  categoryIds: [],
  direction: 'both',
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

const gainLossGradient = (value: number) =>
  value >= 0
    ? 'linear-gradient(135deg, #6a1b9a 0%, #ba68c8 100%)'
    : 'linear-gradient(135deg, #c62828 0%, #ef5350 100%)';

const Investments: React.FC = () => {
  usePageTitle({ title: 'Investments' });

  const { filters, setFilters, clearSavedFilters } = usePersistentFilters<InvestmentsFilters>(
    'investments-filters',
    defaultFilters
  );

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll(),
  });

  const accountOptions: Option[] = useMemo(
    () => (accounts ?? []).map(a => ({ value: a.id, label: a.name })),
    [accounts]
  );
  const investmentCategoryOptions: Option[] = useMemo(
    () => (categories ?? []).filter(c => c.is_investment).map(c => ({ value: c.id, label: c.name, color: c.color })),
    [categories]
  );

  const apiParams = useMemo(
    () => ({
      start_date: filters.startDate,
      end_date: filters.endDate,
      account_ids: filters.accountIds.length > 0 ? filters.accountIds.map(o => o.value).join(',') : undefined,
      category_ids: filters.categoryIds.length > 0 ? filters.categoryIds.map(o => o.value).join(',') : undefined,
      direction: filters.direction,
    }),
    [filters]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['investments-summary', apiParams],
    queryFn: () => investmentsApi.getSummary(apiParams),
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['investments-timeline', apiParams],
    queryFn: () => investmentsApi.getTimeline(apiParams),
  });

  const groupA = data?.group_a;
  const groupB = data?.group_b;
  const timelineEvents = timeline?.events ?? [];

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

  const handleFilterChange = (field: keyof InvestmentsFilters, value: any) => {
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
  const hasActiveScopeFilters = filters.accountIds.length > 0 || filters.categoryIds.length > 0;

  return (
    <Box p={3}>
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h4" fontWeight="bold">Investments</Typography>
          <Typography variant="body2" color="text.secondary">
            {groupA?.accounts.length ?? 0} balance-tracked account{(groupA?.accounts.length ?? 0) !== 1 ? 's' : ''} • {groupB?.categories.length ?? 0} investment categor{(groupB?.categories.length ?? 0) !== 1 ? 'ies' : 'y'}
          </Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} sm={6} md={2.5}>
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
            <Grid item xs={12} sm={6} md={2.5}>
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
                onChange={(value) => handleFilterChange('accountIds', Array.from(value))}
                placeholder="All accounts"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MultiSelectDropdown
                label="Investment Categories"
                options={investmentCategoryOptions}
                value={filters.categoryIds}
                onChange={(value) => handleFilterChange('categoryIds', Array.from(value))}
                placeholder="All categories"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>Direction</Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={filters.direction}
                onChange={(_e, value) => value && handleFilterChange('direction', value)}
                orientation="vertical"
                fullWidth
              >
                <ToggleButton value="both">Both</ToggleButton>
                <ToggleButton value="invested">Invested</ToggleButton>
                <ToggleButton value="withdrawn">Withdrawn</ToggleButton>
              </ToggleButtonGroup>
            </Grid>
          </Grid>
          {(filters.accountIds.length > 0 || filters.categoryIds.length > 0 || filters.direction !== 'both') && (
            <Box mt={1}>
              <Chip size="small" label="Clear filters" onClick={() => clearSavedFilters()} variant="outlined" />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Combined headline cards — always lifetime figures, unaffected by date range */}
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={12} sm={6}>
          <SummaryCard
            title="Lifetime Profit / Loss"
            value={data?.lifetime_profit_loss ?? 0}
            color={gainLossGradient(data?.lifetime_profit_loss ?? 0)}
            icon={<TrendingUp />}
            subtitle="Balance-tracked gain/loss + realized cash-flow profit (lifetime)"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <SummaryCard
            title="Currently Invested"
            value={data?.currently_invested ?? 0}
            color="linear-gradient(135deg, #1565c0 0%, #42a5f5 100%)"
            icon={<Savings />}
            subtitle="Principal still deployed, not yet withdrawn (lifetime)"
          />
        </Grid>
      </Grid>
      {hasActiveScopeFilters && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          These figures reflect your account/category selection above. Date range and direction don't affect them — they're always lifetime totals.
        </Typography>
      )}

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
            color={gainLossGradient(groupA?.totals.total_implied_gain_loss ?? 0)}
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
          Transactions in categories marked "Investment" on accounts other than the ones above. "Currently Invested" and "Realized P&amp;L" come from a running-principal replay: a withdrawal that exceeds what's still deployed in a category is treated as realized profit, closing that cycle out.
        </Typography>
      </Box>

      {!hasInvestmentCategories ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          No categories are marked as investment. Mark a category from the Categories page to see it here.
        </Alert>
      ) : (
        <>
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
                title="Currently Invested"
                value={groupB?.totals.total_running_principal ?? 0}
                color="linear-gradient(135deg, #1565c0 0%, #42a5f5 100%)"
                icon={<PieChartIcon />}
                subtitle="Lifetime — running principal"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <SummaryCard
                title="Realized Profit"
                value={groupB?.totals.total_realized_gain_loss ?? 0}
                color="linear-gradient(135deg, #6a1b9a 0%, #ba68c8 100%)"
                icon={<PieChartIcon />}
                subtitle="Lifetime — see note above"
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

          <TableContainer component={Paper} sx={{ mb: 4 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><Typography fontWeight="bold">Category</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Period Invested</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Period Withdrawn</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Lifetime Invested</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Lifetime Withdrawn</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Currently Invested</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Realized P&amp;L</Typography></TableCell>
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
                      <Typography variant="body2" fontWeight="medium">{formatCurrency(cat.running_principal)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium" color={cat.realized_gain_loss > 0 ? 'success.main' : 'text.secondary'}>
                        {formatCurrency(cat.realized_gain_loss)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={cat.transaction_count} variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box mb={2}>
            <Typography variant="h6">Investment Cash Flow by Funding Account</Typography>
            <Typography variant="body2" color="text.secondary">
              Same transactions, grouped by the account the money moved through instead of category. Cash flow only — attributing realized profit to a single funding account isn't possible when a category's invest and withdraw legs land in different accounts.
            </Typography>
          </Box>
          <TableContainer component={Paper} sx={{ mb: 4 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><Typography fontWeight="bold">Account</Typography></TableCell>
                  <TableCell><Typography fontWeight="bold">Type</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Period Invested</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Period Withdrawn</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Lifetime Invested</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Lifetime Withdrawn</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Transactions</Typography></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(groupB?.accounts ?? []).map(acc => (
                  <TableRow key={acc.account_id} hover>
                    <TableCell><Typography variant="body2" fontWeight="medium">{acc.account_name}</Typography></TableCell>
                    <TableCell>
                      <Chip size="small" label={formatAccountType(acc.account_type)} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="success.main">{formatCurrency(acc.period_invested)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="error.main">{formatCurrency(acc.period_withdrawn)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">{formatCurrency(acc.lifetime_invested)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">{formatCurrency(acc.lifetime_withdrawn)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={acc.transaction_count} variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Divider sx={{ mb: 3 }} />

      <Box mb={2}>
        <Typography variant="h6">Timeline</Typography>
        <Typography variant="body2" color="text.secondary">
          When you invested and withdrew, from/to where, per category — respects all filters above.
        </Typography>
      </Box>

      {timelineLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <InvestmentTimelineChart events={timelineEvents} />
            </CardContent>
          </Card>
          <InvestmentActivityFeed events={timelineEvents} />
        </>
      )}
    </Box>
  );
};

export default Investments;

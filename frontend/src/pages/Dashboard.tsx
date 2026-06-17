import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Chip,
  LinearProgress,
  Avatar,
} from '@mui/material';
import {
  AccountBalance,
  TrendingUp,
  TrendingDown,
  Savings,
  CreditCard,
  AccountBalanceWallet,
  Payments,
  ShowChart,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { usePageTitle, getPageTitle } from '../hooks/usePageTitle';
import { accountsApi, transactionsApi } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { Transaction } from '../types';

// Greeting based on the time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Icon per account type
const accountTypeIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'credit':
      return <CreditCard fontSize="small" />;
    case 'savings':
    case 'ppf':
      return <Savings fontSize="small" />;
    case 'investment':
      return <ShowChart fontSize="small" />;
    case 'cash':
      return <Payments fontSize="small" />;
    default:
      return <AccountBalanceWallet fontSize="small" />;
  }
};

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  delta?: { value: string; positive: boolean };
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, subtitle, delta }) => {
  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: (theme) =>
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
          bgcolor: color,
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>
              {label}
            </Typography>
            <Typography variant="h4" fontWeight={700} color={color} lineHeight={1.2}>
              {value}
            </Typography>
            <Box display="flex" alignItems="center" gap={0.75} sx={{ mt: 0.75 }}>
              {delta && (
                <Chip
                  size="small"
                  icon={delta.positive ? <ArrowUpward sx={{ fontSize: '0.85rem !important' }} /> : <ArrowDownward sx={{ fontSize: '0.85rem !important' }} />}
                  label={delta.value}
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: delta.positive ? 'success.main' : 'error.main',
                    bgcolor: (theme) =>
                      alpha(delta.positive ? theme.palette.success.main : theme.palette.error.main, 0.12),
                    '& .MuiChip-icon': {
                      color: delta.positive ? 'success.main' : 'error.main',
                      ml: 0.5,
                    },
                  }}
                />
              )}
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.5,
              background: (theme) =>
                `linear-gradient(135deg, ${alpha(color, 0.18)}, ${alpha(color, 0.08)})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const Dashboard: React.FC = () => {
  usePageTitle(getPageTitle('dashboard', 'Financial Overview'));
  const theme = useTheme();

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['transactions', 'summary'],
    queryFn: () => transactionsApi.getSummary(),
  });

  const { data: recentTransactionData, isLoading: recentTransactionsLoading } = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: () => transactionsApi.getAll({ size: 8 }),
  });

  const totalBalance = accounts?.reduce((sum, account) => {
    const balance = Number(account.balance || 0);
    if (account.type === 'credit') {
      return sum - Math.max(0, balance);
    } else {
      return sum + balance;
    }
  }, 0) ?? 0;

  if (accountsLoading || summaryLoading || recentTransactionsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  const totalIncome = summary?.total_income ?? 0;
  const totalExpense = summary?.total_expense ?? 0;
  const netAmount = summary?.net_amount ?? 0;
  const savingsRate = totalIncome > 0 ? Math.round((netAmount / totalIncome) * 100) : 0;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} lineHeight={1.2}>
          {getGreeting()}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {today} · Here's your financial summary
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Hero Net Worth Card */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
              border: 'none',
              color: '#fff',
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 60%, ${theme.palette.secondary.main} 140%)`,
              boxShadow: `0 16px 32px -12px ${alpha(theme.palette.primary.main, 0.6)}`,
            }}
          >
            {/* Decorative circles */}
            <Box
              sx={{
                position: 'absolute',
                top: -50,
                right: -40,
                width: 180,
                height: 180,
                borderRadius: '50%',
                bgcolor: alpha('#fff', 0.08),
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: -60,
                right: 30,
                width: 120,
                height: 120,
                borderRadius: '50%',
                bgcolor: alpha('#fff', 0.06),
              }}
            />
            <CardContent sx={{ p: 3, position: 'relative' }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2.5,
                    bgcolor: alpha('#fff', 0.2),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AccountBalance />
                </Box>
                <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                  Net Worth
                </Typography>
              </Box>

              <Typography variant="h3" fontWeight={700} sx={{ letterSpacing: '-0.02em' }}>
                {formatCurrency(totalBalance)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                Assets minus liabilities
              </Typography>

              <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${alpha('#fff', 0.18)}` }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.75}>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Savings rate
                  </Typography>
                  <Typography variant="caption" fontWeight={700}>
                    {savingsRate}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, Math.min(100, savingsRate))}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: alpha('#fff', 0.2),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      bgcolor: '#fff',
                    },
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Supporting Stat Cards */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <StatCard
                label="Total Income"
                value={formatCurrency(totalIncome)}
                icon={<TrendingUp />}
                color={theme.palette.success.main}
                subtitle="All time"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard
                label="Total Expenses"
                value={formatCurrency(totalExpense)}
                icon={<TrendingDown />}
                color={theme.palette.error.main}
                subtitle="All time"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard
                label="Net Income"
                value={formatCurrency(netAmount)}
                icon={<Savings />}
                color={netAmount >= 0 ? theme.palette.success.main : theme.palette.error.main}
                delta={{ value: `${Math.abs(savingsRate)}%`, positive: netAmount >= 0 }}
                subtitle="cash flow"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard
                label="Accounts"
                value={String(accounts?.length ?? 0)}
                icon={<AccountBalanceWallet />}
                color={theme.palette.primary.main}
                subtitle="active accounts"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard
                label="Transactions"
                value={String(summary?.transaction_count ?? 0)}
                icon={<ShowChart />}
                color={theme.palette.info.main}
                subtitle="recorded"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard
                label="Credit Cards"
                value={String(accounts?.filter((a) => a.type === 'credit').length ?? 0)}
                icon={<CreditCard />}
                color={theme.palette.warning.main}
                subtitle="cards tracked"
              />
            </Grid>
          </Grid>
        </Grid>

        {/* Accounts Overview */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Accounts
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 1 }}>
                {accounts?.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No accounts yet.
                  </Typography>
                )}
                {accounts?.map((account) => {
                  const isCredit = account.type === 'credit';
                  const isNegative = isCredit ? account.balance > 0 : account.balance < 0;
                  const displayValue =
                    isCredit && account.balance > 0
                      ? `${formatCurrency(account.balance)} due`
                      : formatCurrency(account.balance);

                  return (
                    <Box
                      key={account.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        p: 1.5,
                        borderRadius: 2.5,
                        border: `1px solid ${theme.palette.divider}`,
                        transition: 'background-color 0.15s ease, border-color 0.15s ease',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.04),
                          borderColor: alpha(theme.palette.primary.main, 0.3),
                        },
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar
                          variant="rounded"
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                          }}
                        >
                          {accountTypeIcon(account.type)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {account.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ textTransform: 'capitalize' }}
                          >
                            {account.type.replace('_', ' ')}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color={isNegative ? 'error.main' : 'text.primary'}
                      >
                        {displayValue}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Transactions */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Recent Transactions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1 }}>
                {recentTransactionData?.items?.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No transactions yet.
                  </Typography>
                )}
                {recentTransactionData?.items?.map((transaction: Transaction) => {
                  const isIncome = transaction.type === 'income';
                  const directionColor = isIncome
                    ? theme.palette.success.main
                    : theme.palette.error.main;
                  return (
                    <Box
                      key={transaction.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: 1.25,
                        px: 1,
                        mx: -1,
                        borderRadius: 2,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        '&:last-child': { borderBottom: 'none' },
                        transition: 'background-color 0.15s ease',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden', mr: 2 }}>
                        <Avatar
                          sx={{
                            width: 38,
                            height: 38,
                            bgcolor: alpha(directionColor, 0.12),
                            color: directionColor,
                          }}
                        >
                          {isIncome ? <ArrowDownward fontSize="small" /> : <ArrowUpward fontSize="small" />}
                        </Avatar>
                        <Box sx={{ overflow: 'hidden' }}>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            noWrap
                            title={transaction.description || 'No description'}
                          >
                            {transaction.description || 'No description'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(transaction.date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}{' '}
                            · {transaction.account?.name}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color={isIncome ? 'success.main' : 'error.main'}
                        sx={{ flexShrink: 0 }}
                      >
                        {isIncome ? '+' : '−'}
                        {formatCurrency(transaction.amount)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;

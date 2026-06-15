import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  AccountBalance,
  TrendingUp,
  TrendingDown,
  Savings,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { usePageTitle, getPageTitle } from '../hooks/usePageTitle';
import { accountsApi, transactionsApi } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { Transaction } from '../types';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, subtitle }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>
              {label}
            </Typography>
            <Typography variant="h4" fontWeight={700} color={color} lineHeight={1.2}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.5,
              bgcolor: alpha(color, 0.12),
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
    queryFn: () => transactionsApi.getAll({ size: 10 }),
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

  const netAmount = summary?.net_amount ?? 0;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Financial Overview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your complete financial summary at a glance
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Stat Cards */}
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            label="Net Worth"
            value={formatCurrency(totalBalance)}
            icon={<AccountBalance />}
            color={theme.palette.primary.main}
            subtitle="Assets minus liabilities"
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            label="Total Income"
            value={formatCurrency(summary?.total_income ?? 0)}
            icon={<TrendingUp />}
            color={theme.palette.success.main}
            subtitle="All time earnings"
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            label="Total Expenses"
            value={formatCurrency(summary?.total_expense ?? 0)}
            icon={<TrendingDown />}
            color={theme.palette.error.main}
            subtitle="All time spending"
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            label="Net Income"
            value={formatCurrency(netAmount)}
            icon={<Savings />}
            color={netAmount >= 0 ? theme.palette.success.main : theme.palette.error.main}
            subtitle={netAmount >= 0 ? 'Positive cash flow' : 'Negative cash flow'}
          />
        </Grid>

        {/* Accounts Overview */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Accounts
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {accounts?.map((account) => {
                  const isCredit = account.type === 'credit';
                  const isNegative = isCredit
                    ? account.balance > 0
                    : account.balance < 0;
                  const displayValue = isCredit && account.balance > 0
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
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                        border: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {account.name}
                        </Typography>
                        <Chip
                          label={account.type.replace('_', ' ')}
                          size="small"
                          sx={{
                            mt: 0.5,
                            height: 18,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                          }}
                        />
                      </Box>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={isNegative ? 'error.main' : 'success.main'}
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
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Recent Transactions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {recentTransactionData?.items?.map((transaction: Transaction) => (
                  <Box
                    key={transaction.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Box sx={{ overflow: 'hidden', mr: 2 }}>
                      <Typography
                        variant="body2"
                        fontWeight={500}
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
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color={transaction.type === 'income' ? 'success.main' : 'error.main'}
                      sx={{ flexShrink: 0 }}
                    >
                      {transaction.type === 'income' ? '+' : '−'}
                      {formatCurrency(transaction.amount)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;

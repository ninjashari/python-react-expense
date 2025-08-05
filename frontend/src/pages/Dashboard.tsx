import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { accountsApi, reportsApi, transactionsApi } from '../services/api';
import { formatCurrency } from '../utils/formatters';

const Dashboard: React.FC = () => {
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: () => reportsApi.getSummary(),
  });

  const { data: recentTransactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: () => transactionsApi.getAll({ limit: 5 }),
  });

  // Calculate total net worth (assets - debts)
  const totalBalance = accounts?.reduce((sum, account) => {
    const balance = Number(account.balance || 0);
    if (account.type === 'credit') {
      // For credit cards, subtract debt from total (positive balance = debt)
      return sum - Math.max(0, balance);
    } else {
      // For regular accounts, add balance to total
      return sum + balance;
    }
  }, 0) || 0;

  if (accountsLoading || summaryLoading || transactionsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* Summary Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Balance
              </Typography>
              <Typography variant="h5" component="div">
                {formatCurrency(totalBalance)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Income
              </Typography>
              <Typography variant="h5" component="div" color="success.main">
                {formatCurrency(summary?.total_income || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Expenses
              </Typography>
              <Typography variant="h5" component="div" color="error.main">
                {formatCurrency(summary?.total_expenses || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Net Income
              </Typography>
              <Typography
                variant="h5"
                component="div"
                color={summary?.net_income && summary.net_income >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrency(summary?.net_income || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Accounts Overview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Accounts Overview
              </Typography>
              {accounts?.map((account) => (
                <Box key={account.id} sx={{ mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body1">{account.name}</Typography>
                    <Typography
                      variant="body2"
                      color={
                        account.type === 'credit'
                          ? (account.balance > 0 ? 'error.main' : 'success.main')
                          : (account.balance >= 0 ? 'success.main' : 'error.main')
                      }
                    >
                      {account.type === 'credit' && account.balance > 0 
                        ? `${formatCurrency(account.balance)} debt` 
                        : formatCurrency(account.balance)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    {account.type.replace('_', ' ').toUpperCase()}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Transactions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Transactions
              </Typography>
              {recentTransactions?.map((transaction) => (
                <Box key={transaction.id} sx={{ mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2">
                        {transaction.description || 'No description'}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(transaction.date).toLocaleDateString()} • {transaction.account?.name}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      color={
                        transaction.type === 'income'
                          ? 'success.main'
                          : 'error.main'
                      }
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
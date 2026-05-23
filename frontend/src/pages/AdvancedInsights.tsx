import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  Warning,
  AccountBalance as BudgetIcon,
  Timeline,
  TrendingDown,
  ShowChart,
  InfoOutlined,
  CheckCircle,
  ErrorOutline,
  CalendarToday,
  Insights as InsightsIcon,
  Assessment,
  Category as CategoryIcon,
  Payment,
  LocalAtm,
} from '@mui/icons-material';
import {
  useSpendingPredictions,
  useSpendingAnomalies,
  useBudgetRecommendations,
  useTrendForecast
} from '../hooks/useLearning';
import { usePageTitle, getPageTitle } from '../hooks/usePageTitle';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi, accountsApi, categoriesApi, payeesApi } from '../services/api';
import { Transaction, Account, Category, Payee } from '../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`advanced-insights-tabpanel-${index}`}
      aria-labelledby={`advanced-insights-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const AdvancedInsights: React.FC = () => {
  usePageTitle(getPageTitle('advanced-insights', 'Advanced Insights'));
  const [tabValue, setTabValue] = useState(0);

  // Load transaction data for overview insights
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', { size: 1000 }], // Get recent transactions for analysis
    queryFn: () => transactionsApi.getAll({ size: 1000 }),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll(),
  });

  const { data: payees } = useQuery({
    queryKey: ['payees'],
    queryFn: () => payeesApi.getAll(),
  });

  // Load advanced ML data
  const { data: predictions, isLoading: predictionsLoading, error: predictionsError } = useSpendingPredictions();
  const { data: anomalies, isLoading: anomaliesLoading, error: anomaliesError } = useSpendingAnomalies();
  const { data: budgetRecs, isLoading: budgetLoading, error: budgetError } = useBudgetRecommendations();
  const { data: trends, isLoading: trendsLoading, error: trendsError } = useTrendForecast();

  // Calculate overview insights
  const insights = useMemo(() => {
    if (!transactions?.items || !accounts || !categories || !payees) {
      return null;
    }

    const allTransactions = transactions.items;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    // Recent transactions (last 30 days)
    const recentTransactions = allTransactions.filter((t: Transaction) => new Date(t.date) >= thirtyDaysAgo);
    const last6MonthsTransactions = allTransactions.filter((t: Transaction) => new Date(t.date) >= sixMonthsAgo);

    // Income vs Expenses
    const totalIncome = recentTransactions
      .filter((t: Transaction) => t.type === 'income')
      .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0);
    
    const totalExpenses = recentTransactions
      .filter((t: Transaction) => t.type === 'expense')
      .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0);

    // Category analysis
    const categorySpending = new Map<string, { amount: number; count: number; name: string; color?: string }>();
    recentTransactions
      .filter((t: Transaction) => t.type === 'expense' && t.category_id)
      .forEach((t: Transaction) => {
        const category = categories.find((c: Category) => c.id === t.category_id);
        const existing = categorySpending.get(t.category_id!) || { amount: 0, count: 0, name: category?.name || 'Unknown', color: category?.color };
        categorySpending.set(t.category_id!, {
          ...existing,
          amount: existing.amount + Number(t.amount),
          count: existing.count + 1
        });
      });

    const topCategories = Array.from(categorySpending.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Payee analysis
    const payeeSpending = new Map<string, { amount: number; count: number; name: string; color?: string }>();
    recentTransactions
      .filter((t: Transaction) => t.type === 'expense' && t.payee_id)
      .forEach((t: Transaction) => {
        const payee = payees.find((p: Payee) => p.id === t.payee_id);
        const existing = payeeSpending.get(t.payee_id!) || { amount: 0, count: 0, name: payee?.name || 'Unknown', color: payee?.color };
        payeeSpending.set(t.payee_id!, {
          ...existing,
          amount: existing.amount + Number(t.amount),
          count: existing.count + 1
        });
      });

    const topPayees = Array.from(payeeSpending.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Monthly trends (last 6 months)
    const monthlyData = new Map<string, { income: number; expenses: number; transactions: number }>();
    last6MonthsTransactions.forEach((t: Transaction) => {
      const monthKey = new Date(t.date).toISOString().slice(0, 7); // YYYY-MM
      const existing = monthlyData.get(monthKey) || { income: 0, expenses: 0, transactions: 0 };
      monthlyData.set(monthKey, {
        income: existing.income + (t.type === 'income' ? Number(t.amount) : 0),
        expenses: existing.expenses + (t.type === 'expense' ? Number(t.amount) : 0),
        transactions: existing.transactions + 1
      });
    });

    const monthlyTrends = Array.from(monthlyData.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    // Account analysis
    const accountBalances = accounts.map((account: Account) => ({
      ...account,
      balance: Number(account.balance || 0),
      recent_transactions: recentTransactions.filter((t: Transaction) => t.account_id === account.id).length
    }));

    // Calculate averages
    const avgDailyExpenses = totalExpenses / 30;
    const avgTransactionAmount = recentTransactions.length > 0 
      ? recentTransactions.reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0) / recentTransactions.length 
      : 0;

    // Uncategorized transactions
    const uncategorizedCount = recentTransactions.filter((t: Transaction) => t.type === 'expense' && !t.category_id).length;
    const uncategorizedAmount = recentTransactions
      .filter((t: Transaction) => t.type === 'expense' && !t.category_id)
      .reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0);

    return {
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses,
      topCategories,
      topPayees,
      monthlyTrends,
      accountBalances,
      avgDailyExpenses,
      avgTransactionAmount,
      uncategorizedCount,
      uncategorizedAmount,
      totalTransactions: recentTransactions.length,
      categorySpendingMap: categorySpending,
      payeeSpendingMap: payeeSpending
    };
  }, [transactions, accounts, categories, payees]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp color="error" />;
      case 'decreasing': return <TrendingDown color="success" />;
      case 'stable': return <ShowChart color="primary" />;
      default: return <ShowChart />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  // Overview Tab Component
  const OverviewTab = () => {
    if (transactionsLoading) return <CircularProgress />;
    if (!insights) return <Alert severity="info">No transaction data available for analysis</Alert>;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment color="primary" />
            Financial Overview (Last 30 Days)
          </Typography>
        </Grid>

        {/* Summary Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Income
              </Typography>
              <Typography variant="h4" component="div" color="success.main">
                {formatCurrency(insights.totalIncome)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Last 30 days
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
              <Typography variant="h4" component="div" color="error.main">
                {formatCurrency(insights.totalExpenses)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Avg: {formatCurrency(insights.avgDailyExpenses)}/day
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
                variant="h4" 
                component="div" 
                color={insights.netIncome >= 0 ? 'success.main' : 'error.main'}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                {insights.netIncome >= 0 ? <TrendingUp /> : <TrendingDown />}
                {formatCurrency(Math.abs(insights.netIncome))}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {insights.netIncome >= 0 ? 'Surplus' : 'Deficit'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Transactions
              </Typography>
              <Typography variant="h4" component="div">
                {insights.totalTransactions}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Avg: {formatCurrency(insights.avgTransactionAmount)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Data Quality Alert */}
        {insights.uncategorizedCount > 0 && (
          <Grid item xs={12}>
            <Alert severity="warning" icon={<Warning />}>
              <Typography variant="subtitle2">
                Data Quality Notice
              </Typography>
              You have {insights.uncategorizedCount} uncategorized expense transactions totaling {formatCurrency(insights.uncategorizedAmount)}. 
              Categorizing these will improve your insights accuracy.
            </Alert>
          </Grid>
        )}

        {/* Top Categories */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CategoryIcon />
                Top Spending Categories
              </Typography>
              <List>
                {insights.topCategories.map((category, index) => (
                  <ListItem key={category.id} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: category.color || '#ccc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '0.8rem'
                        }}
                      >
                        {index + 1}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={category.name}
                      secondary={`${category.count} transactions`}
                    />
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body1" fontWeight="bold">
                        {formatCurrency(category.amount)}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {((category.amount / insights.totalExpenses) * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Payees */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Payment />
                Top Payees
              </Typography>
              <List>
                {insights.topPayees.map((payee, index) => (
                  <ListItem key={payee.id} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: payee.color || '#ccc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '0.8rem'
                        }}
                      >
                        {index + 1}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={payee.name}
                      secondary={`${payee.count} transactions`}
                    />
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body1" fontWeight="bold">
                        {formatCurrency(payee.amount)}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {((payee.amount / insights.totalExpenses) * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Trends */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Timeline />
                Monthly Trends (Last 6 Months)
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Month</TableCell>
                      <TableCell align="right">Income</TableCell>
                      <TableCell align="right">Expenses</TableCell>
                      <TableCell align="right">Net</TableCell>
                      <TableCell align="right">Transactions</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {insights.monthlyTrends.map((month) => {
                      const net = month.income - month.expenses;
                      return (
                        <TableRow key={month.month}>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(month.month + '-01').toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short' 
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>
                            {formatCurrency(month.income)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'error.main' }}>
                            {formatCurrency(month.expenses)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: net >= 0 ? 'success.main' : 'error.main' }}>
                            {formatCurrency(net)}
                          </TableCell>
                          <TableCell align="right">
                            {month.transactions}
                          </TableCell>
                          <TableCell align="center">
                            {net >= 0 ? 
                              <CheckCircle color="success" fontSize="small" /> : 
                              <ErrorOutline color="error" fontSize="small" />
                            }
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Account Summary */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocalAtm />
                Account Summary
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Account</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      <TableCell align="right">Recent Activity</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {insights.accountBalances.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <Typography variant="body1" fontWeight="medium">
                            {account.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={account.type.charAt(0).toUpperCase() + account.type.slice(1)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography 
                            variant="body1" 
                            fontWeight="bold"
                            color={account.balance >= 0 ? 'success.main' : 'error.main'}
                          >
                            {formatCurrency(account.balance)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {account.recent_transactions} transactions
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {account.recent_transactions > 0 ? 
                            <CheckCircle color="success" fontSize="small" /> : 
                            <ErrorOutline color="warning" fontSize="small" />
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Spending Predictions Tab
  const SpendingPredictionsTab = () => {
    if (predictionsLoading) return <CircularProgress />;
    if (predictionsError) return <Alert severity="error">Error loading predictions</Alert>;
    if (!predictions) return <Alert severity="info">No prediction data available</Alert>;

    const nextMonthPredictions = predictions.predictions.filter(p => p.month === new Date().getMonth() + 2);
    const totalPredicted = nextMonthPredictions.reduce((sum, p) => sum + p.predicted_amount, 0);

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="primary" />
            Spending Pattern Predictions
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Next Month Forecast
              </Typography>
              <Typography variant="h4" component="div" color="primary">
                {formatCurrency(totalPredicted)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {nextMonthPredictions.length} categories
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Analysis Period
              </Typography>
              <Typography variant="h4" component="div">
                {predictions.total_months_analyzed}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Months analyzed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Categories
              </Typography>
              <Typography variant="h4" component="div" color="info.main">
                {predictions.categories_with_predictions}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                With predictions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Avg Confidence
              </Typography>
              <Typography variant="h4" component="div" color="success.main">
                {nextMonthPredictions.length > 0 
                  ? `${Math.round(nextMonthPredictions.reduce((sum, p) => sum + p.confidence, 0) / nextMonthPredictions.length * 100)}%`
                  : 'N/A'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Prediction accuracy
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Category Predictions - Next 3 Months
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Month</TableCell>
                      <TableCell align="right">Predicted Amount</TableCell>
                      <TableCell align="center">Trend</TableCell>
                      <TableCell align="center">Confidence</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {predictions.predictions.slice(0, 12).map((prediction, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: prediction.category_color,
                              }}
                            />
                            {prediction.category_name}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {prediction.month_name} {prediction.year}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(prediction.predicted_amount)}
                        </TableCell>
                        <TableCell align="center">
                          {getTrendIcon(prediction.trend)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${Math.round(prediction.confidence * 100)}%`}
                            size="small"
                            color={prediction.confidence > 0.8 ? 'success' : 'warning'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Anomaly Detection Tab
  const AnomalyDetectionTab = () => {
    if (anomaliesLoading) return <CircularProgress />;
    if (anomaliesError) return <Alert severity="error">Error loading anomalies</Alert>;
    if (!anomalies) return <Alert severity="info">No anomaly data available</Alert>;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="warning" />
            Spending Anomaly Detection
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Anomalies
              </Typography>
              <Typography variant="h4" component="div" color="warning.main">
                {anomalies.summary.total_anomalies}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                High Severity
              </Typography>
              <Typography variant="h4" component="div" color="error.main">
                {anomalies.summary.high_severity}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Medium Severity
              </Typography>
              <Typography variant="h4" component="div" color="warning.main">
                {anomalies.summary.medium_severity}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Analysis Period
              </Typography>
              <Typography variant="h4" component="div">
                {anomalies.summary.analysis_period}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {anomalies.anomalies.length === 0 ? (
          <Grid item xs={12}>
            <Alert severity="success" icon={<CheckCircle />}>
              Great news! No spending anomalies detected in the last 90 days. Your spending patterns appear normal.
            </Alert>
          </Grid>
        ) : (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Detected Anomalies
                </Typography>
                <List>
                  {anomalies.anomalies.map((anomaly, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        {anomaly.severity === 'high' && <ErrorOutline color="error" />}
                        {anomaly.severity === 'medium' && <Warning color="warning" />}
                        {anomaly.severity === 'low' && <InfoOutlined color="info" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box>
                            {anomaly.type === 'large_amount' && (
                              <Typography variant="body1">
                                Large Transaction: {anomaly.description}
                              </Typography>
                            )}
                            {anomaly.type === 'unusual_frequency' && (
                              <Typography variant="body1">
                                Unusual Frequency: {anomaly.category_name}
                              </Typography>
                            )}
                            {anomaly.type === 'new_payee_spending' && (
                              <Typography variant="body1">
                                New Payee: {anomaly.payee_name}
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            {anomaly.amount && (
                              <Typography variant="body2" color="textSecondary">
                                Amount: {formatCurrency(anomaly.amount)} on {formatDate(anomaly.date || '')}
                              </Typography>
                            )}
                            {anomaly.recent_count && (
                              <Typography variant="body2" color="textSecondary">
                                Frequency: {anomaly.recent_count} transactions (expected: {anomaly.expected_count})
                              </Typography>
                            )}
                            {anomaly.total_amount && (
                              <Typography variant="body2" color="textSecondary">
                                Total: {formatCurrency(anomaly.total_amount)} across {anomaly.transaction_count} transactions
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <Chip
                        label={anomaly.severity.toUpperCase()}
                        size="small"
                        color={getSeverityColor(anomaly.severity)}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    );
  };

  // Budget Recommendations Tab
  const BudgetRecommendationsTab = () => {
    if (budgetLoading) return <CircularProgress />;
    if (budgetError) return <Alert severity="error">Error loading budget recommendations</Alert>;
    if (!budgetRecs) return <Alert severity="info">No budget data available</Alert>;

    const feasibilityColor = {
      'good': 'success',
      'tight': 'warning', 
      'over_budget': 'error'
    }[budgetRecs.summary.budget_feasibility] || 'default';

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BudgetIcon color="primary" />
            Smart Budget Recommendations
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Recommended Budget
              </Typography>
              <Typography variant="h4" component="div" color="primary">
                {formatCurrency(budgetRecs.summary.total_recommended_budget)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Monthly total
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Average Income
              </Typography>
              <Typography variant="h4" component="div" color="success.main">
                {formatCurrency(budgetRecs.summary.average_monthly_income)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Savings Rate
              </Typography>
              <Typography variant="h4" component="div" color="info.main">
                {Math.round(budgetRecs.summary.recommended_savings_rate * 100)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Budget Health
              </Typography>
              <Typography variant="h6" component="div" color={`${feasibilityColor}.main`} sx={{ textTransform: 'capitalize' }}>
                {budgetRecs.summary.budget_feasibility.replace('_', ' ')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {budgetRecs.insights.best_savings_opportunity && (
          <Grid item xs={12}>
            <Alert severity="info">
              💡 <strong>Best savings opportunity:</strong> {budgetRecs.insights.best_savings_opportunity}
              <br />
              <strong>Highest spending:</strong> {budgetRecs.insights.highest_spending_category}
              <br />
              <strong>Most variable:</strong> {budgetRecs.insights.most_variable_category}
            </Alert>
          </Grid>
        )}

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Category Budget Recommendations
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Current Avg</TableCell>
                      <TableCell align="right">Recommended</TableCell>
                      <TableCell align="center">Trend</TableCell>
                      <TableCell align="center">Priority</TableCell>
                      <TableCell align="center">Confidence</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {budgetRecs.category_recommendations.map((rec) => (
                      <TableRow key={rec.category_id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: rec.category_color,
                              }}
                            />
                            {rec.category_name}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(rec.current_avg_spending)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography 
                            color={rec.recommended_budget > rec.current_avg_spending ? 'error.main' : 'success.main'}
                            fontWeight="bold"
                          >
                            {formatCurrency(rec.recommended_budget)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {getTrendIcon(rec.trend)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={rec.priority.toUpperCase()}
                            size="small"
                            color={getPriorityColor(rec.priority)}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <LinearProgress 
                            variant="determinate" 
                            value={rec.confidence * 100}
                            sx={{ width: 60, height: 8, borderRadius: 4 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Trend Forecasting Tab
  const TrendForecastingTab = () => {
    if (trendsLoading) return <CircularProgress />;
    if (trendsError) return <Alert severity="error">Error loading trend forecast</Alert>;
    if (!trends) return <Alert severity="info">No trend data available</Alert>;

    const recentData = trends.historical_data.slice(-6);

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Timeline color="primary" />
            Expense Trend Forecasting
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Data Quality
              </Typography>
              <Typography variant="h6" component="div" sx={{ textTransform: 'capitalize' }}>
                {trends.trend_analysis.data_quality}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Expense Trend
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getTrendIcon(trends.trend_analysis.expense_trend)}
                <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                  {trends.trend_analysis.expense_trend.replace('_', ' ')}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Income Trend
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getTrendIcon(trends.trend_analysis.income_trend)}
                <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                  {trends.trend_analysis.income_trend.replace('_', ' ')}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Months Analyzed
              </Typography>
              <Typography variant="h4" component="div">
                {trends.trend_analysis.months_analyzed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Monthly Trends (Last 6 Months)
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Month</TableCell>
                      <TableCell align="right">Income</TableCell>
                      <TableCell align="right">Expenses</TableCell>
                      <TableCell align="right">Net Income</TableCell>
                      <TableCell align="center">Performance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentData.map((month) => (
                      <TableRow key={month.month_key}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarToday fontSize="small" />
                            {month.month_name} {month.year}
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>
                          {formatCurrency(month.income)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>
                          {formatCurrency(month.expense)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: month.net_income > 0 ? 'success.main' : 'error.main' }}>
                          {formatCurrency(month.net_income)}
                        </TableCell>
                        <TableCell align="center">
                          {month.net_income > 0 ? 
                            <CheckCircle color="success" /> : 
                            <ErrorOutline color="error" />
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {trends.forecasts.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  3-Month Forecast
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Month</TableCell>
                        <TableCell align="right">Forecasted Income</TableCell>
                        <TableCell align="right">Forecasted Expenses</TableCell>
                        <TableCell align="right">Forecasted Net</TableCell>
                        <TableCell align="center">Confidence</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {trends.forecasts.map((forecast, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {forecast.month_name} {forecast.year}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>
                            {formatCurrency(forecast.forecasted_income)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'error.main' }}>
                            {formatCurrency(forecast.forecasted_expense)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: forecast.forecasted_net_income > 0 ? 'success.main' : 'error.main' }}>
                            {formatCurrency(forecast.forecasted_net_income)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={`${Math.round(forecast.confidence * 100)}%`}
                              size="small"
                              color={forecast.confidence > 0.8 ? 'success' : 'warning'}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    );
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InsightsIcon />
          Advanced Insights
        </Typography>
        <Tooltip title="AI-powered predictions, anomaly detection, budget recommendations, and trend forecasting">
          <IconButton>
            <InfoOutlined />
          </IconButton>
        </Tooltip>
      </Box>

      <Paper>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="advanced insights tabs">
          <Tab label="Overview" icon={<Assessment />} />
          <Tab label="Predictions" icon={<TrendingUp />} />
          <Tab label="Anomalies" icon={<Warning />} />
          <Tab label="Budget" icon={<BudgetIcon />} />
          <Tab label="Forecasting" icon={<Timeline />} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <OverviewTab />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <SpendingPredictionsTab />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <AnomalyDetectionTab />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <BudgetRecommendationsTab />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <TrendForecastingTab />
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default AdvancedInsights;
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import {
  TrendingUp,
  Warning,
  Timeline,
  TrendingDown,
  ShowChart,
  InfoOutlined,
  CheckCircle,
  ErrorOutline,
  Insights as InsightsIcon,
  Assessment,
  Category as CategoryIcon,
  Payment,
  Refresh,
  PieChart,
  BarChart,
  AccountBox,
} from '@mui/icons-material';
import {
  useSpendingPredictions,
  useSpendingAnomalies,
  useBudgetRecommendations
} from '../hooks/useLearning';
import { usePageTitle, getPageTitle } from '../hooks/usePageTitle';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi, accountsApi } from '../services/api';

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
      id={`insights-tabpanel-${index}`}
      aria-labelledby={`insights-tab-${index}`}
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

const Insights: React.FC = () => {
  usePageTitle(getPageTitle('insights', 'Financial Insights'));
  const [tabValue, setTabValue] = useState(0);
  const [dateRange, setDateRange] = useState('last30');
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  // Calculate date range based on selection
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end = now;

    switch (dateRange) {
      case 'last7':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last90':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'last6months':
        start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case 'last12months':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }, [dateRange]);

  // Data queries with automatic refetching
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll(),
    refetchOnWindowFocus: true,
  });

  const { data: transactionSummary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['transaction-summary', startDate, endDate, selectedAccount],
    queryFn: () => transactionsApi.getSummary({
      start_date: startDate,
      end_date: endDate,
      account_ids: selectedAccount || undefined
    }),
    refetchOnWindowFocus: true,
  });

  const { data: categoryData, isLoading: categoryLoading, refetch: refetchCategory } = useQuery({
    queryKey: ['category-report', startDate, endDate, selectedAccount, 'comprehensive'],
    queryFn: () => transactionsApi.getByCategory({
      start_date: startDate,
      end_date: endDate,
      account_ids: selectedAccount || undefined,
      use_all_data: true  // Use all historical data for comprehensive analysis
    }),
    refetchOnWindowFocus: true,
  });

  const { data: payeeData, isLoading: payeeLoading, refetch: refetchPayee } = useQuery({
    queryKey: ['payee-report', startDate, endDate, selectedAccount, 'comprehensive'],
    queryFn: () => transactionsApi.getByPayee({
      start_date: startDate,
      end_date: endDate,
      account_ids: selectedAccount || undefined,
      use_all_data: true  // Use all historical data for comprehensive analysis
    }),
    refetchOnWindowFocus: true,
  });

  const { data: accountData, isLoading: accountLoading, refetch: refetchAccount } = useQuery({
    queryKey: ['account-report', startDate, endDate, 'comprehensive'],
    queryFn: () => transactionsApi.getByAccount({
      start_date: startDate,
      end_date: endDate,
      use_all_data: true  // Use all historical data for comprehensive analysis
    }),
    refetchOnWindowFocus: true,
  });

  const { data: monthlyTrend, isLoading: trendLoading, refetch: refetchTrend } = useQuery({
    queryKey: ['monthly-trend', selectedAccount, 'comprehensive'],
    queryFn: () => transactionsApi.getMonthlyTrend({
      months: 12,
      account_ids: selectedAccount || undefined,
      use_all_data: true  // Use all historical data for comprehensive analysis
    }),
    refetchOnWindowFocus: true,
  });

  // Comprehensive analysis using all historical data
  const { data: comprehensiveAnalysis, isLoading: comprehensiveLoading, refetch: refetchComprehensive } = useQuery({
    queryKey: ['comprehensive-analysis'],
    queryFn: () => transactionsApi.getComprehensiveAnalysis(),
    refetchOnWindowFocus: true,
  });

  const { data: predictionInsights, isLoading: predictionInsightsLoading, refetch: refetchPredictions } = useQuery({
    queryKey: ['prediction-insights'],
    queryFn: () => transactionsApi.getPredictionInsights(6), // 6 months ahead
    refetchOnWindowFocus: true,
  });

  // AI/ML insights (legacy support)
  const { data: predictions, isLoading: predictionsLoading } = useSpendingPredictions();
  const { data: anomalies, isLoading: anomaliesLoading } = useSpendingAnomalies();
  const { data: budgetRecs, isLoading: budgetLoading } = useBudgetRecommendations();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const [retrainingModels, setRetrainingModels] = useState(false);

  const handleRefreshAll = () => {
    refetchSummary();
    refetchCategory();
    refetchPayee();
    refetchAccount();
    refetchTrend();
    refetchComprehensive();
    refetchPredictions();
  };

  const handleRetrainModels = async () => {
    setRetrainingModels(true);
    try {
      await transactionsApi.retrainModels();
      // Refresh prediction data after retraining
      refetchPredictions();
      refetchComprehensive();
      // Show success notification (you can add toast here)
    } catch (error) {
      console.error('Model retraining failed:', error);
      // Show error notification
    } finally {
      setRetrainingModels(false);
    }
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

  // Overview Tab Component
  const OverviewTab = () => {
    if (summaryLoading) return <CircularProgress />;

    return (
      <Grid container spacing={3}>
        {/* Filter Controls */}
        <Grid item xs={12}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Date Range</InputLabel>
                    <Select
                      value={dateRange}
                      label="Date Range"
                      onChange={(e) => setDateRange(e.target.value)}
                    >
                      <MenuItem value="last7">Last 7 Days</MenuItem>
                      <MenuItem value="last30">Last 30 Days</MenuItem>
                      <MenuItem value="last90">Last 90 Days</MenuItem>
                      <MenuItem value="last6months">Last 6 Months</MenuItem>
                      <MenuItem value="last12months">Last 12 Months</MenuItem>
                      <MenuItem value="thisMonth">This Month</MenuItem>
                      <MenuItem value="thisYear">This Year</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Account</InputLabel>
                    <Select
                      value={selectedAccount}
                      label="Account"
                      onChange={(e) => setSelectedAccount(e.target.value)}
                    >
                      <MenuItem value="">All Accounts</MenuItem>
                      {accounts?.map((account) => (
                        <MenuItem key={account.id} value={account.id}>
                          {account.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={handleRefreshAll}
                      sx={{ flex: 1 }}
                    >
                      Refresh Data
                    </Button>
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={retrainingModels ? <CircularProgress size={16} /> : <Assessment />}
                      onClick={handleRetrainModels}
                      disabled={retrainingModels}
                      sx={{ flex: 1 }}
                    >
                      {retrainingModels ? 'Retraining...' : 'Retrain AI'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Summary Cards */}
        {transactionSummary && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Income
                  </Typography>
                  <Typography variant="h4" component="div" color="success.main">
                    {formatCurrency(transactionSummary.total_income || 0)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {transactionSummary.income_transactions || 0} transactions
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
                    {formatCurrency(transactionSummary.total_expenses || 0)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {transactionSummary.expense_transactions || 0} transactions
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
                    color={(transactionSummary.total_income - transactionSummary.total_expenses) >= 0 ? 'success.main' : 'error.main'}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    {(transactionSummary.total_income - transactionSummary.total_expenses) >= 0 ? <TrendingUp /> : <TrendingDown />}
                    {formatCurrency(Math.abs(transactionSummary.total_income - transactionSummary.total_expenses))}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {(transactionSummary.total_income - transactionSummary.total_expenses) >= 0 ? 'Surplus' : 'Deficit'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Transactions
                  </Typography>
                  <Typography variant="h4" component="div">
                    {transactionSummary.total_transactions || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Avg: {formatCurrency(transactionSummary.average_transaction_amount || 0)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {/* Category Breakdown */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PieChart />
                Top Categories
              </Typography>
              {categoryLoading ? (
                <CircularProgress />
              ) : (
                <List>
                  {categoryData?.slice(0, 5).map((category: any, index: number) => (
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
                        secondary={`${category.transaction_count} transactions`}
                      />
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body1" fontWeight="bold">
                          {formatCurrency(category.total_amount)}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Avg: {formatCurrency(category.average_amount)}
                        </Typography>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Payee Breakdown */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Payment />
                Top Payees
              </Typography>
              {payeeLoading ? (
                <CircularProgress />
              ) : (
                <List>
                  {payeeData?.slice(0, 5).map((payee: any, index: number) => (
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
                        secondary={`${payee.transaction_count} transactions`}
                      />
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body1" fontWeight="bold">
                          {formatCurrency(payee.total_amount)}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Avg: {formatCurrency(payee.average_amount)}
                        </Typography>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Trends */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Timeline />
                Monthly Trends
              </Typography>
              {trendLoading ? (
                <CircularProgress />
              ) : (
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
                      {monthlyTrend?.slice(-6).map((month: any) => (
                        <TableRow key={month.month}>
                          <TableCell>
                            <Typography variant="body2">
                              {month.month_name} {month.year}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>
                            {formatCurrency(month.income)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'error.main' }}>
                            {formatCurrency(month.expense)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: month.net_income >= 0 ? 'success.main' : 'error.main' }}>
                            {formatCurrency(month.net_income)}
                          </TableCell>
                          <TableCell align="right">
                            {month.transaction_count}
                          </TableCell>
                          <TableCell align="center">
                            {month.net_income >= 0 ?
                              <CheckCircle color="success" fontSize="small" /> :
                              <ErrorOutline color="error" fontSize="small" />
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Categories Tab Component
  const CategoriesTab = () => {
    if (categoryLoading) return <CircularProgress />;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CategoryIcon color="primary" />
            Category Analysis - Historical Data
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Comprehensive analysis using all historical transaction data for accurate insights
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Category Breakdown ({categoryData?.length || 0} categories)
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Total Amount</TableCell>
                      <TableCell align="right">Income</TableCell>
                      <TableCell align="right">Expenses</TableCell>
                      <TableCell align="right">Transactions</TableCell>
                      <TableCell align="right">Average</TableCell>
                      <TableCell align="center">Trend</TableCell>
                      <TableCell align="right">Active Months</TableCell>
                      <TableCell align="right">Peak Month</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categoryData?.map((category: any) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                backgroundColor: category.color,
                              }}
                            />
                            {category.name}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body1" fontWeight="bold">
                            {formatCurrency(category.total_amount)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>
                          {formatCurrency(category.income)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>
                          {formatCurrency(category.expense)}
                        </TableCell>
                        <TableCell align="right">
                          {category.transaction_count}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(category.average_amount)}
                        </TableCell>
                        <TableCell align="center">
                          {category.trend ? getTrendIcon(category.trend) :
                            <ShowChart color="disabled" />
                          }
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {category.active_months || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {category.peak_month || '-'}
                          </Typography>
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

  // Payees Tab Component
  const PayeesTab = () => {
    if (payeeLoading) return <CircularProgress />;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Payment color="primary" />
            Payee Analysis
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payee Breakdown ({payeeData?.length || 0} payees)
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Payee</TableCell>
                      <TableCell align="right">Total Amount</TableCell>
                      <TableCell align="right">Income</TableCell>
                      <TableCell align="right">Expenses</TableCell>
                      <TableCell align="right">Transactions</TableCell>
                      <TableCell align="right">Average</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payeeData?.map((payee: any) => (
                      <TableRow key={payee.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                backgroundColor: payee.color,
                              }}
                            />
                            {payee.name}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body1" fontWeight="bold">
                            {formatCurrency(payee.total_amount)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>
                          {formatCurrency(payee.income)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>
                          {formatCurrency(payee.expense)}
                        </TableCell>
                        <TableCell align="right">
                          {payee.transaction_count}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(payee.average_amount)}
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

  // Accounts Tab Component
  const AccountsTab = () => {
    if (accountLoading) return <CircularProgress />;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBox color="primary" />
            Account Analysis
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Activity ({accountData?.length || 0} accounts)
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Account</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Income</TableCell>
                      <TableCell align="right">Expenses</TableCell>
                      <TableCell align="right">Transfers In</TableCell>
                      <TableCell align="right">Transfers Out</TableCell>
                      <TableCell align="right">Transactions</TableCell>
                      <TableCell align="right">Average</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {accountData?.map((account: any) => (
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
                        <TableCell align="right" sx={{ color: 'success.main' }}>
                          {formatCurrency(account.income)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>
                          {formatCurrency(account.expense)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'info.main' }}>
                          {formatCurrency(account.transfers_in)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'warning.main' }}>
                          {formatCurrency(account.transfers_out)}
                        </TableCell>
                        <TableCell align="right">
                          {account.transaction_count}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(account.average_amount)}
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

  // Comprehensive Insights Tab Component
  const ComprehensiveInsightsTab = () => {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment color="primary" />
            Comprehensive Historical Analysis
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Advanced insights based on complete historical data with prediction models
          </Typography>
        </Grid>

        {/* Comprehensive Analysis */}
        {comprehensiveLoading ? (
          <Grid item xs={12}>
            <CircularProgress />
          </Grid>
        ) : comprehensiveAnalysis ? (
          <>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Financial Overview
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Total Periods
                      </Typography>
                      <Typography variant="h6">
                        {comprehensiveAnalysis.summary?.total_months || 0} months
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Data Range
                      </Typography>
                      <Typography variant="body1">
                        {comprehensiveAnalysis.summary?.date_range?.start ?
                          formatDate(comprehensiveAnalysis.summary.date_range.start) : 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Average Monthly Expense
                      </Typography>
                      <Typography variant="h6" color="error">
                        {formatCurrency(comprehensiveAnalysis.summary?.avg_monthly_expense || 0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Spending Volatility
                      </Typography>
                      <Typography variant="h6">
                        {comprehensiveAnalysis.summary?.expense_volatility ?
                          `${Math.round(comprehensiveAnalysis.summary.expense_volatility * 100)}%` : 'N/A'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Spending Patterns
                  </Typography>
                  {comprehensiveAnalysis.insights?.top_categories?.slice(0, 5).map((category: any, index: number) => (
                    <Box key={index} sx={{ mb: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">{category.name}</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(category.total_amount)}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(category.total_amount / comprehensiveAnalysis.insights?.top_categories[0]?.total_amount) * 100}
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </>
        ) : null}

        {/* Prediction Insights */}
        {predictionInsightsLoading ? (
          <Grid item xs={12}>
            <CircularProgress />
          </Grid>
        ) : predictionInsights ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  AI Predictions (Next 6 Months)
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="textSecondary">
                      Predicted Monthly Expense
                    </Typography>
                    <Typography variant="h5" color="warning.main">
                      {formatCurrency(predictionInsights.summary?.avg_predicted_expense || 0)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="textSecondary">
                      Model Accuracy
                    </Typography>
                    <Typography variant="h5" color="primary">
                      {predictionInsights.summary?.model_accuracy ?
                        `${Math.round(predictionInsights.summary.model_accuracy * 100)}%` : 'Training...'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="textSecondary">
                      Trend Direction
                    </Typography>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {predictionInsights.summary?.trend_direction === 'increasing' && (
                        <>
                          <TrendingUp color="error" />
                          Increasing
                        </>
                      )}
                      {predictionInsights.summary?.trend_direction === 'decreasing' && (
                        <>
                          <TrendingDown color="success" />
                          Decreasing
                        </>
                      )}
                      {predictionInsights.summary?.trend_direction === 'stable' && (
                        <>
                          <ShowChart color="primary" />
                          Stable
                        </>
                      )}
                    </Typography>
                  </Grid>
                </Grid>

                {predictionInsights.recommendations?.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      AI Recommendations
                    </Typography>
                    {predictionInsights.recommendations.map((rec: any, index: number) => (
                      <Alert key={index} severity="info" sx={{ mb: 1 }}>
                        💡 {rec.message}
                      </Alert>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ) : null}
      </Grid>
    );
  };

  // AI Insights Tab Component
  const AIInsightsTab = () => {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InsightsIcon color="primary" />
            AI-Powered Insights (Legacy)
          </Typography>
        </Grid>

        {/* Spending Predictions */}
        {predictionsLoading ? (
          <Grid item xs={12}>
            <CircularProgress />
          </Grid>
        ) : predictions ? (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Spending Predictions
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Next month forecast: {formatCurrency(
                    predictions.predictions
                      .filter((p: any) => p.month === new Date().getMonth() + 2)
                      .reduce((sum: number, p: any) => sum + p.predicted_amount, 0)
                  )}
                </Typography>
                <List dense>
                  {predictions.predictions.slice(0, 5).map((prediction: any, index: number) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={`${prediction.category_name}: ${formatCurrency(prediction.predicted_amount)}`}
                        secondary={`${prediction.month_name} ${prediction.year} - ${Math.round(prediction.confidence * 100)}% confidence`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        ) : null}

        {/* Anomaly Detection */}
        {anomaliesLoading ? (
          <Grid item xs={12}>
            <CircularProgress />
          </Grid>
        ) : anomalies ? (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Spending Anomalies
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {anomalies.summary.total_anomalies} anomalies detected
                </Typography>
                {anomalies.anomalies.length === 0 ? (
                  <Alert severity="success">
                    No spending anomalies detected!
                  </Alert>
                ) : (
                  <List dense>
                    {anomalies.anomalies.slice(0, 3).map((anomaly: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          {anomaly.severity === 'high' && <ErrorOutline color="error" />}
                          {anomaly.severity === 'medium' && <Warning color="warning" />}
                          {anomaly.severity === 'low' && <InfoOutlined color="info" />}
                        </ListItemIcon>
                        <ListItemText
                          primary={anomaly.description || `${anomaly.type} detected`}
                          secondary={anomaly.amount ? `Amount: ${formatCurrency(anomaly.amount)}` : ''}
                        />
                        <Chip
                          label={anomaly.severity.toUpperCase()}
                          size="small"
                          color={getSeverityColor(anomaly.severity)}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        ) : null}

        {/* Budget Recommendations */}
        {budgetLoading ? (
          <Grid item xs={12}>
            <CircularProgress />
          </Grid>
        ) : budgetRecs ? (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Budget Recommendations
                </Typography>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="body2" color="textSecondary">
                      Recommended Budget
                    </Typography>
                    <Typography variant="h5" color="primary">
                      {formatCurrency(budgetRecs.summary.total_recommended_budget)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="body2" color="textSecondary">
                      Savings Rate
                    </Typography>
                    <Typography variant="h5" color="success.main">
                      {Math.round(budgetRecs.summary.recommended_savings_rate * 100)}%
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="body2" color="textSecondary">
                      Budget Health
                    </Typography>
                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                      {budgetRecs.summary.budget_feasibility.replace('_', ' ')}
                    </Typography>
                  </Grid>
                </Grid>

                {budgetRecs.insights.best_savings_opportunity && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    💡 <strong>Best savings opportunity:</strong> {budgetRecs.insights.best_savings_opportunity}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        ) : null}
      </Grid>
    );
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InsightsIcon />
          Financial Insights
        </Typography>
        <Tooltip title="Comprehensive financial analysis with real-time data updates">
          <IconButton>
            <InfoOutlined />
          </IconButton>
        </Tooltip>
      </Box>

      <Paper>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="insights tabs">
          <Tab label="Overview" icon={<Assessment />} />
          <Tab label="Categories" icon={<CategoryIcon />} />
          <Tab label="Payees" icon={<Payment />} />
          <Tab label="Accounts" icon={<AccountBox />} />
          <Tab label="Comprehensive" icon={<BarChart />} />
          <Tab label="AI Insights" icon={<InsightsIcon />} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <OverviewTab />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <CategoriesTab />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <PayeesTab />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <AccountsTab />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <ComprehensiveInsightsTab />
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <AIInsightsTab />
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default Insights;
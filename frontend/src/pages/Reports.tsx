import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { MultiValue } from 'react-select';
import { reportsApi, accountsApi, categoriesApi, payeesApi } from '../services/api';
import MultiSelectDropdown, { Option } from '../components/MultiSelectDropdown';
import { formatCurrency } from '../utils/formatters';
import { useUserInteractionNotifications } from '../hooks/useUserInteractionNotifications';
import { useToast } from '../contexts/ToastContext';

const Reports: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<MultiValue<Option>>([]);
  const [selectedCategories, setSelectedCategories] = useState<MultiValue<Option>>([]);
  const [selectedPayees, setSelectedPayees] = useState<MultiValue<Option>>([]);
  
  const toast = useToast();
  const userNotifications = useUserInteractionNotifications();

  // Get filter data
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

  // Build filter parameters
  const getFilterParams = () => ({
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    account_ids: selectedAccounts.map(acc => acc.value),
    category_ids: selectedCategories.map(cat => cat.value),
    payee_ids: selectedPayees.map(payee => payee.value),
  });

  // Reports queries
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['reports', 'summary', getFilterParams()],
    queryFn: () => reportsApi.getSummary(getFilterParams()),
    enabled: false,
  });

  const { data: categoryReport, isLoading: categoryLoading, refetch: refetchCategory } = useQuery({
    queryKey: ['reports', 'category', getFilterParams()],
    queryFn: () => reportsApi.getByCategory(getFilterParams()),
    enabled: false,
  });

  const { data: payeeReport, isLoading: payeeLoading, refetch: refetchPayee } = useQuery({
    queryKey: ['reports', 'payee', getFilterParams()],
    queryFn: () => reportsApi.getByPayee(getFilterParams()),
    enabled: false,
  });

  const { data: accountReport, isLoading: accountLoading, refetch: refetchAccount } = useQuery({
    queryKey: ['reports', 'account', getFilterParams()],
    queryFn: () => reportsApi.getByAccount(getFilterParams()),
    enabled: false,
  });

  const { data: monthlyTrend, isLoading: trendLoading, refetch: refetchTrend } = useQuery({
    queryKey: ['reports', 'trend', getFilterParams()],
    queryFn: () => reportsApi.getMonthlyTrend(getFilterParams()),
    enabled: false,
  });

  // Convert data to options for multi-select
  const accountOptions: Option[] = accounts?.map(acc => ({
    value: acc.id,
    label: acc.name,
  })) || [];

  const categoryOptions: Option[] = categories?.map(cat => ({
    value: cat.id,
    label: cat.name,
    color: cat.color,
  })) || [];

  const payeeOptions: Option[] = payees?.map(payee => ({
    value: payee.id,
    label: payee.name,
  })) || [];

  const handleGenerateReports = async () => {
    toast.showInfo('Generating reports...');
    
    try {
      const results = await Promise.allSettled([
        refetchSummary(),
        refetchCategory(),
        refetchPayee(),
        refetchAccount(),
        refetchTrend(),
      ]);
      
      const successCount = results.filter(result => result.status === 'fulfilled').length;
      const errorCount = results.filter(result => result.status === 'rejected').length;
      
      if (errorCount === 0) {
        toast.showSuccess(`All ${successCount} reports generated successfully!`);
      } else {
        toast.showWarning(`Reports generated: ${successCount} successful, ${errorCount} failed`);
      }
    } catch (error) {
      toast.showError('Failed to generate reports. Please try again.');
    }
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedAccounts([]);
    setSelectedCategories([]);
    setSelectedPayees([]);
    userNotifications.showFiltersCleared();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports
      </Typography>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <MultiSelectDropdown
                label="Accounts"
                options={accountOptions}
                value={selectedAccounts}
                onChange={setSelectedAccounts}
                placeholder="Select accounts to filter by..."
              />
            </Grid>

            <Grid item xs={12}>
              <MultiSelectDropdown
                label="Categories"
                options={categoryOptions}
                value={selectedCategories}
                onChange={setSelectedCategories}
                placeholder="Select categories to filter by..."
              />
            </Grid>

            <Grid item xs={12}>
              <MultiSelectDropdown
                label="Payees"
                options={payeeOptions}
                value={selectedPayees}
                onChange={setSelectedPayees}
                placeholder="Select payees to filter by..."
              />
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" gap={2}>
                <Button
                  variant="contained"
                  onClick={handleGenerateReports}
                  disabled={summaryLoading || categoryLoading || payeeLoading || accountLoading || trendLoading}
                >
                  Generate Reports
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary Report */}
      {summary && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Summary
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">
                    {formatCurrency(summary.total_income)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Income
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="error.main">
                    {formatCurrency(summary.total_expenses)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Expenses
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="info.main">
                    {formatCurrency(summary.total_transfers)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Transfers
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography
                    variant="h4"
                    color={summary.net_income >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(summary.net_income)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Net Income
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        {/* Category Report */}
        {categoryReport && categoryReport.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  By Category
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="right">Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {categoryReport.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Chip
                              label={item.category_name}
                              size="small"
                              sx={{
                                backgroundColor: item.category_color,
                                color: 'white',
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(item.total_amount)}
                          </TableCell>
                          <TableCell align="right">
                            {item.transaction_count}
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

        {/* Payee Report */}
        {payeeReport && payeeReport.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  By Payee
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Payee</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="right">Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payeeReport.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.payee_name}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(item.total_amount)}
                          </TableCell>
                          <TableCell align="right">
                            {item.transaction_count}
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

        {/* Account Report */}
        {accountReport && accountReport.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  By Account
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Account</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="right">Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {accountReport.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.account_name}</TableCell>
                          <TableCell>
                            <Chip
                              label={item.account_type}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(item.total_amount)}
                          </TableCell>
                          <TableCell align="right">
                            {item.transaction_count}
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

        {/* Monthly Trend */}
        {monthlyTrend && monthlyTrend.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Monthly Trend
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Month</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {monthlyTrend.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.month}</TableCell>
                          <TableCell>
                            <Chip
                              label={item.transaction_type}
                              size="small"
                              color={
                                item.transaction_type === 'deposit'
                                  ? 'success'
                                  : item.transaction_type === 'withdrawal'
                                  ? 'error'
                                  : 'info'
                              }
                            />
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(item.total_amount)}
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

      {/* Loading indicator */}
      {(summaryLoading || categoryLoading || payeeLoading || accountLoading || trendLoading) && (
        <Box display="flex" justifyContent="center" mt={3}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
};

export default Reports;
import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  CircularProgress,
  LinearProgress,
  Backdrop,
  Alert,
  Chip,
} from '@mui/material';
import {
  Add, Edit, Delete, Refresh, Calculate, FileDownload, FileUpload,
  AccountBalanceWallet, Savings, CreditCard, Payments, AccountBalance,
  CalendarToday, Loyalty, Percent, TrendingUp,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { accountsApi, transactionsApi, rewardPointsApi } from '../services/api';
import { Account, CreateAccountDto, RewardPointsSummaryItem } from '../types';
import { formatCurrency, formatAccountType } from '../utils/formatters';
import { useCreateWithConfirm, useUpdateWithConfirm, useDeleteWithConfirm } from '../hooks/useApiWithConfirm';

const accountTypes = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
  { value: 'ppf', label: 'PPF (Public Provident Fund)' },
];

// Distinct gradient + accent per account type
interface TypeTheme {
  gradient: string;
  accent: string;
  icon: React.ReactNode;
}

const TYPE_THEME: Record<string, TypeTheme> = {
  checking: {
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    accent: '#4f46e5',
    icon: <AccountBalanceWallet />,
  },
  savings: {
    gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    accent: '#059669',
    icon: <Savings />,
  },
  credit: {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    accent: '#ef4444',
    icon: <CreditCard />,
  },
  cash: {
    gradient: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
    accent: '#0891b2',
    icon: <Payments />,
  },
  ppf: {
    gradient: 'linear-gradient(135deg, #db2777 0%, #ec4899 100%)',
    accent: '#db2777',
    icon: <AccountBalance />,
  },
  investment: {
    gradient: 'linear-gradient(135deg, #6a1b9a 0%, #ba68c8 100%)',
    accent: '#6a1b9a',
    icon: <TrendingUp />,
  },
};

const getTypeTheme = (type: string): TypeTheme => TYPE_THEME[type] ?? TYPE_THEME.checking;

// Bank brand gradients, detected from the account name.
// Colors sourced from official brand palettes (schemecolor.com / brandpalettes.com).
interface BankTheme {
  keywords: string[];
  gradient: string;
  accent: string;
}

const BANK_THEMES: BankTheme[] = [
  { keywords: ['hdfc'], gradient: 'linear-gradient(135deg, #004C8F 0%, #ED232A 100%)', accent: '#004C8F' },
  { keywords: ['icici'], gradient: 'linear-gradient(135deg, #B02A30 0%, #F99D27 100%)', accent: '#B02A30' },
  { keywords: ['axis'], gradient: 'linear-gradient(135deg, #97144D 0%, #EB1165 100%)', accent: '#97144D' },
  { keywords: ['sbi', 'state bank'], gradient: 'linear-gradient(135deg, #292075 0%, #00B5EF 100%)', accent: '#292075' },
  { keywords: ['kotak'], gradient: 'linear-gradient(135deg, #003874 0%, #ED1C24 100%)', accent: '#003874' },
  { keywords: ['idfc'], gradient: 'linear-gradient(135deg, #9C1D26 0%, #D1394A 100%)', accent: '#9C1D26' },
  { keywords: ['american express', 'amex'], gradient: 'linear-gradient(135deg, #006FCF 0%, #00A0DF 100%)', accent: '#006FCF' },
  { keywords: ['citi'], gradient: 'linear-gradient(135deg, #003B7E 0%, #D9261C 100%)', accent: '#003B7E' },
  { keywords: ['hsbc'], gradient: 'linear-gradient(135deg, #DB0011 0%, #FF5A5F 100%)', accent: '#DB0011' },
  { keywords: ['indusind'], gradient: 'linear-gradient(135deg, #8A2432 0%, #A4123F 100%)', accent: '#8A2432' },
  { keywords: ['yes bank'], gradient: 'linear-gradient(135deg, #00518F 0%, #ED1C24 100%)', accent: '#00518F' },
  { keywords: ['au small', 'au bank'], gradient: 'linear-gradient(135deg, #5B2D8E 0%, #ED1B2E 100%)', accent: '#5B2D8E' },
  { keywords: ['rbl'], gradient: 'linear-gradient(135deg, #1F2A44 0%, #C8102E 100%)', accent: '#C8102E' },
  { keywords: ['bank of baroda', 'baroda'], gradient: 'linear-gradient(135deg, #E35205 0%, #F37021 100%)', accent: '#E35205' },
  { keywords: ['punjab national', 'pnb'], gradient: 'linear-gradient(135deg, #4C1D6E 0%, #A6093D 100%)', accent: '#4C1D6E' },
  { keywords: ['standard chartered', 'stanchart'], gradient: 'linear-gradient(135deg, #0473EA 0%, #38B449 100%)', accent: '#0473EA' },
  { keywords: ['amazon'], gradient: 'linear-gradient(135deg, #232F3E 0%, #FF9900 100%)', accent: '#FF9900' },
  { keywords: ['onecard', 'one card'], gradient: 'linear-gradient(135deg, #000000 0%, #434343 100%)', accent: '#1a1a1a' },
  { keywords: ['federal'], gradient: 'linear-gradient(135deg, #00427A 0%, #F9A01B 100%)', accent: '#00427A' },
  { keywords: ['idbi'], gradient: 'linear-gradient(135deg, #006837 0%, #00A651 100%)', accent: '#006837' },
  { keywords: ['canara'], gradient: 'linear-gradient(135deg, #00558C 0%, #F9B000 100%)', accent: '#00558C' },
];

// Resolve the visual theme for a card: bank brand colors (from the account name)
// when recognized, otherwise the account-type gradient. Icon stays type-based.
const getBrandTheme = (account: Account): TypeTheme => {
  const name = account.name.toLowerCase();
  const bank = BANK_THEMES.find((b) => b.keywords.some((k) => name.includes(k)));
  const typeT = getTypeTheme(account.type);
  if (!bank) return typeT;
  return { gradient: bank.gradient, accent: bank.accent, icon: typeT.icon };
};

// Mask an account/card number, keeping the last 4 visible
const maskNumber = (value: string): string => {
  const v = value.trim();
  if (v.length <= 4) return v;
  return `•••• ${v.slice(-4)}`;
};

const Accounts: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateDialogOpen, setRecalculateDialogOpen] = useState(false);
  const [accountToRecalculate, setAccountToRecalculate] = useState<Account | null>(null);
  const [recalculateResult, setRecalculateResult] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const queryClient = useQueryClient();

  // Helper function to calculate credit utilization percentage
  const getCreditUtilization = (balance: number, creditLimit: number) => {
    if (!creditLimit || creditLimit === 0) return 0;
    // For credit cards, positive balance = debt, negative balance = credit balance
    const utilization = Math.max(0, (balance / creditLimit) * 100);
    return Math.min(utilization, 100);
  };

  // Helper function to get available credit
  const getAvailableCredit = (balance: number, creditLimit: number) => {
    // For credit cards: available = limit - debt (positive balance)
    // If balance is negative (credit balance), add it to available credit
    return creditLimit - Math.max(0, balance);
  };

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<CreateAccountDto>({
    defaultValues: {
      name: '',
      type: 'checking',
      balance: 0,
      opening_date: new Date().toISOString().split('T')[0],
      account_number: '',
      card_number: '',
      card_expiry_month: undefined,
      card_expiry_year: undefined,
      interest_rate: undefined,
      status: 'active',
    },
  });

  const watchAccountType = watch('type');

  const { data: accounts, isLoading, error, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const { data: rewardSummaryData } = useQuery({
    queryKey: ['rewardPointsSummary'],
    queryFn: rewardPointsApi.getSummary,
  });

  const rewardSummaryMap = React.useMemo(() => {
    const map: Record<string, RewardPointsSummaryItem> = {};
    rewardSummaryData?.items?.forEach(item => { map[item.account_id] = item; });
    return map;
  }, [rewardSummaryData]);

  const createMutation = useCreateWithConfirm(accountsApi.create, {
    resourceName: 'Account',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useUpdateWithConfirm(
    ({ id, data }: { id: string; data: Partial<CreateAccountDto> }) =>
      accountsApi.update(id, data),
    {
      resourceName: 'Account',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        handleCloseDialog();
      },
    }
  );

  const deleteMutation = useDeleteWithConfirm(accountsApi.delete, {
    resourceName: 'Account',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const handleOpenDialog = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      reset({
        name: account.name,
        type: account.type,
        balance: account.balance,
        opening_date: account.opening_date,
        account_number: account.account_number || '',
        card_number: account.card_number || '',
        card_expiry_month: account.card_expiry_month,
        card_expiry_year: account.card_expiry_year,
        credit_limit: account.credit_limit,
        bill_generation_date: account.bill_generation_date,
        payment_due_date: account.payment_due_date,
        interest_rate: account.interest_rate,
        status: account.status || 'active',
      });
    } else {
      setEditingAccount(null);
      reset({
        name: '',
        type: 'checking',
        balance: 0,
        opening_date: new Date().toISOString().split('T')[0],
        account_number: '',
        card_number: '',
        card_expiry_month: undefined,
        card_expiry_year: undefined,
        interest_rate: undefined,
        status: 'active',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAccount(null);
    reset();
  };

  const onSubmit = (data: CreateAccountDto) => {
    // Ensure numeric fields are properly converted
    const submitData = {
      ...data,
      balance: Number(data.balance) || 0,
      account_number: data.account_number || undefined,
      card_number: data.card_number || undefined,
      card_expiry_month: data.card_expiry_month ? Number(data.card_expiry_month) : undefined,
      card_expiry_year: data.card_expiry_year ? Number(data.card_expiry_year) : undefined,
      credit_limit: data.credit_limit ? Number(data.credit_limit) : undefined,
      bill_generation_date: data.bill_generation_date ? Number(data.bill_generation_date) : undefined,
      payment_due_date: data.payment_due_date ? Number(data.payment_due_date) : undefined,
      interest_rate: data.interest_rate ? Number(data.interest_rate) : undefined,
    };


    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (account: Account) => {
    if (window.confirm(`Are you sure you want to delete the account "${account.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(account.id);
    }
  };

  const handleRecalculateBalances = (account: Account) => {
    setAccountToRecalculate(account);
    setRecalculateDialogOpen(true);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Recalculate balances for all accounts first
      await accountsApi.recalculateBalances();
      
      // Then refresh accounts data
      await refetch();
      
      // Also invalidate related queries for a comprehensive refresh
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error) {
      console.error('Failed to refresh accounts:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConfirmRecalculate = async () => {
    if (!accountToRecalculate) return;
    
    setRecalculateDialogOpen(false);
    setIsRecalculating(true);
    setRecalculateResult(null);
    
    try {
      const result = await transactionsApi.recalculateAccountBalances(accountToRecalculate.id);
      
      setRecalculateResult({
        success: true,
        message: result.message,
        transactions_updated: result.transactions_updated,
        account_name: result.account_name
      });
      
      // Refresh accounts and transactions data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      
    } catch (error: any) {
      console.error('Failed to recalculate balances:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to recalculate balances';
      setRecalculateResult({
        error: true,
        message: errorMessage
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleExport = async () => {
    if (!accounts || accounts.length === 0) {
      return;
    }

    try {
      const response = await accountsApi.exportToExcel();
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'accounts_export.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error: any) {
      console.error('Export failed:', error);
    }
  };

  const handleImportFile = async (file: File) => {
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await accountsApi.import(formData);
      setImportResult(result);
      
      // Refresh accounts to show new data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      
    } catch (error: any) {
      setImportResult({
        error: true,
        message: error.response?.data?.detail || 'Failed to import accounts'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls,.csv';
    fileInput.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleImportFile(file);
      }
    };
    fileInput.click();
  };

  // A compact label/value row for the card body
  const DetailRow: React.FC<{ icon?: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
      <Box display="flex" alignItems="center" gap={0.75} color="text.secondary" sx={{ minWidth: 0 }}>
        {icon && <Box sx={{ display: 'flex', '& svg': { fontSize: '1rem' } }}>{icon}</Box>}
        <Typography variant="caption" noWrap>{label}</Typography>
      </Box>
      <Typography variant="caption" fontWeight={600} sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {value}
      </Typography>
    </Box>
  );

  const renderAccountCard = (account: Account) => {
    const tt = getBrandTheme(account);
    const balance = Number(account.balance || 0);
    const isCredit = account.type === 'credit';
    const utilization = isCredit && account.credit_limit
      ? getCreditUtilization(balance, account.credit_limit)
      : 0;
    const reward = rewardSummaryMap[account.id];
    const expiry = account.card_expiry_month && account.card_expiry_year
      ? `${String(account.card_expiry_month).padStart(2, '0')}/${String(account.card_expiry_year).slice(-2)}`
      : null;

    return (
      <Grid item xs={12} sm={6} md={4} key={account.id}>
        <Card
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: (theme) =>
                theme.palette.mode === 'light'
                  ? '0 16px 32px -12px rgba(0,0,0,0.18)'
                  : '0 16px 32px -12px rgba(0,0,0,0.6)',
            },
          }}
        >
          {/* Gradient header */}
          <Box
            sx={{
              background: tt.gradient,
              color: '#fff',
              p: 2.5,
              position: 'relative',
              overflow: 'hidden',
              opacity: account.status === 'closed' ? 0.7 : 1,
            }}
          >
            {/* decorative circles */}
            <Box sx={{ position: 'absolute', top: -40, right: -30, width: 130, height: 130, borderRadius: '50%', bgcolor: alpha('#fff', 0.1) }} />
            <Box sx={{ position: 'absolute', bottom: -50, right: 20, width: 90, height: 90, borderRadius: '50%', bgcolor: alpha('#fff', 0.08) }} />

            <Box position="relative">
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box display="flex" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 40, height: 40, borderRadius: 2,
                      bgcolor: alpha('#fff', 0.22),
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    {tt.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap title={account.name}>
                      {account.name}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      {formatAccountType(account.type)}
                    </Typography>
                  </Box>
                </Box>
                {account.status !== 'active' && (
                  <Chip
                    label={account.status === 'closed' ? 'Closed' : 'Inactive'}
                    size="small"
                    sx={{
                      height: 20, fontSize: '0.65rem', fontWeight: 700, color: '#fff',
                      bgcolor: alpha('#000', 0.25),
                    }}
                  />
                )}
              </Box>

              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                {isCredit && balance > 0 ? 'Outstanding' : 'Balance'}
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {isCredit && balance > 0 ? `${formatCurrency(balance)}` : formatCurrency(balance)}
              </Typography>

              {(account.card_number || expiry) && (
                <Box display="flex" justifyContent="space-between" alignItems="center" mt={1.5} sx={{ opacity: 0.95 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                    {account.card_number ? maskNumber(account.card_number) : ''}
                  </Typography>
                  {expiry && (
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Exp {expiry}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Box>

          {/* Body — all account info */}
          <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1, p: 2.5 }}>
            <DetailRow
              icon={<CalendarToday />}
              label="Opened"
              value={new Date(account.opening_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            />
            {account.account_number && (
              <DetailRow label="Account No." value={<span style={{ fontFamily: 'monospace' }}>{maskNumber(account.account_number)}</span>} />
            )}

            {isCredit && account.credit_limit && (
              <>
                <DetailRow icon={<CreditCard />} label="Credit Limit" value={formatCurrency(account.credit_limit)} />
                <DetailRow label="Available" value={formatCurrency(getAvailableCredit(balance, account.credit_limit))} />
                <Box mt={0.5}>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="caption" color="text.secondary">Utilization</Typography>
                    <Typography variant="caption" fontWeight={600}>{utilization.toFixed(1)}%</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={utilization}
                    color={utilization > 90 ? 'error' : utilization > 70 ? 'warning' : 'primary'}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
              </>
            )}

            {isCredit && account.bill_generation_date && (
              <DetailRow icon={<CalendarToday />} label="Bill Date" value={`${account.bill_generation_date}th`} />
            )}
            {isCredit && account.payment_due_date && (
              <DetailRow label="Payment Due" value={`${account.payment_due_date}th`} />
            )}

            {account.type === 'ppf' && account.interest_rate && (
              <DetailRow icon={<Percent />} label="Interest Rate" value={`${account.interest_rate}% p.a.`} />
            )}

            {isCredit && reward && (
              <Box mt={1} pt={1.5} sx={{ borderTop: 1, borderColor: 'divider' }}>
                <Box display="flex" alignItems="center" gap={0.75} mb={1}>
                  <Loyalty sx={{ fontSize: '1rem', color: tt.accent }} />
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    Reward Points
                  </Typography>
                </Box>
                <Box display="flex" gap={0.5} flexWrap="wrap">
                  <Chip label={`Earned ${reward.total_earned.toLocaleString()}`} size="small" color="success" variant="outlined" />
                  <Chip label={`Redeemed ${reward.total_redeemed.toLocaleString()}`} size="small" color="warning" variant="outlined" />
                  <Chip label={`Available ${reward.net_available.toLocaleString()}`} size="small" color="primary" />
                </Box>
              </Box>
            )}

            {/* Actions */}
            <Box display="flex" justifyContent="flex-end" gap={0.5} mt="auto" pt={1.5}>
              <IconButton size="small" onClick={() => handleOpenDialog(account)} title="Edit">
                <Edit fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleRecalculateBalances(account)}
                disabled={isRecalculating}
                title="Recalculate balances"
              >
                {isRecalculating ? <CircularProgress size={16} /> : <Calculate fontSize="small" />}
              </IconButton>
              <IconButton size="small" onClick={() => handleDelete(account)} color="error" title="Delete">
                <Delete fontSize="small" />
              </IconButton>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  if (isLoading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Accounts</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            disabled
          >
            Add Account
          </Button>
        </Box>
        
        <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="400px">
          <CircularProgress size={48} />
          <Typography variant="h6" mt={2} color="textSecondary">
            Loading accounts...
          </Typography>
          <Typography variant="body2" color="textSecondary" mt={1}>
            Fetching your account data
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Accounts</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            Add Account
          </Button>
        </Box>
        
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? 'Retrying...' : 'Retry'}
            </Button>
          }
        >
          Failed to load accounts. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Accounts</Typography>
          <Typography variant="body2" color="text.secondary">
            {accounts?.length ?? 0} account{(accounts?.length ?? 0) === 1 ? '' : 's'} · all balances and details
          </Typography>
        </Box>
        <Box display="flex" gap={1} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<FileUpload />}
            onClick={handleImport}
            disabled={isImporting || isRecalculating}
            color="primary"
          >
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={handleExport}
            disabled={!accounts || accounts.length === 0 || isRecalculating}
            color="primary"
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={isRecalculating || isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            disabled={isRecalculating}
          >
            Add Account
          </Button>
        </Box>
      </Box>

      {/* Import Results */}
      {importResult && (
        <Alert 
          severity={importResult.error ? 'error' : 'success'}
          onClose={() => setImportResult(null)}
          sx={{ mb: 2 }}
        >
          {importResult.error ? (
            importResult.message
          ) : (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {importResult.message}
              </Typography>
              <Typography variant="body2">
                • Total rows processed: {importResult.total_rows}
              </Typography>
              <Typography variant="body2">
                • New accounts created: {importResult.created_count}
              </Typography>
              <Typography variant="body2">
                • Existing accounts updated: {importResult.updated_count}
              </Typography>
              <Typography variant="body2">
                • Accounts skipped (no changes): {importResult.skipped_count}
              </Typography>
              {importResult.error_count > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="error">
                    • Errors encountered: {importResult.error_count}
                  </Typography>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <Box sx={{ ml: 2 }}>
                      {importResult.errors.map((error: string, index: number) => (
                        <Typography key={index} variant="body2" color="error">
                          {error}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Alert>
      )}

      {/* Group accounts by type */}
      {(() => {
        const sortedAccounts = accounts?.sort((a, b) => a.name.localeCompare(b.name)) || [];
        const groupedAccounts: { [key: string]: Account[] } = {};
        
        sortedAccounts.forEach((account) => {
          if (!groupedAccounts[account.type]) {
            groupedAccounts[account.type] = [];
          }
          groupedAccounts[account.type].push(account);
        });

        // Define order of account types
        const typeOrder = ['checking', 'savings', 'credit', 'cash', 'investment', 'ppf'];
        
        return typeOrder.map((type) => {
          const accountsOfType = groupedAccounts[type];
          if (!accountsOfType || accountsOfType.length === 0) return null;

          const tt = getTypeTheme(type);

          return (
            <Box key={type} mb={4}>
              <Box display="flex" alignItems="center" gap={1.25} sx={{ mb: 2 }}>
                <Box
                  sx={{
                    width: 32, height: 32, borderRadius: 1.5,
                    background: tt.gradient,
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    '& svg': { fontSize: '1.1rem' },
                  }}
                >
                  {tt.icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {formatAccountType(type)}
                </Typography>
                <Chip
                  label={accountsOfType.length}
                  size="small"
                  sx={{ height: 20, fontWeight: 700, bgcolor: alpha(tt.accent, 0.12), color: tt.accent }}
                />
              </Box>
              <Grid container spacing={3}>
                {accountsOfType.map((account) => renderAccountCard(account))}
              </Grid>
            </Box>
          );
        });
      })()}

      {/* Calculation Overlay */}
      <Backdrop
        sx={{ 
          color: '#fff', 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'rgba(0, 0, 0, 0.3)'
        }}
        open={isRecalculating && !isLoading}
      >
        <Box display="flex" flexDirection="column" alignItems="center">
          <CircularProgress color="inherit" size={48} />
          <Typography variant="h6" mt={2}>
            Recalculating balances...
          </Typography>
          <Typography variant="body2" mt={1} textAlign="center">
            Processing transactions to ensure accurate account balances
          </Typography>
        </Box>
      </Backdrop>

      {/* Account Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingAccount ? 'Edit Account' : 'Add Account'}
          </DialogTitle>
          <DialogContent>
            <Controller
              name="name"
              control={control}
              rules={{ required: 'Account name is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Account Name"
                  fullWidth
                  margin="normal"
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              )}
            />

            <Controller
              name="type"
              control={control}
              rules={{ required: 'Account type is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Account Type"
                  fullWidth
                  margin="normal"
                  error={!!errors.type}
                  helperText={errors.type?.message}
                >
                  {accountTypes.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="balance"
              control={control}
              rules={{ required: 'Balance is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Initial Balance"
                  type="number"
                  fullWidth
                  margin="normal"
                  error={!!errors.balance}
                  helperText={errors.balance?.message}
                />
              )}
            />

            <Controller
              name="opening_date"
              control={control}
              rules={{ required: 'Opening date is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Opening Date"
                  type="date"
                  fullWidth
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                  error={!!errors.opening_date}
                  helperText={errors.opening_date?.message}
                />
              )}
            />

            <Controller
              name="account_number"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Account Number"
                  fullWidth
                  margin="normal"
                  helperText="Bank account number (optional)"
                />
              )}
            />

            {(watchAccountType === 'checking' || watchAccountType === 'savings' || watchAccountType === 'credit') && (
              <>
                <Controller
                  name="card_number"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Card Number (Last 4 digits)"
                      fullWidth
                      margin="normal"
                      inputProps={{ maxLength: 4, pattern: '[0-9]*' }}
                      helperText="Only enter last 4 digits for security"
                    />
                  )}
                />

                <Box display="flex" gap={2}>
                  <Controller
                    name="card_expiry_month"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Expiry Month"
                        type="number"
                        fullWidth
                        margin="normal"
                        inputProps={{ min: 1, max: 12 }}
                        helperText="MM (1-12)"
                      />
                    )}
                  />

                  <Controller
                    name="card_expiry_year"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Expiry Year"
                        type="number"
                        fullWidth
                        margin="normal"
                        inputProps={{ min: new Date().getFullYear(), max: new Date().getFullYear() + 20 }}
                        helperText="YYYY"
                      />
                    )}
                  />
                </Box>
              </>
            )}

            {watchAccountType === 'credit' && (
              <>
                <Controller
                  name="credit_limit"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Credit Limit"
                      type="number"
                      fullWidth
                      margin="normal"
                    />
                  )}
                />

                <Controller
                  name="bill_generation_date"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Bill Generation Date (Day of Month)"
                      type="number"
                      fullWidth
                      margin="normal"
                      inputProps={{ min: 1, max: 31 }}
                    />
                  )}
                />

                <Controller
                  name="payment_due_date"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Payment Due Date (Day of Month)"
                      type="number"
                      fullWidth
                      margin="normal"
                      inputProps={{ min: 1, max: 31 }}
                      helperText="Enter day of month (1-31)"
                    />
                  )}
                />
              </>
            )}

            {watchAccountType === 'ppf' && (
              <Controller
                name="interest_rate"
                control={control}
                rules={{ 
                  required: 'Interest rate is required for PPF accounts',
                  min: { value: 0.1, message: 'Interest rate must be greater than 0' },
                  max: { value: 50, message: 'Interest rate cannot exceed 50%' }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Annual Interest Rate (%)"
                    type="number"
                    fullWidth
                    margin="normal"
                    inputProps={{ 
                      min: 0.1, 
                      max: 50, 
                      step: 0.1 
                    }}
                    helperText="Enter annual interest rate percentage (e.g., 7.1 for 7.1%)"
                    error={!!errors.interest_rate}
                  />
                )}
              />
            )}

            {watchAccountType === 'credit' && (
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Account Status"
                    fullWidth
                    margin="normal"
                    helperText="Set the account status (closed accounts cannot have new transactions)"
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                  </TextField>
                )}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingAccount ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Recalculate Balances Confirmation Dialog */}
      <Dialog open={recalculateDialogOpen} onClose={() => setRecalculateDialogOpen(false)}>
        <DialogTitle>Recalculate Transaction Balances</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Recalculate transaction balances for "{accountToRecalculate?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This will recalculate the balance_after_transaction field for all transactions in this account. 
            This is useful for maintaining data integrity.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecalculateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmRecalculate} 
            color="primary" 
            variant="contained"
            disabled={isRecalculating}
          >
            {isRecalculating ? 'Recalculating...' : 'Recalculate Balances'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recalculate Results */}
      {recalculateResult && (
        <Backdrop open={true} sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
          <Dialog 
            open={true} 
            onClose={() => setRecalculateResult(null)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {recalculateResult.error ? 'Recalculation Failed' : 'Recalculation Complete'}
            </DialogTitle>
            <DialogContent>
              <Alert severity={recalculateResult.error ? 'error' : 'success'} sx={{ mb: 2 }}>
                {recalculateResult.message}
              </Alert>
              {!recalculateResult.error && (
                <Typography variant="body2">
                  Transactions updated: {recalculateResult.transactions_updated}
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRecalculateResult(null)} variant="contained">
                OK
              </Button>
            </DialogActions>
          </Dialog>
        </Backdrop>
      )}
    </Box>
  );
};

export default Accounts;
import React, { useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import { CircularProgress, Box } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ColorModeProvider, useColorMode } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Transactions from './pages/Transactions';
import FilteredTransactions from './pages/FilteredTransactions';
import Payees from './pages/Payees';
import Categories from './pages/Categories';
import Import from './pages/Import';
import Backup from './pages/Backup';
import CategoryReports from './pages/CategoryReports';
import MonthwiseCategoryReport from './pages/MonthwiseCategoryReport';
import RewardPoints from './pages/RewardPoints';
import RewardPointsHistory from './pages/RewardPointsHistory';
import Admin from './pages/Admin';
import { useAppNotifications } from './hooks/useAppNotifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  useAppNotifications();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <ErrorBoundary>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/reports" element={<FilteredTransactions />} />
          <Route path="/reports/by-category" element={<CategoryReports />} />
          <Route path="/reports/monthwise" element={<MonthwiseCategoryReport />} />
          <Route path="/payees" element={<Payees />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/import" element={<Import />} />
          <Route path="/backup" element={<Backup />} />
          <Route path="/reward-points" element={<RewardPoints />} />
          <Route path="/reward-points/history" element={<RewardPointsHistory />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
};

const ThemedApp: React.FC = () => {
  const { mode } = useColorMode();

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: mode === 'light' ? '#4f46e5' : '#818cf8',
            light: mode === 'light' ? '#818cf8' : '#a5b4fc',
            dark: mode === 'light' ? '#3730a3' : '#6366f1',
            contrastText: '#ffffff',
          },
          secondary: {
            main: mode === 'light' ? '#10b981' : '#34d399',
            light: mode === 'light' ? '#34d399' : '#6ee7b7',
            dark: mode === 'light' ? '#059669' : '#10b981',
            contrastText: '#ffffff',
          },
          success: {
            main: '#22c55e',
            light: '#4ade80',
            dark: '#16a34a',
          },
          error: {
            main: '#ef4444',
            light: '#f87171',
            dark: '#dc2626',
          },
          warning: {
            main: '#f59e0b',
            light: '#fbbf24',
            dark: '#d97706',
          },
          info: {
            main: '#3b82f6',
            light: '#60a5fa',
            dark: '#2563eb',
          },
          background: {
            default: mode === 'light' ? '#f8fafc' : '#0f172a',
            paper: mode === 'light' ? '#ffffff' : '#1e293b',
          },
          text: {
            primary: mode === 'light' ? '#0f172a' : '#f1f5f9',
            secondary: mode === 'light' ? '#64748b' : '#94a3b8',
          },
          divider: mode === 'light' ? '#e2e8f0' : '#334155',
        },
        typography: {
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          h1: { fontWeight: 700, letterSpacing: '-0.025em' },
          h2: { fontWeight: 700, letterSpacing: '-0.025em' },
          h3: { fontWeight: 600, letterSpacing: '-0.02em' },
          h4: { fontWeight: 600, letterSpacing: '-0.015em' },
          h5: { fontWeight: 600 },
          h6: { fontWeight: 600 },
          subtitle1: { fontWeight: 500 },
          button: { fontWeight: 600, textTransform: 'none' as const },
        },
        shape: {
          borderRadius: 10,
        },
        shadows: [
          'none',
          '0 1px 2px 0 rgba(0,0,0,0.05)',
          '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
          '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
          '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
          '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
          '0 25px 50px -12px rgba(0,0,0,0.25)',
        ] as any,
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                scrollbarWidth: 'thin',
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: ({ theme }: any) => ({
                borderRadius: 16,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow:
                  theme.palette.mode === 'light'
                    ? '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)'
                    : '0 1px 3px 0 rgba(0,0,0,0.3)',
              }),
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
              },
              contained: ({ theme }: any) => ({
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`,
                },
              }),
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: ({ theme }: any) => ({
                boxShadow: 'none',
                borderBottom: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
              }),
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: ({ theme }: any) => ({
                backgroundColor:
                  theme.palette.mode === 'light' ? '#f8fafc' : '#0f172a',
                borderRight: `1px solid ${theme.palette.divider}`,
              }),
            },
          },
          MuiListItemButton: {
            styleOverrides: {
              root: ({ theme }: any) => ({
                borderRadius: 8,
                margin: '1px 8px',
                width: 'calc(100% - 16px)',
                '&.Mui-selected': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.15),
                  },
                  '& .MuiListItemIcon-root': {
                    color: theme.palette.primary.main,
                  },
                },
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.06),
                },
              }),
            },
          },
          MuiTextField: {
            defaultProps: {
              variant: 'outlined' as const,
            },
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 8,
                },
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                fontWeight: 500,
                fontSize: '0.75rem',
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                borderRadius: 16,
              },
            },
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                borderRadius: 6,
                fontSize: '0.75rem',
                fontWeight: 500,
              },
            },
          },
          MuiTableHead: {
            styleOverrides: {
              root: ({ theme }: any) => ({
                '& .MuiTableCell-head': {
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: theme.palette.text.secondary,
                  backgroundColor:
                    theme.palette.mode === 'light' ? '#f8fafc' : '#0f172a',
                },
              }),
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider>
        <Router>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ColorModeProvider>
          <ThemedApp />
        </ColorModeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

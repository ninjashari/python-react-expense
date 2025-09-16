import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { 
  FileDownload, 
  FileUpload, 
  AccountBalance, 
  Category, 
  Person, 
  Receipt,
  Warning,
  CheckCircle,
  Info
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { accountsApi, categoriesApi, payeesApi, transactionsApi } from '../services/api';

const Backup: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<any>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedImportType, setSelectedImportType] = useState<'accounts' | 'categories' | 'payees' | null>(null);

  // Get data counts for display
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll(),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll(),
  });

  const { data: payees } = useQuery({
    queryKey: ['payees'],
    queryFn: () => payeesApi.getAll(),
  });

  const handleExportAll = async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      const exports = await Promise.allSettled([
        accountsApi.exportToExcel(),
        categoriesApi.exportToExcel(), 
        payeesApi.exportToExcel(),
        transactionsApi.exportToExcel()
      ]);

      const results = {
        accounts: exports[0],
        categories: exports[1],
        payees: exports[2],
        transactions: exports[3]
      };

      // Download each successful export
      let successCount = 0;
      let errorCount = 0;

      Object.entries(results).forEach(([type, result]) => {
        if (result.status === 'fulfilled') {
          const url = window.URL.createObjectURL(new Blob([result.value.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `${type}_export.xlsx`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          successCount++;
        } else {
          errorCount++;
        }
      });

      setExportResult({
        success: true,
        message: `Export completed: ${successCount} files downloaded successfully`,
        successCount,
        errorCount
      });

    } catch (error: any) {
      setExportResult({
        error: true,
        message: error.response?.data?.detail || 'Failed to export data'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSingle = async (type: 'accounts' | 'categories' | 'payees' | 'transactions') => {
    try {
      let response;
      let filename;

      switch (type) {
        case 'accounts':
          response = await accountsApi.exportToExcel();
          filename = 'accounts_export.xlsx';
          break;
        case 'categories':
          response = await categoriesApi.exportToExcel();
          filename = 'categories_export.xlsx';
          break;
        case 'payees':
          response = await payeesApi.exportToExcel();
          filename = 'payees_export.xlsx';
          break;
        case 'transactions':
          response = await transactionsApi.exportToExcel();
          filename = 'transactions_export.xlsx';
          break;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error: any) {
      console.error(`Export ${type} failed:`, error);
    }
  };

  const handleImportClick = (type: 'accounts' | 'categories' | 'payees') => {
    setSelectedImportType(type);
    setImportDialogOpen(true);
  };

  const handleImportFile = (file: File) => {
    if (!selectedImportType) return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls,.csv';
    fileInput.onchange = (e) => {
      const selectedFile = (e.target as HTMLInputElement).files?.[0];
      if (selectedFile) {
        // Redirect to the appropriate page for import
        const pages = {
          accounts: '/accounts',
          categories: '/categories', 
          payees: '/payees'
        };
        window.location.href = pages[selectedImportType];
      }
    };
    fileInput.click();
    setImportDialogOpen(false);
  };

  const dataItems = [
    {
      type: 'accounts' as const,
      title: 'Accounts',
      icon: <AccountBalance />,
      count: accounts?.length || 0,
      description: 'Bank accounts, credit cards, cash, investments'
    },
    {
      type: 'categories' as const,
      title: 'Categories', 
      icon: <Category />,
      count: categories?.length || 0,
      description: 'Transaction categories for organizing expenses'
    },
    {
      type: 'payees' as const,
      title: 'Payees',
      icon: <Person />,
      count: payees?.length || 0,
      description: 'People and organizations you pay or receive money from'
    },
    {
      type: 'transactions' as const,
      title: 'Transactions',
      icon: <Receipt />,
      count: 'All', // We don't load all transactions for performance
      description: 'All your income, expenses, and transfers'
    }
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Data Backup & Restore</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Export Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FileDownload />
                Export Data
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Download your data in Excel format. You can export all data at once or individual data types.
              </Typography>

              <Box mb={3}>
                <Button
                  variant="contained"
                  startIcon={<FileDownload />}
                  onClick={handleExportAll}
                  disabled={isExporting}
                  fullWidth
                  size="large"
                  sx={{ mb: 2 }}
                >
                  {isExporting ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Exporting All Data...
                    </>
                  ) : (
                    'Export All Data'
                  )}
                </Button>
                
                <Typography variant="body2" color="textSecondary" align="center">
                  Downloads separate Excel files for each data type
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Export Individual Data Types:
              </Typography>

              <List dense>
                {dataItems.map((item) => (
                  <ListItem
                    key={item.type}
                    sx={{ px: 0 }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${item.title} (${item.count})`}
                      secondary={item.description}
                    />
                    <Button
                      size="small"
                      onClick={() => handleExportSingle(item.type)}
                      disabled={item.count === 0}
                    >
                      Export
                    </Button>
                  </ListItem>
                ))}
              </List>

              {/* Export Results */}
              {exportResult && (
                <Alert 
                  severity={exportResult.error ? 'error' : 'success'}
                  onClose={() => setExportResult(null)}
                  sx={{ mt: 2 }}
                >
                  {exportResult.message}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Import Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FileUpload />
                Import Data
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Import data from Excel or CSV files. Each data type must be imported separately.
              </Typography>

              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Import Guidelines:</strong>
                  <br />• Use Excel (.xlsx) or CSV files
                  <br />• Required columns: Name (and Type for accounts)
                  <br />• Existing records will be updated if names match
                  <br />• Invalid data will be skipped with error reports
                </Typography>
              </Alert>

              <Typography variant="subtitle2" gutterBottom>
                Import Data Types:
              </Typography>

              <List dense>
                {dataItems.slice(0, 3).map((item) => ( // Exclude transactions from import
                  <ListItem
                    key={item.type}
                    sx={{ px: 0 }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      secondary={item.description}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleImportClick(item.type as 'accounts' | 'categories' | 'payees')}
                    >
                      Import
                    </Button>
                  </ListItem>
                ))}
              </List>

              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Note:</strong> Transaction import is available through the main Import page with advanced features including PDF processing and column mapping.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)}>
        <DialogTitle>
          Import {selectedImportType ? selectedImportType.charAt(0).toUpperCase() + selectedImportType.slice(1) : ''}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            You will be redirected to the {selectedImportType} page where you can upload and import your file with detailed progress tracking and error reporting.
          </Typography>
          <Typography variant="body2">
            Click "Continue" to proceed to the import page.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              const pages = {
                accounts: '/accounts',
                categories: '/categories', 
                payees: '/payees'
              };
              if (selectedImportType) {
                window.location.href = pages[selectedImportType];
              }
            }}
            variant="contained"
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Backup;
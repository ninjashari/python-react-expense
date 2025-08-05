import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
} from '@mui/material';
import { Account } from '../types';

interface ColumnMappings {
  date: string;
  amount: string;
  description: string;
  payee?: string;
  category?: string;
  transactionType?: string;
}

interface ColumnMappingStepProps {
  columns: string[];
  sampleData: any[];
  columnMappings: ColumnMappings;
  accounts: Account[];
  selectedAccount: Account | null;
  defaultTransactionType: string;
  onMappingChange: (mappings: ColumnMappings) => void;
  onAccountChange: (account: Account) => void;
  onTransactionTypeChange: (type: string) => void;
}

const ColumnMappingStep: React.FC<ColumnMappingStepProps> = ({
  columns,
  sampleData,
  columnMappings,
  accounts,
  selectedAccount,
  defaultTransactionType,
  onMappingChange,
  onAccountChange,
  onTransactionTypeChange,
}) => {
  const handleMappingChange = (field: keyof ColumnMappings, value: string) => {
    onMappingChange({
      ...columnMappings,
      [field]: value,
    });
  };

  const isRequiredFieldMapped = () => {
    return columnMappings.date && columnMappings.amount && columnMappings.description;
  };

  const getColumnPreview = (columnName: string) => {
    if (!columnName || sampleData.length === 0) return [];
    return sampleData.slice(0, 3).map(row => row[columnName]).filter(val => val != null);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Map your file columns to transaction fields
      </Typography>
      
      {!isRequiredFieldMapped() && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Please map all required fields (Date, Amount, Description) and select an account to continue.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Account Selection */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Import to Account</InputLabel>
            <Select
              value={selectedAccount?.id || ''}
              label="Import to Account"
              onChange={(e) => {
                const account = accounts.find(a => a.id === e.target.value);
                if (account) onAccountChange(account);
              }}
            >
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Default Transaction Type */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Default Transaction Type</InputLabel>
            <Select
              value={defaultTransactionType}
              label="Default Transaction Type"
              onChange={(e) => onTransactionTypeChange(e.target.value)}
            >
              <MenuItem value="expense">Expense</MenuItem>
              <MenuItem value="income">Income</MenuItem>
              <MenuItem value="transfer">Transfer</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* Required Field Mappings */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Required Fields
          </Typography>
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth required>
            <InputLabel>Date Column</InputLabel>
            <Select
              value={columnMappings.date}
              label="Date Column"
              onChange={(e) => handleMappingChange('date', e.target.value)}
            >
              <MenuItem value="">None</MenuItem>
              {columns.map((column) => (
                <MenuItem key={column} value={column}>
                  {column}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {columnMappings.date && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Sample values:
              </Typography>
              {getColumnPreview(columnMappings.date).map((value, index) => (
                <Chip
                  key={index}
                  label={value?.toString() || 'Empty'}
                  size="small"
                  sx={{ m: 0.5 }}
                />
              ))}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth required>
            <InputLabel>Amount Column</InputLabel>
            <Select
              value={columnMappings.amount}
              label="Amount Column"
              onChange={(e) => handleMappingChange('amount', e.target.value)}
            >
              <MenuItem value="">None</MenuItem>
              {columns.map((column) => (
                <MenuItem key={column} value={column}>
                  {column}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {columnMappings.amount && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Sample values:
              </Typography>
              {getColumnPreview(columnMappings.amount).map((value, index) => (
                <Chip
                  key={index}
                  label={value?.toString() || 'Empty'}
                  size="small"
                  sx={{ m: 0.5 }}
                />
              ))}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth required>
            <InputLabel>Description Column</InputLabel>
            <Select
              value={columnMappings.description}
              label="Description Column"
              onChange={(e) => handleMappingChange('description', e.target.value)}
            >
              <MenuItem value="">None</MenuItem>
              {columns.map((column) => (
                <MenuItem key={column} value={column}>
                  {column}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {columnMappings.description && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Sample values:
              </Typography>
              {getColumnPreview(columnMappings.description).map((value, index) => (
                <Chip
                  key={index}
                  label={value?.toString() || 'Empty'}
                  size="small"
                  sx={{ m: 0.5 }}
                />
              ))}
            </Box>
          )}
        </Grid>

        {/* Optional Field Mappings */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Optional Fields
          </Typography>
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Payee Column</InputLabel>
            <Select
              value={columnMappings.payee || ''}
              label="Payee Column"
              onChange={(e) => handleMappingChange('payee', e.target.value)}
            >
              <MenuItem value="">None</MenuItem>
              {columns.map((column) => (
                <MenuItem key={column} value={column}>
                  {column}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {columnMappings.payee && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Sample values:
              </Typography>
              {getColumnPreview(columnMappings.payee).map((value, index) => (
                <Chip
                  key={index}
                  label={value?.toString() || 'Empty'}
                  size="small"
                  sx={{ m: 0.5 }}
                />
              ))}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Category Column</InputLabel>
            <Select
              value={columnMappings.category || ''}
              label="Category Column"
              onChange={(e) => handleMappingChange('category', e.target.value)}
            >
              <MenuItem value="">None</MenuItem>
              {columns.map((column) => (
                <MenuItem key={column} value={column}>
                  {column}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {columnMappings.category && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Sample values:
              </Typography>
              {getColumnPreview(columnMappings.category).map((value, index) => (
                <Chip
                  key={index}
                  label={value?.toString() || 'Empty'}
                  size="small"
                  sx={{ m: 0.5 }}
                />
              ))}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Transaction Type Column</InputLabel>
            <Select
              value={columnMappings.transactionType || ''}
              label="Transaction Type Column"
              onChange={(e) => handleMappingChange('transactionType', e.target.value)}
            >
              <MenuItem value="">None</MenuItem>
              {columns.map((column) => (
                <MenuItem key={column} value={column}>
                  {column}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {columnMappings.transactionType && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Sample values:
              </Typography>
              {getColumnPreview(columnMappings.transactionType).map((value, index) => (
                <Chip
                  key={index}
                  label={value?.toString() || 'Empty'}
                  size="small"
                  sx={{ m: 0.5 }}
                />
              ))}
            </Box>
          )}
        </Grid>

        {/* Data Preview */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
            Sample Data Preview
          </Typography>
          <Paper>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {columns.map((column) => (
                      <TableCell key={column}>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {column}
                          </Typography>
                          {Object.entries(columnMappings).map(([key, value]) => {
                            if (value === column) {
                              return (
                                <Chip
                                  key={key}
                                  label={key}
                                  size="small"
                                  color="primary"
                                  sx={{ mt: 0.5 }}
                                />
                              );
                            }
                            return null;
                          })}
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sampleData.slice(0, 5).map((row, index) => (
                    <TableRow key={index}>
                      {columns.map((column) => (
                        <TableCell key={column}>
                          {row[column]?.toString() || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ColumnMappingStep;
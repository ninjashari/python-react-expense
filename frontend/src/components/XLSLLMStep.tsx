import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Chip,
  Alert,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { 
  Description,
  TableChart,
  SmartToy,
  Storage,
} from '@mui/icons-material';
import { Account, XLSLLMPreviewResponse } from '../types';

interface XLSLLMStepProps {
  accounts: Account[];
  selectedAccount: Account | null;
  llmModel: string;
  xlsPreview?: XLSLLMPreviewResponse;
  onAccountChange: (account: Account) => void;
  onModelChange: (model: string) => void;
}

const XLSLLMStep: React.FC<XLSLLMStepProps> = ({
  accounts,
  selectedAccount,
  llmModel,
  xlsPreview,
  onAccountChange,
  onModelChange,
}) => {
  const availableModels = ['llama3.1', 'mistral', 'llama3', 'gemma'];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Excel LLM Import Configuration
      </Typography>

      {xlsPreview?.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {xlsPreview.error}
        </Alert>
      )}

      {xlsPreview && !xlsPreview.error && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <TableChart color="primary" />
              <Typography variant="h6">
                Excel File Analysis
              </Typography>
            </Box>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" p={2}>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {xlsPreview.sheet_count}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Sheets
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" p={2}>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {Math.round(xlsPreview.text_length / 1000)}K
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Characters
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" p={2}>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    {xlsPreview.estimated_processing_time}s
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Est. Time
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" p={2}>
                  <Chip 
                    label={xlsPreview.has_financial_data ? "Financial Data Detected" : "No Financial Data"}
                    color={xlsPreview.has_financial_data ? "success" : "warning"}
                    variant="filled"
                  />
                </Box>
              </Grid>
            </Grid>

            {/* File Information Table */}
            {xlsPreview.file_info && xlsPreview.file_info.sheets && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Storage fontSize="small" />
                  Sheet Information
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Sheet Name</TableCell>
                        <TableCell align="right">Rows</TableCell>
                        <TableCell align="right">Columns</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {xlsPreview.file_info.sheets.map((sheet: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell component="th" scope="row">
                            {sheet.name}
                          </TableCell>
                          <TableCell align="right">{sheet.rows || sheet.max_row || 'N/A'}</TableCell>
                          <TableCell align="right">{sheet.columns || sheet.max_column || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Description fontSize="small" />
                Data Preview
              </Typography>
              <Box 
                sx={{ 
                  backgroundColor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'grey.300',
                  borderRadius: 1,
                  p: 2,
                  maxHeight: 200,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {xlsPreview.preview_text}
              </Box>
            </Box>

            <Box mt={2}>
              <Chip 
                icon={<SmartToy />}
                label={`Extraction Method: ${xlsPreview.extraction_method}`}
                variant="outlined"
                size="small"
              />
            </Box>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Target Account</InputLabel>
            <Select
              value={selectedAccount?.id || ''}
              label="Target Account"
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

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>LLM Model</InputLabel>
            <Select
              value={llmModel}
              label="LLM Model"
              onChange={(e) => onModelChange(e.target.value)}
            >
              {availableModels.map((model) => (
                <MenuItem key={model} value={model}>
                  {model} {model === 'llama3.1' && '(Recommended)'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {xlsPreview && xlsPreview.has_financial_data && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>AI Processing:</strong> The LLM will analyze your Excel data to automatically extract transaction information including dates, amounts, descriptions, and transaction types. 
            {xlsPreview.sheet_count > 1 && ` All ${xlsPreview.sheet_count} sheets will be processed.`}
          </Typography>
        </Alert>
      )}

      {xlsPreview && !xlsPreview.has_financial_data && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Warning:</strong> No clear financial transaction patterns were detected in this Excel file. 
            The LLM processing may not yield reliable results. Please ensure your file contains transaction data 
            with dates, amounts, and descriptions.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default XLSLLMStep;
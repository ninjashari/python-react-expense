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
  LinearProgress,
} from '@mui/material';
import { Account, PDFLLMPreviewResponse } from '../types';

interface PDFLLMStepProps {
  accounts: Account[];
  selectedAccount: Account | null;
  llmModel: string;
  pdfPreview?: PDFLLMPreviewResponse;
  onAccountChange: (account: Account) => void;
  onModelChange: (model: string) => void;
}

const PDFLLMStep: React.FC<PDFLLMStepProps> = ({
  accounts,
  selectedAccount,
  llmModel,
  pdfPreview,
  onAccountChange,
  onModelChange,
}) => {
  const availableModels = ['llama3.1', 'mistral', 'llama3', 'gemma'];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        PDF LLM Import Configuration
      </Typography>

      {pdfPreview?.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {pdfPreview.error}
        </Alert>
      )}

      {pdfPreview && !pdfPreview.error && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              PDF Analysis Results
            </Typography>
            
            <Box display="flex" gap={1} mb={2}>
              <Chip 
                label={`Extraction: ${pdfPreview.extraction_method}`}
                color={pdfPreview.extraction_method === 'direct_text' ? 'success' : 'warning'}
                size="small"
              />
              <Chip 
                label={`${pdfPreview.text_length} characters`}
                variant="outlined"
                size="small"
              />
              <Chip 
                label={pdfPreview.has_financial_data ? 'Financial data detected' : 'No financial data'}
                color={pdfPreview.has_financial_data ? 'success' : 'error'}
                size="small"
              />
            </Box>

            {pdfPreview.has_financial_data && (
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Estimated processing time: {pdfPreview.estimated_processing_time} seconds
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min((pdfPreview.text_length / 1000) * 10, 100)}
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>
            )}

            <Typography variant="body2" color="text.secondary" gutterBottom>
              Preview:
            </Typography>
            <Box 
              sx={{ 
                p: 1, 
                bgcolor: 'grey.100', 
                borderRadius: 1, 
                maxHeight: 200, 
                overflow: 'auto',
                fontSize: '0.875rem',
                fontFamily: 'monospace'
              }}
            >
              {pdfPreview.preview_text}
            </Box>
          </CardContent>
        </Card>
      )}

      <Box display="flex" gap={2} mb={3}>
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
            {accounts.sort((a, b) => a.name.localeCompare(b.name)).map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.name} ({account.type})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>LLM Model</InputLabel>
          <Select
            value={llmModel}
            label="LLM Model"
            onChange={(e) => onModelChange(e.target.value)}
          >
            {availableModels.map((model) => (
              <MenuItem key={model} value={model}>
                {model}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {!pdfPreview?.has_financial_data && (
        <Alert severity="warning">
          The PDF does not appear to contain recognizable financial transaction data. 
          The LLM will still attempt to extract transactions, but results may be limited.
        </Alert>
      )}
    </Box>
  );
};

export default PDFLLMStep;
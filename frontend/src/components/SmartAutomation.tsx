import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  LinearProgress,
  IconButton,
  FormControl,
  FormLabel,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
} from '@mui/material';
import {
  AutoFixHigh,
  Psychology as AIIcon,
  Speed as AutoIcon,
  Close,
  PlayArrow,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useAutoCategorization, useBulkProcessing } from '../hooks/useLearning';
import { useToast } from '../contexts/ToastContext';

interface SmartAutomationProps {
  uncategorizedCount?: number;
  selectedTransactionIds?: string[];
  onAutomationComplete?: () => void;
}

const SmartAutomation: React.FC<SmartAutomationProps> = ({
  uncategorizedCount = 0,
  selectedTransactionIds = [],
  onAutomationComplete
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'auto-categorize' | 'bulk-process' | 'duplicate-check'>('auto-categorize');
  const [bulkAction, setBulkAction] = useState<'categorize' | 'duplicate_check' | 'validate'>('categorize');
  const [selectedOptions, setSelectedOptions] = useState({
    autoApplyHighConfidence: true,
    reviewSuggestions: false,
    detectDuplicates: false,
  });

  const queryClient = useQueryClient();
  const autoCategorizeMutation = useAutoCategorization();
  const bulkProcessMutation = useBulkProcessing();
  const toast = useToast();

  const handleAutoCategorize = async () => {
    try {
      const result = await autoCategorizeMutation.mutateAsync();
      
      // Show success message
      toast.showSuccess(`Successfully auto-categorized ${result.categorized_transactions.length} transactions!`);
      
      // Refresh transaction data
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['learning-performance-analytics'] });
      
      if (onAutomationComplete) {
        onAutomationComplete();
      }
      
      setDialogOpen(false);
    } catch (error) {
      console.error('Auto-categorization failed:', error);
    }
  };

  const handleBulkProcess = async () => {
    if (selectedTransactionIds.length === 0) {
      toast.showError('Please select transactions to process');
      return;
    }

    try {
      const result = await bulkProcessMutation.mutateAsync({
        transactionIds: selectedTransactionIds,
        action: bulkAction
      });
      
      toast.showSuccess(`Processed ${result.processed_count} transactions`);
      
      if (onAutomationComplete) {
        onAutomationComplete();
      }
      
      setDialogOpen(false);
    } catch (error) {
      console.error('Bulk processing failed:', error);
    }
  };

  const AutoCategorizeTab = () => (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          Auto-categorize uses AI to automatically assign payees and categories to uncategorized transactions 
          with high confidence (≥60%).
        </Typography>
      </Alert>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <AIIcon color="primary" />
            <Typography variant="h6">Ready for Auto-Categorization</Typography>
          </Box>
          <Typography variant="h4" color="primary.main">
            {uncategorizedCount}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Uncategorized transactions
          </Typography>
        </CardContent>
      </Card>

      <FormControl component="fieldset" sx={{ mb: 3 }}>
        <FormLabel component="legend">Automation Options</FormLabel>
        <FormControlLabel
          control={
            <Checkbox
              checked={selectedOptions.autoApplyHighConfidence}
              onChange={(e) => setSelectedOptions(prev => ({
                ...prev,
                autoApplyHighConfidence: e.target.checked
              }))}
            />
          }
          label="Auto-apply high confidence suggestions (≥60%)"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={selectedOptions.reviewSuggestions}
              onChange={(e) => setSelectedOptions(prev => ({
                ...prev,
                reviewSuggestions: e.target.checked
              }))}
            />
          }
          label="Show suggestions for review before applying"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={selectedOptions.detectDuplicates}
              onChange={(e) => setSelectedOptions(prev => ({
                ...prev,
                detectDuplicates: e.target.checked
              }))}
            />
          }
          label="Check for potential duplicates during processing"
        />
      </FormControl>

      {autoCategorizeMutation.isPending && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Processing transactions with AI...
          </Typography>
        </Box>
      )}

      {autoCategorizeMutation.data && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2">
            ✅ Successfully categorized {autoCategorizeMutation.data.categorized_transactions.length} out of {autoCategorizeMutation.data.total_processed} transactions
          </Typography>
          <List dense>
            {autoCategorizeMutation.data.categorized_transactions.slice(0, 5).map((transaction) => (
              <ListItem key={transaction.transaction_id}>
                <ListItemText
                  primary={transaction.description}
                  secondary={`Confidence: ${(transaction.confidence * 100).toFixed(1)}%`}
                />
                <Chip 
                  label={`${(transaction.confidence * 100).toFixed(0)}%`} 
                  size="small" 
                  color="success" 
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}
    </Box>
  );

  const BulkProcessTab = () => (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          Bulk process selected transactions with AI assistance for categorization and duplicate detection.
        </Typography>
      </Alert>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Selected Transactions</Typography>
          <Typography variant="h4" color="secondary.main">
            {selectedTransactionIds.length}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Transactions ready for processing
          </Typography>
        </CardContent>
      </Card>

      <FormControl component="fieldset" sx={{ mb: 3 }}>
        <FormLabel component="legend">Bulk Action</FormLabel>
        <RadioGroup
          value={bulkAction}
          onChange={(e) => setBulkAction(e.target.value as any)}
        >
          <FormControlLabel
            value="categorize"
            control={<Radio />}
            label="Get AI categorization suggestions"
          />
          <FormControlLabel
            value="duplicate_check"
            control={<Radio />}
            label="Detect potential duplicates"
          />
          <FormControlLabel
            value="validate"
            control={<Radio />}
            label="Validate existing categorizations"
          />
        </RadioGroup>
      </FormControl>

      {bulkProcessMutation.isPending && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Processing {selectedTransactionIds.length} transactions...
          </Typography>
        </Box>
      )}

      {bulkProcessMutation.data && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2">
            ✅ Processed {bulkProcessMutation.data.processed_count} transactions
          </Typography>
          {bulkProcessMutation.data.results.slice(0, 3).map((result, index) => (
            <Box key={result.transaction_id} sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" fontWeight="bold">
                {result.description}
              </Typography>
              {result.suggestions && (
                <Box sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="textSecondary">
                    AI Suggestions: {result.suggestions.payee.length + result.suggestions.category.length} found
                  </Typography>
                </Box>
              )}
              {result.potential_duplicates && (
                <Box sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="warning.main">
                    ⚠️ {result.potential_duplicates.length} potential duplicates found
                  </Typography>
                </Box>
              )}
            </Box>
          ))}
        </Alert>
      )}
    </Box>
  );

  const getTabContent = () => {
    switch (activeTab) {
      case 'auto-categorize':
        return <AutoCategorizeTab />;
      case 'bulk-process':
        return <BulkProcessTab />;
      default:
        return <AutoCategorizeTab />;
    }
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={<AutoFixHigh />}
        onClick={() => setDialogOpen(true)}
        color="secondary"
        sx={{ mr: 1 }}
      >
        Smart Automation
      </Button>

      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoFixHigh color="primary" />
              Smart Automation
            </Box>
            <IconButton onClick={() => setDialogOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* Tab Navigation */}
          <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
            <Button
              variant={activeTab === 'auto-categorize' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<AIIcon />}
              onClick={() => setActiveTab('auto-categorize')}
            >
              Auto-Categorize
            </Button>
            <Button
              variant={activeTab === 'bulk-process' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<AutoIcon />}
              onClick={() => setActiveTab('bulk-process')}
            >
              Bulk Process
            </Button>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {getTabContent()}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          
          {activeTab === 'auto-categorize' && (
            <Button
              variant="contained"
              startIcon={autoCategorizeMutation.isPending ? <CircularProgress size={20} /> : <PlayArrow />}
              onClick={handleAutoCategorize}
              disabled={autoCategorizeMutation.isPending || uncategorizedCount === 0}
            >
              Start Auto-Categorization
            </Button>
          )}
          
          {activeTab === 'bulk-process' && (
            <Button
              variant="contained"
              startIcon={bulkProcessMutation.isPending ? <CircularProgress size={20} /> : <PlayArrow />}
              onClick={handleBulkProcess}
              disabled={bulkProcessMutation.isPending || selectedTransactionIds.length === 0}
            >
              Process Selected
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SmartAutomation;
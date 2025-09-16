import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Autocomplete,
  IconButton,
  Divider,
  Alert,
  Chip,
  CircularProgress
} from '@mui/material';
import { Add, Delete, AccountBalance } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Transaction, TransactionSplit, Category } from '../types';
import { categoriesApi, transactionsApi } from '../services/api';
import { formatCurrency } from '../utils/formatters';

interface SplitTransactionDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
  onSuccess: () => void;
}

interface SplitFormData {
  category_id: string;
  amount: number;
  description?: string;
  category?: Category;
}

const SplitTransactionDialog: React.FC<SplitTransactionDialogProps> = ({
  open,
  onClose,
  transaction,
  onSuccess
}) => {
  const [splits, setSplits] = useState<SplitFormData[]>([
    { category_id: '', amount: 0 },
    { category_id: '', amount: 0 }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  // Get categories for autocomplete
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll(),
  });

  // Check if transaction is already split and load existing splits
  useEffect(() => {
    if (open && transaction) {
      const checkExistingSplits = async () => {
        try {
          const splitsData = await transactionsApi.getTransactionSplits(transaction.id);
          if (splitsData.is_split && splitsData.splits.length > 0) {
            setIsEditingExisting(true);
            setSplits(splitsData.splits.map((split: any) => ({
              category_id: split.category_id,
              amount: split.amount,
              description: split.description || '',
              category: split.category
            })));
          } else {
            setIsEditingExisting(false);
            // Pre-populate with transaction amount for easier splitting
            const halfAmount = transaction.amount / 2;
            setSplits([
              { category_id: '', amount: halfAmount },
              { category_id: '', amount: halfAmount }
            ]);
          }
        } catch (error) {
          console.error('Failed to load existing splits:', error);
          // If fails to load, assume it's not split
          setIsEditingExisting(false);
        }
      };

      checkExistingSplits();
    }
  }, [open, transaction]);

  const addSplit = () => {
    setSplits([...splits, { category_id: '', amount: 0 }]);
  };

  const removeSplit = (index: number) => {
    if (splits.length > 2) {
      setSplits(splits.filter((_, i) => i !== index));
    }
  };

  const updateSplit = (index: number, field: keyof SplitFormData, value: any) => {
    const updatedSplits = [...splits];
    if (field === 'category_id' && value) {
      // Also update category object for display
      const category = categories?.find(cat => cat.id === value);
      updatedSplits[index] = { ...updatedSplits[index], [field]: value, category };
    } else {
      updatedSplits[index] = { ...updatedSplits[index], [field]: value };
    }
    setSplits(updatedSplits);
  };

  const getTotalSplitAmount = () => {
    return splits.reduce((sum, split) => sum + (Number(split.amount) || 0), 0);
  };

  const getAmountDifference = () => {
    return transaction.amount - getTotalSplitAmount();
  };

  const isValidSplit = () => {
    // Check if all splits have categories and positive amounts
    const hasValidSplits = splits.every(split => 
      split.category_id && split.amount > 0
    );
    
    // Check if amounts add up to transaction amount (allow small rounding differences)
    const amountDifference = Math.abs(getAmountDifference());
    const amountsMatch = amountDifference < 0.01;
    
    return hasValidSplits && amountsMatch && splits.length >= 2;
  };

  const handleSubmit = async () => {
    if (!isValidSplit()) {
      setError('Please ensure all splits have categories and amounts that total the transaction amount');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const splitsData = splits.map(split => ({
        category_id: split.category_id,
        amount: split.amount,
        description: split.description || undefined
      }));

      if (isEditingExisting) {
        await transactionsApi.updateTransactionSplits(transaction.id, splitsData);
      } else {
        await transactionsApi.splitTransaction(transaction.id, splitsData);
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to split transaction');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsplit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await transactionsApi.unsplitTransaction(transaction.id);
      onSuccess();
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to unsplit transaction');
    } finally {
      setIsLoading(false);
    }
  };

  const distributeEvenly = () => {
    const evenAmount = transaction.amount / splits.length;
    const updatedSplits = splits.map(split => ({
      ...split,
      amount: evenAmount
    }));
    setSplits(updatedSplits);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <AccountBalance color="primary" />
          {isEditingExisting ? 'Edit Transaction Split' : 'Split Transaction'}
        </Box>
        <Typography variant="body2" color="textSecondary">
          {transaction.description} - {formatCurrency(transaction.amount)}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Category Splits</Typography>
            <Button
              size="small"
              onClick={distributeEvenly}
              variant="outlined"
            >
              Distribute Evenly
            </Button>
          </Box>

          {splits.map((split, index) => (
            <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              <Box display="flex" gap={2} alignItems="flex-start">
                <Autocomplete
                  options={categories || []}
                  getOptionLabel={(option) => option.name}
                  value={categories?.find(cat => cat.id === split.category_id) || null}
                  onChange={(_, value) => updateSplit(index, 'category_id', value?.id || '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Category"
                      size="small"
                      required
                      error={!split.category_id}
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            backgroundColor: option.color,
                            borderRadius: '50%'
                          }}
                        />
                        {option.name}
                      </Box>
                    </li>
                  )}
                  sx={{ flex: 1 }}
                />

                <TextField
                  label="Amount"
                  type="number"
                  size="small"
                  value={split.amount || ''}
                  onChange={(e) => updateSplit(index, 'amount', Number(e.target.value))}
                  inputProps={{
                    step: 0.01,
                    min: 0.01
                  }}
                  required
                  error={!split.amount || split.amount <= 0}
                  sx={{ width: 120 }}
                />

                <TextField
                  label="Description (Optional)"
                  size="small"
                  value={split.description || ''}
                  onChange={(e) => updateSplit(index, 'description', e.target.value)}
                  sx={{ flex: 0.7 }}
                />

                <IconButton
                  onClick={() => removeSplit(index)}
                  disabled={splits.length <= 2}
                  color="error"
                  size="small"
                >
                  <Delete />
                </IconButton>
              </Box>

              {split.category && (
                <Chip
                  label={split.category.name}
                  size="small"
                  sx={{
                    mt: 1,
                    backgroundColor: split.category.color,
                    color: 'white'
                  }}
                />
              )}
            </Box>
          ))}

          <Button
            startIcon={<Add />}
            onClick={addSplit}
            variant="outlined"
            size="small"
          >
            Add Split
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>Split Summary</Typography>
          
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2">Transaction Amount:</Typography>
            <Typography variant="body2" fontWeight="bold">
              {formatCurrency(transaction.amount)}
            </Typography>
          </Box>
          
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2">Total Splits:</Typography>
            <Typography variant="body2">
              {formatCurrency(getTotalSplitAmount())}
            </Typography>
          </Box>
          
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2">Difference:</Typography>
            <Typography 
              variant="body2" 
              color={Math.abs(getAmountDifference()) < 0.01 ? 'success.main' : 'error.main'}
              fontWeight="bold"
            >
              {formatCurrency(getAmountDifference())}
            </Typography>
          </Box>

          {Math.abs(getAmountDifference()) >= 0.01 && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Split amounts must equal the transaction amount
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        
        {isEditingExisting && (
          <Button
            onClick={handleUnsplit}
            disabled={isLoading}
            color="error"
            variant="outlined"
          >
            Remove Split
          </Button>
        )}
        
        <Button
          onClick={handleSubmit}
          disabled={!isValidSplit() || isLoading}
          variant="contained"
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
        >
          {isLoading 
            ? 'Processing...' 
            : isEditingExisting 
              ? 'Update Split' 
              : 'Split Transaction'
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SplitTransactionDialog;
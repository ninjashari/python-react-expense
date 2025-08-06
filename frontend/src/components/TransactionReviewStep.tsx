import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Edit,
  Delete,
  Add,
  ExpandMore,
  CheckCircle,
  Warning,
  Info,
} from '@mui/icons-material';
import { LLMTransactionData, Account } from '../types';
import { formatCurrency } from '../utils/formatters';

interface TransactionReviewStepProps {
  transactions: LLMTransactionData[];
  account: Account;
  onTransactionsChange: (transactions: LLMTransactionData[]) => void;
  onConfirm: () => void;
  extractionMethod: string;
  processingNotes: string[];
}

interface EditTransactionDialogProps {
  open: boolean;
  transaction: LLMTransactionData | null;
  onSave: (transaction: LLMTransactionData) => void;
  onClose: () => void;
}

const EditTransactionDialog: React.FC<EditTransactionDialogProps> = ({
  open,
  transaction,
  onSave,
  onClose,
}) => {
  const [editedTransaction, setEditedTransaction] = useState<LLMTransactionData | null>(null);

  useEffect(() => {
    if (transaction) {
      setEditedTransaction({ ...transaction });
    }
  }, [transaction]);

  const handleSave = () => {
    if (editedTransaction) {
      onSave(editedTransaction);
      onClose();
    }
  };

  if (!editedTransaction) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Transaction</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={editedTransaction.date}
              onChange={(e) => setEditedTransaction(prev => prev ? { ...prev, date: e.target.value } : null)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={editedTransaction.amount}
              onChange={(e) => setEditedTransaction(prev => prev ? { ...prev, amount: parseFloat(e.target.value) || 0 } : null)}
              inputProps={{ step: 0.01, min: 0 }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={editedTransaction.description}
              onChange={(e) => setEditedTransaction(prev => prev ? { ...prev, description: e.target.value } : null)}
              multiline
              rows={2}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Transaction Type</InputLabel>
              <Select
                value={editedTransaction.transaction_type}
                label="Transaction Type"
                onChange={(e) => setEditedTransaction(prev => prev ? { ...prev, transaction_type: e.target.value } : null)}
              >
                <MenuItem value="income">Income</MenuItem>
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="transfer">Transfer</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Confidence"
              type="number"
              value={editedTransaction.confidence}
              onChange={(e) => setEditedTransaction(prev => prev ? { ...prev, confidence: parseFloat(e.target.value) || 0 } : null)}
              inputProps={{ step: 0.1, min: 0, max: 1 }}
              disabled
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Payee"
              value={editedTransaction.payee || ''}
              onChange={(e) => setEditedTransaction(prev => prev ? { ...prev, payee: e.target.value || undefined } : null)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Category"
              value={editedTransaction.category || ''}
              onChange={(e) => setEditedTransaction(prev => prev ? { ...prev, category: e.target.value || undefined } : null)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
};

const TransactionReviewStep: React.FC<TransactionReviewStepProps> = ({
  transactions,
  account,
  onTransactionsChange,
  onConfirm,
  extractionMethod,
  processingNotes,
}) => {
  const [editingTransaction, setEditingTransaction] = useState<LLMTransactionData | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleEditTransaction = (index: number) => {
    setEditingTransaction(transactions[index]);
  };

  const handleSaveTransaction = (updatedTransaction: LLMTransactionData) => {
    const index = transactions.findIndex(t => 
      t.date === editingTransaction?.date && 
      t.amount === editingTransaction?.amount && 
      t.description === editingTransaction?.description
    );
    
    if (index !== -1) {
      const updatedTransactions = [...transactions];
      updatedTransactions[index] = updatedTransaction;
      onTransactionsChange(updatedTransactions);
    }
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = (index: number) => {
    const updatedTransactions = transactions.filter((_, i) => i !== index);
    onTransactionsChange(updatedTransactions);
  };

  const handleAddTransaction = () => {
    const newTransaction: LLMTransactionData = {
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      description: '',
      transaction_type: 'expense',
      confidence: 1.0,
    };
    setEditingTransaction(newTransaction);
  };

  const handleSaveNewTransaction = (newTransaction: LLMTransactionData) => {
    onTransactionsChange([...transactions, newTransaction]);
    setEditingTransaction(null);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const totalAmount = transactions.reduce((sum, t) => {
    return sum + (t.transaction_type === 'income' ? t.amount : -t.amount);
  }, 0);

  const transactionsByType = transactions.reduce((acc, t) => {
    acc[t.transaction_type] = (acc[t.transaction_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review Extracted Transactions
      </Typography>

      {/* Summary Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <Typography variant="h4" color="primary">
                {transactions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Transactions Found
              </Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="h4" color={totalAmount >= 0 ? 'success.main' : 'error.main'}>
                {formatCurrency(Math.abs(totalAmount))}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Net {totalAmount >= 0 ? 'Income' : 'Expense'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="body1">
                Income: {transactionsByType.income || 0}
              </Typography>
              <Typography variant="body1">
                Expenses: {transactionsByType.expense || 0}
              </Typography>
              <Typography variant="body1">
                Transfers: {transactionsByType.transfer || 0}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Chip 
                label={`Extracted via ${extractionMethod}`}
                color={extractionMethod === 'direct_text' ? 'success' : 'warning'}
                size="small"
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Target: {account.name}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Processing Details */}
      <Accordion expanded={showDetails} onChange={() => setShowDetails(!showDetails)}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle1">Processing Details</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            {processingNotes.map((note, index) => (
              <Alert key={index} severity="info" sx={{ mb: 1 }}>
                {note}
              </Alert>
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Actions */}
      <Box display="flex" justifyContent="space-between" alignItems="center" my={2}>
        <Button
          startIcon={<Add />}
          onClick={handleAddTransaction}
          variant="outlined"
        >
          Add Transaction
        </Button>
        <Typography variant="body2" color="text.secondary">
          Review and edit transactions below, then confirm to import
        </Typography>
      </Box>

      {/* Transactions Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Payee</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Confidence</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((transaction, index) => (
              <TableRow key={index}>
                <TableCell>{transaction.date}</TableCell>
                <TableCell sx={{ maxWidth: 200 }}>
                  <Typography variant="body2" noWrap>
                    {transaction.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography 
                    variant="body2" 
                    color={transaction.transaction_type === 'income' ? 'success.main' : 'text.primary'}
                  >
                    {formatCurrency(transaction.amount)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={transaction.transaction_type}
                    size="small"
                    color={transaction.transaction_type === 'income' ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>{transaction.payee || '-'}</TableCell>
                <TableCell>{transaction.category || '-'}</TableCell>
                <TableCell>
                  <Chip 
                    label={getConfidenceLabel(transaction.confidence)}
                    size="small"
                    color={getConfidenceColor(transaction.confidence)}
                  />
                </TableCell>
                <TableCell>
                  <IconButton 
                    size="small" 
                    onClick={() => handleEditTransaction(index)}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleDeleteTransaction(index)}
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {transactions.length === 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          No transactions were extracted from the PDF. You can add transactions manually or try uploading a different PDF.
        </Alert>
      )}

      {/* Confirm Button */}
      <Box display="flex" justifyContent="center" mt={3}>
        <Button
          variant="contained"
          size="large"
          onClick={onConfirm}
          disabled={transactions.length === 0}
          startIcon={<CheckCircle />}
        >
          Confirm & Import {transactions.length} Transactions
        </Button>
      </Box>

      {/* Edit Dialog */}
      <EditTransactionDialog
        open={editingTransaction !== null}
        transaction={editingTransaction}
        onSave={editingTransaction && transactions.includes(editingTransaction) 
          ? handleSaveTransaction 
          : handleSaveNewTransaction}
        onClose={() => setEditingTransaction(null)}
      />
    </Box>
  );
};

export default TransactionReviewStep;
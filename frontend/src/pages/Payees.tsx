import React, { useState } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  CircularProgress,
  Chip,
  Alert,
  Tooltip,
} from '@mui/material';
import { Add, Edit, Delete, Palette, CleaningServices, Check, Close, FileDownload, FileUpload } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { payeesApi } from '../services/api';
import { Payee, CreatePayeeDto } from '../types';
import { formatDateTime } from '../utils/formatters';
import { useCreateWithConfirm, useUpdateWithConfirm, useDeleteWithConfirm } from '../hooks/useApiWithConfirm';

const Payees: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null);
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignResult, setReassignResult] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreatePayeeDto>({
    defaultValues: {
      name: '',
      color: '',
    },
  });

  const { data: payees, isLoading } = useQuery({
    queryKey: ['payees'],
    queryFn: () => payeesApi.getAll(),
  });

  const createMutation = useCreateWithConfirm(payeesApi.create, {
    resourceName: 'Payee',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payees'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useUpdateWithConfirm(
    ({ id, data }: { id: string; data: Partial<CreatePayeeDto> }) =>
      payeesApi.update(id, data),
    {
      resourceName: 'Payee',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['payees'] });
        handleCloseDialog();
      },
    }
  );

  const deleteMutation = useDeleteWithConfirm(payeesApi.delete, {
    resourceName: 'Payee',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payees'] });
    },
  });

  const handleOpenDialog = (payee?: Payee) => {
    if (payee) {
      setEditingPayee(payee);
      reset({
        name: payee.name,
        color: payee.color,
      });
    } else {
      setEditingPayee(null);
      reset({
        name: '',
        color: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPayee(null);
    reset();
  };

  const onSubmit = (data: CreatePayeeDto) => {
    const submitData = {
      ...data,
      color: data.color || undefined, // Let backend generate color if not provided
    };

    if (editingPayee) {
      if (updateMutation.isPending) {
        return;
      }
      updateMutation.mutate({ id: editingPayee.id, data: submitData });
    } else {
      if (createMutation.isPending) {
        return;
      }
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmMessage('Are you sure you want to delete this payee?');
    setConfirmAction(() => () => {
      deleteMutation.mutate(id);
      setConfirmDialogOpen(false);
    });
    setConfirmDialogOpen(true);
  };

  const handleInlineEdit = (payee: Payee) => {
    setInlineEditingId(payee.id);
    setInlineEditValue(payee.name);
  };

  const handleInlineCancel = () => {
    setInlineEditingId(null);
    setInlineEditValue('');
  };

  const handleInlineSave = () => {
    if (inlineEditingId && inlineEditValue.trim()) {
      updateMutation.mutate({ 
        id: inlineEditingId, 
        data: { name: inlineEditValue.trim() } 
      });
      setInlineEditingId(null);
      setInlineEditValue('');
    }
  };

  const handleReassignColors = async () => {
    if (!payees || payees.length === 0) {
      return;
    }

    setConfirmMessage(
      'This will generate mathematically optimal unique colors. ' +
      'Each payee will get a visually distinct color for maximum visual separation. Continue?'
    );
    setConfirmAction(() => async () => {
      setConfirmDialogOpen(false);

      setIsReassigning(true);
      setReassignResult(null);

      try {
        const result = await payeesApi.reassignColors();
        setReassignResult(result);
        
        // Refresh payees to show new colors
        queryClient.invalidateQueries({ queryKey: ['payees'] });
        
      } catch (error: any) {
        setReassignResult({
          error: true,
          message: error.response?.data?.detail || 'Failed to reassign colors'
        });
      } finally {
        setIsReassigning(false);
      }
    });
    setConfirmDialogOpen(true);
  };

  const handleDeleteUnused = async () => {
    if (!payees || payees.length === 0) {
      return;
    }

    setConfirmMessage(
      'This will permanently delete all payees that are not referenced by any transactions. ' +
      'This action cannot be undone. Continue?'
    );
    setConfirmAction(() => async () => {
      setConfirmDialogOpen(false);

      setIsDeleting(true);
      setDeleteResult(null);

      try {
        const result = await payeesApi.deleteUnused();
        setDeleteResult(result);
        
        // Refresh payees to show updated list
        queryClient.invalidateQueries({ queryKey: ['payees'] });
        
      } catch (error: any) {
        setDeleteResult({
          error: true,
          message: error.response?.data?.detail || 'Failed to delete unused payees'
        });
      } finally {
        setIsDeleting(false);
      }
    });
    setConfirmDialogOpen(true);
  };

  const handleExport = async () => {
    if (!payees || payees.length === 0) {
      return;
    }

    try {
      const response = await payeesApi.exportToExcel();
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'payees_export.xlsx');
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

      const result = await payeesApi.import(formData);
      setImportResult(result);
      
      // Refresh payees to show new data
      queryClient.invalidateQueries({ queryKey: ['payees'] });
      
    } catch (error: any) {
      setImportResult({
        error: true,
        message: error.response?.data?.detail || 'Failed to import payees'
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

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Payees</Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Import payees from Excel or CSV file">
            <Button
              variant="outlined"
              startIcon={<FileUpload />}
              onClick={handleImport}
              disabled={isImporting}
              color="primary"
            >
              {isImporting ? 'Importing...' : 'Import'}
            </Button>
          </Tooltip>
          <Tooltip title="Export all payees to Excel file">
            <Button
              variant="outlined"
              startIcon={<FileDownload />}
              onClick={handleExport}
              disabled={!payees || payees.length === 0}
              color="primary"
            >
              Export
            </Button>
          </Tooltip>
          <Tooltip title="Delete all payees that are not referenced by any transactions">
            <Button
              variant="outlined"
              startIcon={<CleaningServices />}
              onClick={handleDeleteUnused}
              disabled={isDeleting || !payees || payees.length === 0}
              color="error"
            >
              {isDeleting ? 'Deleting...' : 'Remove Unused'}
            </Button>
          </Tooltip>
          <Tooltip title="Generate unique colors for visual distinction">
            <Button
              variant="outlined"
              startIcon={<Palette />}
              onClick={handleReassignColors}
              disabled={isReassigning || !payees || payees.length === 0}
            >
              {isReassigning ? 'Distributing...' : 'Reassign Colors'}
            </Button>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            Add Payee
          </Button>
        </Box>
      </Box>

      {/* Delete Unused Results */}
      {deleteResult && (
        <Alert 
          severity={deleteResult.error ? 'error' : 'success'}
          onClose={() => setDeleteResult(null)}
          sx={{ mb: 2 }}
        >
          {deleteResult.error ? (
            deleteResult.message
          ) : (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {deleteResult.message}
              </Typography>
              {deleteResult.deleted_payees && deleteResult.deleted_payees.length > 0 && (
                <Box>
                  <Typography variant="body2">
                    Deleted payees:
                  </Typography>
                  {deleteResult.deleted_payees.slice(0, 5).map((payee: any, index: number) => (
                    <Typography key={index} variant="body2" sx={{ ml: 2 }}>
                      • {payee.name}
                    </Typography>
                  ))}
                  {deleteResult.deleted_payees.length > 5 && (
                    <Typography variant="body2" sx={{ ml: 2 }}>
                      ... and {deleteResult.deleted_payees.length - 5} more
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Alert>
      )}

      {/* Color Reassignment Results */}
      {reassignResult && (
        <Alert 
          severity={reassignResult.error ? 'error' : 'success'}
          onClose={() => setReassignResult(null)}
          sx={{ mb: 2 }}
        >
          {reassignResult.error ? (
            reassignResult.message
          ) : (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {reassignResult.message}
              </Typography>
              <Typography variant="body2">
                • Colors generated: {reassignResult.payees_updated} / {reassignResult.total_payees}
              </Typography>
              <Typography variant="body2">
                • Distribution method: {reassignResult.distribution_method || 'Golden Ratio (137.5°)'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Each color is positioned for optimal visual distinction and accessibility.
              </Typography>
            </Box>
          )}
        </Alert>
      )}

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
                • New payees created: {importResult.created_count}
              </Typography>
              <Typography variant="body2">
                • Existing payees updated: {importResult.updated_count}
              </Typography>
              <Typography variant="body2">
                • Payees skipped (no changes): {importResult.skipped_count}
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Color</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payees?.sort((a, b) => a.name.localeCompare(b.name)).map((payee) => (
              <TableRow key={payee.id}>
                <TableCell>
                  {inlineEditingId === payee.id ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <TextField
                        value={inlineEditValue}
                        onChange={(e) => setInlineEditValue(e.target.value)}
                        size="small"
                        autoFocus
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleInlineSave();
                          } else if (e.key === 'Escape') {
                            handleInlineCancel();
                          }
                        }}
                      />
                      <IconButton size="small" onClick={handleInlineSave} color="primary">
                        <Check />
                      </IconButton>
                      <IconButton size="small" onClick={handleInlineCancel}>
                        <Close />
                      </IconButton>
                    </Box>
                  ) : (
                    <Box 
                      display="flex" 
                      alignItems="center" 
                      gap={1}
                      sx={{
                        '&:hover .edit-icon': {
                          opacity: 1,
                        }
                      }}
                    >
                      <Typography 
                        variant="body1" 
                        onClick={() => handleInlineEdit(payee)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            borderRadius: '4px',
                            padding: '2px 4px',
                            margin: '-2px -4px',
                          }
                        }}
                      >
                        {payee.name}
                      </Typography>
                      <IconButton 
                        size="small" 
                        onClick={() => handleInlineEdit(payee)}
                        className="edit-icon"
                        sx={{
                          opacity: 0,
                          transition: 'opacity 0.2s ease-in-out',
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        backgroundColor: payee.color,
                        borderRadius: '4px',
                        border: '1px solid rgba(0,0,0,0.12)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Chip
                      label={payee.color}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                      }}
                    />
                  </Box>
                </TableCell>
                <TableCell>{formatDateTime(payee.created_at)}</TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(payee.id)}
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

      {/* Payee Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingPayee ? 'Edit Payee' : 'Add Payee'}
          </DialogTitle>
          <DialogContent>
            <Controller
              name="name"
              control={control}
              rules={{ required: 'Payee name is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Payee Name"
                  fullWidth
                  margin="normal"
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              )}
            />

            <Controller
              name="color"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Color (Optional - auto-generated if empty)"
                  type="color"
                  fullWidth
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                  helperText="Leave empty to auto-generate a unique color"
                />
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingPayee ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography>{confirmMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => confirmAction && confirmAction()} 
            color="primary" 
            variant="contained"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Payees;
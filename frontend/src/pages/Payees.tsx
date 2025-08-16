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
import { Add, Edit, Delete, Palette, CleaningServices } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { payeesApi } from '../services/api';
import { Payee, CreatePayeeDto } from '../types';
import { formatDateTime } from '../utils/formatters';
import { useCreateWithConfirm, useUpdateWithConfirm, useDeleteWithConfirm } from '../hooks/useApiWithConfirm';

const Payees: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignResult, setReassignResult] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<any>(null);
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
      updateMutation.mutate({ id: editingPayee.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this payee?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleReassignColors = async () => {
    if (!payees || payees.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      'This will generate mathematically optimal unique colors using Golden Ratio distribution. ' +
      'Each payee will get a visually distinct color positioned at 137.5° intervals ' +
      'around the color wheel for maximum visual separation. Continue?'
    );

    if (!confirmed) return;

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
  };

  const handleDeleteUnused = async () => {
    if (!payees || payees.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      'This will permanently delete all payees that are not referenced by any transactions. ' +
      'This action cannot be undone. Continue?'
    );

    if (!confirmed) return;

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
          <Tooltip title="Generate mathematically optimal unique colors using Golden Ratio distribution">
            <Button
              variant="outlined"
              startIcon={<Palette />}
              onClick={handleReassignColors}
              disabled={isReassigning || !payees || payees.length === 0}
            >
              {isReassigning ? 'Distributing...' : 'Golden Ratio Colors'}
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
                Each color is mathematically positioned for optimal visual distinction and accessibility.
              </Typography>
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
                  <Typography variant="body1">{payee.name}</Typography>
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
                    onClick={() => handleOpenDialog(payee)}
                  >
                    <Edit />
                  </IconButton>
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
    </Box>
  );
};

export default Payees;
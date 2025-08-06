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
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { payeesApi } from '../services/api';
import { Payee, CreatePayeeDto } from '../types';
import { formatDateTime } from '../utils/formatters';
import { useCreateWithToast, useUpdateWithToast, useDeleteWithToast } from '../hooks/useApiWithToast';

const Payees: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null);
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreatePayeeDto>({
    defaultValues: {
      name: '',
    },
  });

  const { data: payees, isLoading } = useQuery({
    queryKey: ['payees'],
    queryFn: () => payeesApi.getAll(),
  });

  const createMutation = useCreateWithToast(payeesApi.create, {
    resourceName: 'Payee',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payees'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useUpdateWithToast(
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

  const deleteMutation = useDeleteWithToast(payeesApi.delete, {
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
      });
    } else {
      setEditingPayee(null);
      reset({
        name: '',
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
    if (editingPayee) {
      updateMutation.mutate({ id: editingPayee.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this payee?')) {
      deleteMutation.mutate(id);
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
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Payee
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
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
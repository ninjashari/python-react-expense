import React, { useState } from 'react';
import {
  TextField,
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { payeesApi } from '../services/api';
import { Payee, CreatePayeeDto } from '../types';
import { useCreateWithToast } from '../hooks/useApiWithToast';

interface PayeeSelectProps {
  value: number | string;
  onChange: (value: number | string) => void;
  payees: Payee[];
  error?: boolean;
  helperText?: string;
}

const PayeeSelect: React.FC<PayeeSelectProps> = ({
  value,
  onChange,
  payees,
  error,
  helperText,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreatePayeeDto>({
    defaultValues: {
      name: '',
    },
  });

  const createMutation = useCreateWithToast(payeesApi.create, {
    resourceName: 'Payee',
    onSuccess: (newPayee) => {
      queryClient.invalidateQueries({ queryKey: ['payees'] });
      onChange(newPayee.id);
      setDialogOpen(false);
      reset();
    },
  });

  const handleCreate = (data: CreatePayeeDto) => {
    createMutation.mutate(data);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleSubmit(handleCreate)(e);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    reset();
  };

  const sortedPayees = payees?.sort((a, b) => a.name.localeCompare(b.name)) || [];
  const selectedPayee = sortedPayees.find(p => p.id === value) || null;

  return (
    <>
      <Box display="flex" alignItems="center" gap={1}>
        <Autocomplete
          options={sortedPayees}
          getOptionLabel={(option) => option.name}
          value={selectedPayee}
          onChange={(_, newValue) => onChange(newValue ? newValue.id : '')}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Payee (Optional)"
              margin="normal"
              error={error}
              helperText={helperText}
              placeholder="Search payees..."
            />
          )}
          fullWidth
          clearOnBlur
          handleHomeEndKeys
          freeSolo={false}
        />
        <IconButton
          onClick={() => setDialogOpen(true)}
          color="primary"
          size="small"
          sx={{ mt: 1 }}
        >
          <Add />
        </IconButton>
      </Box>

      {/* Create Payee Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleFormSubmit}>
          <DialogTitle>Add New Payee</DialogTitle>
          <DialogContent>
            <Controller
              name="name"
              control={control}
              rules={{ required: 'Payee name is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  fullWidth
                  margin="normal"
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  autoFocus
                />
              )}
            />

          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} type="button">Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Payee'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
};

export default PayeeSelect;
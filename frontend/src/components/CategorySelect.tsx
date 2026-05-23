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
  Chip,
  Autocomplete,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../services/api';
import { Category, CreateCategoryDto } from '../types';
import { useCreateWithToast } from '../hooks/useApiWithToast';

interface CategorySelectProps {
  value: number | string;
  onChange: (value: number | string) => void;
  categories: Category[];
  error?: boolean;
  helperText?: string;
}

const CategorySelect: React.FC<CategorySelectProps> = ({
  value,
  onChange,
  categories,
  error,
  helperText,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateCategoryDto>({
    defaultValues: {
      name: '',
      color: '',
    },
  });

  const createMutation = useCreateWithToast(categoriesApi.create, {
    resourceName: 'Category',
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onChange(newCategory.id);
      setDialogOpen(false);
      reset();
    },
  });

  const handleCreate = (data: CreateCategoryDto) => {
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

  const sortedCategories = categories?.sort((a, b) => a.name.localeCompare(b.name)) || [];
  const selectedCategory = sortedCategories.find(c => c.id === value) || null;

  return (
    <>
      <Box display="flex" alignItems="center" gap={1}>
        <Autocomplete
          options={sortedCategories}
          getOptionLabel={(option) => option.name}
          value={selectedCategory}
          onChange={(_, newValue) => onChange(newValue ? newValue.id : '')}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Category (Optional)"
              margin="normal"
              error={error}
              helperText={helperText}
              placeholder="Search categories..."
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} display="flex" alignItems="center" gap={1}>
              <Chip
                size="small"
                sx={{
                  backgroundColor: option.color,
                  color: 'white',
                  height: 16,
                  fontSize: '0.7rem',
                  minWidth: '16px',
                }}
              />
              {option.name}
            </Box>
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

      {/* Create Category Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleFormSubmit}>
          <DialogTitle>Add New Category</DialogTitle>
          <DialogContent>
            <Controller
              name="name"
              control={control}
              rules={{ required: 'Category name is required' }}
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

            <Controller
              name="color"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Color (Optional)"
                  type="color"
                  fullWidth
                  margin="normal"
                  error={!!errors.color}
                  helperText={errors.color?.message}
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
              {createMutation.isPending ? 'Creating...' : 'Create Category'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
};

export default CategorySelect;
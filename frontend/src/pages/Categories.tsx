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
  Chip,
  CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { categoriesApi } from '../services/api';
import { Category, CreateCategoryDto } from '../types';
import { formatDateTime } from '../utils/formatters';
import { useCreateWithToast, useUpdateWithToast, useDeleteWithToast } from '../hooks/useApiWithToast';

const Categories: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateCategoryDto>({
    defaultValues: {
      name: '',
      color: '',
    },
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll(),
  });

  const createMutation = useCreateWithToast(categoriesApi.create, {
    resourceName: 'Category',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useUpdateWithToast(
    ({ id, data }: { id: number; data: Partial<CreateCategoryDto> }) =>
      categoriesApi.update(id, data),
    {
      resourceName: 'Category',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        handleCloseDialog();
      },
    }
  );

  const deleteMutation = useDeleteWithToast(categoriesApi.delete, {
    resourceName: 'Category',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      reset({
        name: category.name,
        color: category.color,
      });
    } else {
      setEditingCategory(null);
      reset({
        name: '',
        color: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    reset();
  };

  const onSubmit = (data: CreateCategoryDto) => {
    const submitData = {
      ...data,
      color: data.color || undefined, // Let backend generate color if not provided
    };

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
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
        <Typography variant="h4">Categories</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Category
        </Button>
      </Box>

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
            {categories?.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  <Typography variant="body1">{category.name}</Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={category.color}
                    size="small"
                    sx={{
                      backgroundColor: category.color,
                      color: 'white',
                    }}
                  />
                </TableCell>
                <TableCell>{formatDateTime(category.created_at)}</TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(category)}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(category.id)}
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

      {/* Category Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingCategory ? 'Edit Category' : 'Add Category'}
          </DialogTitle>
          <DialogContent>
            <Controller
              name="name"
              control={control}
              rules={{ required: 'Category name is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Category Name"
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
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Categories;
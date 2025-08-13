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
  Alert,
  Tooltip,
} from '@mui/material';
import { Add, Edit, Delete, Palette } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { categoriesApi } from '../services/api';
import { Category, CreateCategoryDto } from '../types';
import { formatDateTime } from '../utils/formatters';
import { useCreateWithToast, useUpdateWithToast, useDeleteWithToast } from '../hooks/useApiWithToast';

const Categories: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignResult, setReassignResult] = useState<any>(null);
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
    ({ id, data }: { id: string; data: Partial<CreateCategoryDto> }) =>
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

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleReassignColors = async () => {
    if (!categories || categories.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      'This will generate mathematically optimal unique colors using Golden Ratio distribution. ' +
      'Each category will get a visually distinct color positioned at 137.5° intervals ' +
      'around the color wheel for maximum visual separation. Continue?'
    );

    if (!confirmed) return;

    setIsReassigning(true);
    setReassignResult(null);

    try {
      const result = await categoriesApi.reassignColors();
      setReassignResult(result);
      
      // Refresh categories to show new colors
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      
    } catch (error: any) {
      setReassignResult({
        error: true,
        message: error.response?.data?.detail || 'Failed to reassign colors'
      });
    } finally {
      setIsReassigning(false);
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
        <Box display="flex" gap={1}>
          <Tooltip title="Generate mathematically optimal unique colors using Golden Ratio distribution">
            <Button
              variant="outlined"
              startIcon={<Palette />}
              onClick={handleReassignColors}
              disabled={isReassigning || !categories || categories.length === 0}
            >
              {isReassigning ? 'Distributing...' : 'Golden Ratio Colors'}
            </Button>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            Add Category
          </Button>
        </Box>
      </Box>

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
                • Colors generated: {reassignResult.categories_updated} / {reassignResult.total_categories}
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
            {categories?.sort((a, b) => a.name.localeCompare(b.name)).map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  <Typography variant="body1">{category.name}</Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        backgroundColor: category.color,
                        borderRadius: '4px',
                        border: '1px solid rgba(0,0,0,0.12)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Chip
                      label={category.color}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                      }}
                    />
                  </Box>
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
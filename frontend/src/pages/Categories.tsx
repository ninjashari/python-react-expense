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
import { Add, Edit, Delete, Palette, CleaningServices, Check, Close } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { categoriesApi } from '../services/api';
import { Category, CreateCategoryDto } from '../types';
import { formatDateTime } from '../utils/formatters';
import { useCreateWithConfirm, useUpdateWithConfirm, useDeleteWithConfirm } from '../hooks/useApiWithConfirm';

const Categories: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignResult, setReassignResult] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<any>(null);
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

  const createMutation = useCreateWithConfirm(categoriesApi.create, {
    resourceName: 'Category',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      handleCloseDialog();
    },
  });

  const updateMutation = useUpdateWithConfirm(
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

  const deleteMutation = useDeleteWithConfirm(categoriesApi.delete, {
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
    setConfirmMessage('Are you sure you want to delete this category?');
    setConfirmAction(() => () => {
      deleteMutation.mutate(id);
      setConfirmDialogOpen(false);
    });
    setConfirmDialogOpen(true);
  };

  const handleInlineEdit = (category: Category) => {
    setInlineEditingId(category.id);
    setInlineEditValue(category.name);
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
    if (!categories || categories.length === 0) {
      return;
    }

    setConfirmMessage(
      'This will generate mathematically optimal unique colors. ' +
      'Each category will get a visually distinct color for maximum visual separation. Continue?'
    );
    setConfirmAction(() => async () => {
      setConfirmDialogOpen(false);

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
    });
    setConfirmDialogOpen(true);
  };

  const handleDeleteUnused = async () => {
    if (!categories || categories.length === 0) {
      return;
    }

    setConfirmMessage(
      'This will permanently delete all categories that are not referenced by any transactions. ' +
      'This action cannot be undone. Continue?'
    );
    setConfirmAction(() => async () => {
      setConfirmDialogOpen(false);

      setIsDeleting(true);
      setDeleteResult(null);

      try {
        const result = await categoriesApi.deleteUnused();
        setDeleteResult(result);
        
        // Refresh categories to show updated list
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        
      } catch (error: any) {
        setDeleteResult({
          error: true,
          message: error.response?.data?.detail || 'Failed to delete unused categories'
        });
      } finally {
        setIsDeleting(false);
      }
    });
    setConfirmDialogOpen(true);
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
          <Tooltip title="Delete all categories that are not referenced by any transactions">
            <Button
              variant="outlined"
              startIcon={<CleaningServices />}
              onClick={handleDeleteUnused}
              disabled={isDeleting || !categories || categories.length === 0}
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
              disabled={isReassigning || !categories || categories.length === 0}
            >
              {isReassigning ? 'Distributing...' : 'Reassign Colors'}
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
              {deleteResult.deleted_categories && deleteResult.deleted_categories.length > 0 && (
                <Box>
                  <Typography variant="body2">
                    Deleted categories:
                  </Typography>
                  {deleteResult.deleted_categories.slice(0, 5).map((category: any, index: number) => (
                    <Typography key={index} variant="body2" sx={{ ml: 2 }}>
                      • {category.name}
                    </Typography>
                  ))}
                  {deleteResult.deleted_categories.length > 5 && (
                    <Typography variant="body2" sx={{ ml: 2 }}>
                      ... and {deleteResult.deleted_categories.length - 5} more
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
                • Colors generated: {reassignResult.categories_updated} / {reassignResult.total_categories}
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
                  {inlineEditingId === category.id ? (
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
                        onClick={() => handleInlineEdit(category)}
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
                        {category.name}
                      </Typography>
                      <IconButton 
                        size="small" 
                        onClick={() => handleInlineEdit(category)}
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

export default Categories;
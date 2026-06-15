import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { DeleteForever } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types/auth';

const Admin: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.listUsers,
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: (_, userId) => {
      const deleted = users.find(u => u.id === userId);
      setSuccessMsg(`Deleted ${deleted?.email ?? 'user'} and all their data.`);
      setConfirmUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  if (isLoading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Failed to load users.</Alert>;

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={3}>User Management</Typography>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}
      {deleteMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(deleteMutation.error as Error)?.message ?? 'Delete failed.'}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell align="center">Delete</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id} hover>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  {u.is_admin
                    ? <Chip label="Admin" color="primary" size="small" />
                    : <Chip label="User" size="small" />}
                </TableCell>
                <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                <TableCell align="center">
                  <IconButton
                    color="error"
                    size="small"
                    disabled={u.id === currentUser?.id}
                    title={u.id === currentUser?.id ? 'Cannot delete your own account' : `Delete ${u.email}`}
                    onClick={() => setConfirmUser(u)}
                  >
                    <DeleteForever fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Confirmation dialog */}
      <Dialog open={!!confirmUser} onClose={() => setConfirmUser(null)}>
        <DialogTitle>Delete user?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete <strong>{confirmUser?.email}</strong> and ALL their
            data — accounts, transactions, categories, payees, reward points. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUser(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => confirmUser && deleteMutation.mutate(confirmUser.id)}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Admin;

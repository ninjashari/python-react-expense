import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Chip,
} from '@mui/material';
import { Add, Edit, Delete, Loyalty, History, Star, FileDownload, FileUpload } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { accountsApi, rewardPointsApi } from '../services/api';
import {
  Account,
  RewardPointRedemption,
  CreateRewardPointRedemptionDto,
  RewardPointBonus,
  CreateRewardPointBonusDto,
  RewardPointsSummaryItem,
} from '../types';
import { useCreateWithConfirm, useUpdateWithConfirm, useDeleteWithConfirm } from '../hooks/useApiWithConfirm';

const RewardPoints: React.FC = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRedemption, setEditingRedemption] = useState<RewardPointRedemption | null>(null);
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [editingBonus, setEditingBonus] = useState<RewardPointBonus | null>(null);
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'date', dir: 'desc' });
  const [bonusSort, setBonusSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'date', dir: 'desc' });
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const queryClient = useQueryClient();

  const handleSort = (col: string) =>
    setSort((prev) => ({ col, dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['rewardPointsSummary'],
    queryFn: rewardPointsApi.getSummary,
  });

  const { data: redemptions = [], isLoading: redemptionsLoading } = useQuery({
    queryKey: ['rewardPointRedemptions'],
    queryFn: rewardPointsApi.getAll,
  });

  const { data: bonuses = [], isLoading: bonusesLoading } = useQuery({
    queryKey: ['rewardPointBonuses'],
    queryFn: rewardPointsApi.getAllBonuses,
  });

  const sortedRedemptions = useMemo(() => {
    const mul = sort.dir === 'asc' ? 1 : -1;
    return [...redemptions].sort((a, b) => {
      if (sort.col === 'date')        return mul * (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      if (sort.col === 'points_used') return mul * (a.points_used - b.points_used);
      if (sort.col === 'account')     return mul * (a.account?.name ?? '').localeCompare(b.account?.name ?? '');
      return 0;
    });
  }, [redemptions, sort]);

  const sortedBonuses = useMemo(() => {
    const mul = bonusSort.dir === 'asc' ? 1 : -1;
    return [...(bonuses as RewardPointBonus[])].sort((a, b) => {
      if (bonusSort.col === 'date')    return mul * (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      if (bonusSort.col === 'points')  return mul * (a.points - b.points);
      if (bonusSort.col === 'account') return mul * (a.account?.name ?? '').localeCompare(b.account?.name ?? '');
      return 0;
    });
  }, [bonuses, bonusSort]);

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const creditAccounts = (allAccounts as Account[]).filter(a => a.type === 'credit');

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateRewardPointRedemptionDto>({
    defaultValues: {
      account_id: '',
      date: new Date().toISOString().split('T')[0],
      points_used: 0,
      description: '',
    },
  });

  const { control: bonusControl, handleSubmit: handleBonusSubmit, reset: resetBonus, formState: { errors: bonusErrors } } = useForm<CreateRewardPointBonusDto>({
    defaultValues: {
      account_id: '',
      date: new Date().toISOString().split('T')[0],
      points: 0,
      description: '',
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['rewardPointRedemptions'] });
    queryClient.invalidateQueries({ queryKey: ['rewardPointsSummary'] });
  };

  const invalidateBonus = () => {
    queryClient.invalidateQueries({ queryKey: ['rewardPointBonuses'] });
    queryClient.invalidateQueries({ queryKey: ['rewardPointsSummary'] });
  };

  const createMutation = useCreateWithConfirm(
    (data: CreateRewardPointRedemptionDto) => rewardPointsApi.create(data),
    { resourceName: 'Redemption', onSuccess: () => { invalidate(); setDialogOpen(false); } }
  );

  const updateMutation = useUpdateWithConfirm(
    ({ id, data }: { id: string; data: Partial<CreateRewardPointRedemptionDto> }) =>
      rewardPointsApi.update(id, data),
    { resourceName: 'Redemption', onSuccess: () => { invalidate(); setDialogOpen(false); } }
  );

  const deleteMutation = useDeleteWithConfirm(
    (id: string) => rewardPointsApi.delete(id),
    { resourceName: 'Redemption', onSuccess: invalidate }
  );

  const createBonusMutation = useCreateWithConfirm(
    (data: CreateRewardPointBonusDto) => rewardPointsApi.createBonus(data),
    { resourceName: 'Bonus', onSuccess: () => { invalidateBonus(); setBonusDialogOpen(false); } }
  );

  const updateBonusMutation = useUpdateWithConfirm(
    ({ id, data }: { id: string; data: Partial<CreateRewardPointBonusDto> }) =>
      rewardPointsApi.updateBonus(id, data),
    { resourceName: 'Bonus', onSuccess: () => { invalidateBonus(); setBonusDialogOpen(false); } }
  );

  const deleteBonusMutation = useDeleteWithConfirm(
    (id: string) => rewardPointsApi.deleteBonus(id),
    { resourceName: 'Bonus', onSuccess: invalidateBonus }
  );

  const handleOpenDialog = (redemption?: RewardPointRedemption) => {
    if (redemption) {
      setEditingRedemption(redemption);
      reset({
        account_id: redemption.account_id,
        date: redemption.date,
        points_used: redemption.points_used,
        description: redemption.description ?? '',
      });
    } else {
      setEditingRedemption(null);
      reset({
        account_id: creditAccounts[0]?.id ?? '',
        date: new Date().toISOString().split('T')[0],
        points_used: 0,
        description: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRedemption(null);
  };

  const onSubmit = (data: CreateRewardPointRedemptionDto) => {
    if (editingRedemption) {
      updateMutation.mutate({ id: editingRedemption.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleOpenBonusDialog = (bonus?: RewardPointBonus) => {
    if (bonus) {
      setEditingBonus(bonus);
      resetBonus({
        account_id: bonus.account_id,
        date: bonus.date,
        points: bonus.points,
        description: bonus.description ?? '',
      });
    } else {
      setEditingBonus(null);
      resetBonus({
        account_id: creditAccounts[0]?.id ?? '',
        date: new Date().toISOString().split('T')[0],
        points: 0,
        description: '',
      });
    }
    setBonusDialogOpen(true);
  };

  const handleCloseBonusDialog = () => {
    setBonusDialogOpen(false);
    setEditingBonus(null);
  };

  const onBonusSubmit = (data: CreateRewardPointBonusDto) => {
    if (editingBonus) {
      updateBonusMutation.mutate({ id: editingBonus.id, data });
    } else {
      createBonusMutation.mutate(data);
    }
  };

  const summary: RewardPointsSummaryItem[] = summaryData?.items ?? [];

  const hasData = redemptions.length > 0 || (bonuses as RewardPointBonus[]).length > 0 || summary.length > 0;

  const handleExport = async () => {
    try {
      const response = await rewardPointsApi.exportToExcel();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'reward_points_export.xlsx');
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
      const result = await rewardPointsApi.import(formData);
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ['rewardPointRedemptions'] });
      queryClient.invalidateQueries({ queryKey: ['rewardPointBonuses'] });
      queryClient.invalidateQueries({ queryKey: ['rewardPointsSummary'] });
    } catch (error: any) {
      setImportResult({
        error: true,
        message: error.response?.data?.detail || 'Failed to import reward points',
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
      if (file) handleImportFile(file);
    };
    fileInput.click();
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <Loyalty color="primary" />
          <Typography variant="h5" fontWeight="bold">Reward Points</Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<History />}
            onClick={() => navigate('/reward-points/history')}
          >
            View History
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileUpload />}
            onClick={handleImport}
            disabled={isImporting}
          >
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={handleExport}
            disabled={!hasData}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            color="info"
            startIcon={<Star />}
            onClick={() => handleOpenBonusDialog()}
            disabled={creditAccounts.length === 0}
          >
            Add Bonus
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            disabled={creditAccounts.length === 0}
          >
            Add Redemption
          </Button>
        </Box>
      </Box>

      {creditAccounts.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No credit card accounts found. Add a credit card account to track reward points.
        </Alert>
      )}

      {importResult && (
        <Alert
          severity={importResult.error ? 'error' : 'success'}
          sx={{ mb: 3 }}
          onClose={() => setImportResult(null)}
        >
          {importResult.error ? (
            importResult.message
          ) : (
            <>
              <Typography variant="body2" fontWeight="bold">{importResult.message}</Typography>
              <Typography variant="body2">• Redemptions created: {importResult.created_redemptions}</Typography>
              <Typography variant="body2">• Bonuses created: {importResult.created_bonuses}</Typography>
              <Typography variant="body2">• Skipped (duplicates): {importResult.skipped_count}</Typography>
              {importResult.error_count > 0 && (
                <>
                  <Typography variant="body2" color="error">• Errors: {importResult.error_count}</Typography>
                  {importResult.errors?.map((err: string, i: number) => (
                    <Typography key={i} variant="caption" display="block" color="error">{err}</Typography>
                  ))}
                </>
              )}
            </>
          )}
        </Alert>
      )}

      {/* Summary Cards */}
      {summaryLoading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
      ) : (
        <Grid container spacing={2} mb={4}>
          {summary.map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item.account_id}>
              <Card elevation={2}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {item.account_name}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" color="text.secondary">Earned</Typography>
                    <Chip
                      label={item.total_earned.toLocaleString()}
                      color="success"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" color="text.secondary">Bonus</Typography>
                    <Chip
                      label={item.total_bonus.toLocaleString()}
                      color="info"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" color="text.secondary">Redeemed</Typography>
                    <Chip
                      label={item.total_redeemed.toLocaleString()}
                      color="warning"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mt={1.5}
                    pt={1.5}
                    borderTop={1}
                    borderColor="divider"
                  >
                    <Typography variant="body2" fontWeight="bold">Available</Typography>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color={item.net_available >= 0 ? 'primary' : 'error'}
                    >
                      {item.net_available.toLocaleString()}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {summary.length === 0 && !summaryLoading && (
            <Grid item xs={12}>
              <Alert severity="info">
                No reward points data yet. Import transactions with reward points or add a redemption to get started.
              </Alert>
            </Grid>
          )}
        </Grid>
      )}

      {/* Redemptions Table */}
      <Typography variant="h6" fontWeight="bold" mb={2}>Redemption History</Typography>
      {redemptionsLoading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} elevation={1}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell sortDirection={sort.col === 'date' ? sort.dir : false}>
                  <TableSortLabel
                    active={sort.col === 'date'}
                    direction={sort.col === 'date' ? sort.dir : 'asc'}
                    onClick={() => handleSort('date')}
                  >
                    <strong>Date</strong>
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sort.col === 'account' ? sort.dir : false}>
                  <TableSortLabel
                    active={sort.col === 'account'}
                    direction={sort.col === 'account' ? sort.dir : 'asc'}
                    onClick={() => handleSort('account')}
                  >
                    <strong>Account</strong>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={sort.col === 'points_used' ? sort.dir : false}>
                  <TableSortLabel
                    active={sort.col === 'points_used'}
                    direction={sort.col === 'points_used' ? sort.dir : 'asc'}
                    onClick={() => handleSort('points_used')}
                  >
                    <strong>Points Used</strong>
                  </TableSortLabel>
                </TableCell>
                <TableCell><strong>Description</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRedemptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No redemptions recorded yet. Click "Add Redemption" to log one.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedRedemptions.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.account?.name ?? r.account_id}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={r.points_used.toLocaleString()}
                        color="warning"
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{r.description ?? '-'}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(r)}
                        title="Edit"
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => deleteMutation.mutate(r.id)}
                        title="Delete"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Bonus Points Table */}
      <Typography variant="h6" fontWeight="bold" mt={4} mb={2}>Bonus Points History</Typography>
      {bonusesLoading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} elevation={1}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell sortDirection={bonusSort.col === 'date' ? bonusSort.dir : false}>
                  <TableSortLabel
                    active={bonusSort.col === 'date'}
                    direction={bonusSort.col === 'date' ? bonusSort.dir : 'asc'}
                    onClick={() => setBonusSort(prev => ({ col: 'date', dir: prev.col === 'date' && prev.dir === 'asc' ? 'desc' : 'asc' }))}
                  >
                    <strong>Date</strong>
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={bonusSort.col === 'account' ? bonusSort.dir : false}>
                  <TableSortLabel
                    active={bonusSort.col === 'account'}
                    direction={bonusSort.col === 'account' ? bonusSort.dir : 'asc'}
                    onClick={() => setBonusSort(prev => ({ col: 'account', dir: prev.col === 'account' && prev.dir === 'asc' ? 'desc' : 'asc' }))}
                  >
                    <strong>Account</strong>
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={bonusSort.col === 'points' ? bonusSort.dir : false}>
                  <TableSortLabel
                    active={bonusSort.col === 'points'}
                    direction={bonusSort.col === 'points' ? bonusSort.dir : 'asc'}
                    onClick={() => setBonusSort(prev => ({ col: 'points', dir: prev.col === 'points' && prev.dir === 'asc' ? 'desc' : 'asc' }))}
                  >
                    <strong>Points</strong>
                  </TableSortLabel>
                </TableCell>
                <TableCell><strong>Description</strong></TableCell>
                <TableCell><strong>Source</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedBonuses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No bonus points recorded yet. Click "Add Bonus" to add one.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedBonuses.map((b) => (
                  <TableRow key={b.id} hover>
                    <TableCell>{b.date}</TableCell>
                    <TableCell>{b.account?.name ?? b.account_id}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={b.points.toLocaleString()}
                        color="info"
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{b.description ?? '-'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                      {b.source_file ?? 'manual'}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleOpenBonusDialog(b)} title="Edit">
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => deleteBonusMutation.mutate(b.id)}
                        title="Delete"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRedemption ? 'Edit Redemption' : 'Add Redemption'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} pt={1}>

              <Controller
                name="account_id"
                control={control}
                rules={{ required: 'Account is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Credit Card Account"
                    fullWidth
                    error={!!errors.account_id}
                    helperText={errors.account_id?.message}
                  >
                    {creditAccounts.map((acc) => (
                      <MenuItem key={acc.id} value={acc.id}>{acc.name}</MenuItem>
                    ))}
                  </TextField>
                )}
              />

              <Controller
                name="date"
                control={control}
                rules={{ required: 'Date is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Date"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    error={!!errors.date}
                    helperText={errors.date?.message}
                  />
                )}
              />

              <Controller
                name="points_used"
                control={control}
                rules={{
                  required: 'Points used is required',
                  min: { value: 0.01, message: 'Must be greater than 0' },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Points Used"
                    type="number"
                    fullWidth
                    inputProps={{ min: 0.01, step: 0.01 }}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    error={!!errors.points_used}
                    helperText={errors.points_used?.message}
                  />
                )}
              />

              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description (optional)"
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="e.g. Redeemed for cashback, flight booking, etc."
                  />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <CircularProgress size={20} />
              ) : editingRedemption ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {/* Add / Edit Bonus Dialog */}
      <Dialog open={bonusDialogOpen} onClose={handleCloseBonusDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingBonus ? 'Edit Bonus Points' : 'Add Bonus Points'}
        </DialogTitle>
        <form onSubmit={handleBonusSubmit(onBonusSubmit)}>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} pt={1}>

              <Controller
                name="account_id"
                control={bonusControl}
                rules={{ required: 'Account is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Credit Card Account"
                    fullWidth
                    error={!!bonusErrors.account_id}
                    helperText={bonusErrors.account_id?.message}
                  >
                    {creditAccounts.map((acc) => (
                      <MenuItem key={acc.id} value={acc.id}>{acc.name}</MenuItem>
                    ))}
                  </TextField>
                )}
              />

              <Controller
                name="date"
                control={bonusControl}
                rules={{ required: 'Date is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Date"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    error={!!bonusErrors.date}
                    helperText={bonusErrors.date?.message}
                  />
                )}
              />

              <Controller
                name="points"
                control={bonusControl}
                rules={{
                  required: 'Points is required',
                  min: { value: 0.01, message: 'Must be greater than 0' },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Bonus Points"
                    type="number"
                    fullWidth
                    inputProps={{ min: 0.01, step: 0.01 }}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    error={!!bonusErrors.points}
                    helperText={bonusErrors.points?.message}
                  />
                )}
              />

              <Controller
                name="description"
                control={bonusControl}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description (optional)"
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="e.g. DNP Quarterly Milestone New SMS50k"
                  />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseBonusDialog}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              color="info"
              disabled={createBonusMutation.isPending || updateBonusMutation.isPending}
            >
              {createBonusMutation.isPending || updateBonusMutation.isPending ? (
                <CircularProgress size={20} />
              ) : editingBonus ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default RewardPoints;

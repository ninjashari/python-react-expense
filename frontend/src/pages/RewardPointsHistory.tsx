import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Grid,
  Tabs,
  Tab,
  Divider,
} from '@mui/material';
import {
  ArrowBack,
  EmojiEvents,
  TrendingDown,
  TrendingUp,
  Remove,
  ViewList,
  CalendarMonth,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { accountsApi, rewardPointsApi } from '../services/api';
import { RewardPointHistoryItem } from '../types';
import { usePageTitle } from '../hooks/usePageTitle';

type TypeFilter = 'all' | 'earned' | 'deducted' | 'redeemed';
type SortDir = 'asc' | 'desc';
interface SortConfig { col: string; dir: SortDir }

// ─── helpers ─────────────────────────────────────────────────────────────────

const formatPoints = (n: number) =>
  Number.isInteger(n) ? n.toString() : n.toFixed(2);

const formatDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric',
  });
};

const typeColor = (type: string) =>
  type === 'earned' ? 'success.main' : type === 'deducted' ? 'warning.main' : 'error.main';

const TypeChip: React.FC<{ type: string }> = ({ type }) => {
  if (type === 'earned')
    return <Chip size="small" icon={<TrendingUp fontSize="small" />} label="Earned" color="success" variant="outlined" />;
  if (type === 'deducted')
    return <Chip size="small" icon={<Remove fontSize="small" />} label="Deducted" color="warning" variant="outlined" />;
  return <Chip size="small" icon={<TrendingDown fontSize="small" />} label="Redeemed" color="error" variant="outlined" />;
};

const sortItems = (items: RewardPointHistoryItem[], cfg: SortConfig) => {
  const mul = cfg.dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    switch (cfg.col) {
      case 'date':    return mul * (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      case 'points':  return mul * (a.points - b.points);
      case 'balance': return mul * (a.balance - b.balance);
      default:
        return mul * String(a[cfg.col as keyof RewardPointHistoryItem] ?? '')
          .localeCompare(String(b[cfg.col as keyof RewardPointHistoryItem] ?? ''));
    }
  });
};

// ─── Shared table body ────────────────────────────────────────────────────────

const HistoryRows: React.FC<{
  items: RewardPointHistoryItem[];
  showBalance?: boolean;
}> = ({ items, showBalance = true }) => (
  <>
    {items.map((item) => (
      <TableRow key={`${item.type}-${item.source_id}`} hover>
        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(item.date)}</TableCell>
        <TableCell>{item.account_name}</TableCell>
        <TableCell align="center"><TypeChip type={item.type} /></TableCell>
        <TableCell align="right" sx={{ fontWeight: 600, color: typeColor(item.type) }}>
          {item.type === 'earned' ? '+' : '-'}{formatPoints(item.points)}
        </TableCell>
        <TableCell sx={{ color: 'text.secondary', maxWidth: 260 }}>
          {item.description ?? '—'}
        </TableCell>
        {showBalance && (
          <TableCell
            align="right"
            sx={{
              fontWeight: 700,
              color: item.balance >= 0 ? 'text.primary' : 'error.main',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatPoints(item.balance)}
          </TableCell>
        )}
      </TableRow>
    ))}
  </>
);

// ─── Main component ───────────────────────────────────────────────────────────

const RewardPointsHistory: React.FC = () => {
  usePageTitle({ title: 'Reward Points History' });
  const navigate = useNavigate();

  const [selectedAccount, setSelectedAccount] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [tabValue, setTabValue] = useState(0);
  const [sort, setSort] = useState<SortConfig>({ col: 'date', dir: 'desc' });

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['accounts'], queryFn: accountsApi.getAll,
  });
  const creditAccounts = allAccounts.filter((a) => a.type === 'credit');

  const { data: history = [], isLoading, isError } = useQuery({
    queryKey: ['rewardPointsHistory', selectedAccount],
    queryFn: () => rewardPointsApi.getHistory(selectedAccount || undefined),
  });

  const handleSort = (col: string) =>
    setSort((prev) => ({ col, dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' }));

  // Filtered + sorted for List tab
  const filtered = useMemo(
    () => history.filter((i) => typeFilter === 'all' || i.type === typeFilter),
    [history, typeFilter],
  );
  const sorted = useMemo(() => sortItems(filtered, sort), [filtered, sort]);

  // Grouped by month for Monthly tab (sort within each group by same config)
  const byMonth = useMemo(() => {
    const map: Record<string, RewardPointHistoryItem[]> = {};
    for (const item of filtered) {
      const key = item.date.slice(0, 7);
      (map[key] ??= []).push(item);
    }
    return map;
  }, [filtered]);
  const monthKeys = useMemo(
    () => Object.keys(byMonth).sort().reverse(),
    [byMonth],
  );

  // Latest balance per account
  const latestBalance = useMemo(() => {
    const map: Record<string, { name: string; balance: number }> = {};
    for (const item of history) {
      if (!map[item.account_id])
        map[item.account_id] = { name: item.account_name, balance: item.balance };
    }
    return map;
  }, [history]);

  const SortableHeader: React.FC<{ col: string; align?: 'left' | 'right' | 'center'; children: React.ReactNode }> =
    ({ col, align = 'left', children }) => (
      <TableCell align={align}>
        <TableSortLabel
          active={sort.col === col}
          direction={sort.col === col ? sort.dir : 'asc'}
          onClick={() => handleSort(col)}
        >
          {children}
        </TableSortLabel>
      </TableCell>
    );

  const TableHeaders: React.FC<{ showBalance?: boolean }> = ({ showBalance = true }) => (
    <TableHead>
      <TableRow>
        <SortableHeader col="date">Date</SortableHeader>
        <SortableHeader col="account_name">Account</SortableHeader>
        <SortableHeader col="type" align="center">Type</SortableHeader>
        <SortableHeader col="points" align="right">Points</SortableHeader>
        <TableCell>Description</TableCell>
        {showBalance && <SortableHeader col="balance" align="right">Balance</SortableHeader>}
      </TableRow>
    </TableHead>
  );

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Box display="flex" alignItems="center" gap={1}>
          <Button variant="text" startIcon={<ArrowBack />} onClick={() => navigate('/reward-points')}>
            Back
          </Button>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEvents color="warning" /> Reward Points History
          </Typography>
        </Box>

        <Box display="flex" gap={1} flexWrap="wrap">
          {/* Type filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="earned">Earned</MenuItem>
              <MenuItem value="deducted">Deducted</MenuItem>
              <MenuItem value="redeemed">Redeemed</MenuItem>
            </Select>
          </FormControl>
          {/* Account filter */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Account</InputLabel>
            <Select value={selectedAccount} label="Account" onChange={(e) => setSelectedAccount(e.target.value)}>
              <MenuItem value="">All Accounts</MenuItem>
              {creditAccounts.map((acc) => (
                <MenuItem key={acc.id} value={acc.id}>{acc.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* ── Balance chips ───────────────────────────────────────────────── */}
      {Object.keys(latestBalance).length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {Object.entries(latestBalance).map(([id, { name, balance }]) => (
            <Chip
              key={id}
              icon={<EmojiEvents />}
              label={`${name}: ${formatPoints(balance)} pts`}
              color={balance >= 0 ? 'success' : 'error'}
              variant="outlined"
              size="small"
            />
          ))}
        </Box>
      )}

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      {history.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {[
            { label: 'Total Earned',   val: filtered.filter(i => i.type === 'earned').reduce((s, i) => s + i.points, 0),   color: 'success.main', sign: '+' },
            { label: 'Total Deducted', val: filtered.filter(i => i.type === 'deducted').reduce((s, i) => s + i.points, 0), color: 'warning.main', sign: '-' },
            { label: 'Total Redeemed', val: filtered.filter(i => i.type === 'redeemed').reduce((s, i) => s + i.points, 0), color: 'error.main',   sign: '-' },
            { label: 'Events',         val: filtered.length, color: 'text.primary', sign: '' },
          ].map(({ label, val, color, sign }) => (
            <Grid item xs={6} sm={3} key={label}>
              <Card>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h6" color={color} fontWeight={700}>
                    {sign}{typeof val === 'number' ? formatPoints(val) : val}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
      ) : isError ? (
        <Alert severity="error">Failed to load history.</Alert>
      ) : history.length === 0 ? (
        <Alert severity="info">
          No reward points activity{selectedAccount ? ' for this account' : ''}. Import credit card
          transactions with reward points or add a redemption to get started.
        </Alert>
      ) : (
        <Paper>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab icon={<ViewList />} iconPosition="start" label="List" />
            <Tab icon={<CalendarMonth />} iconPosition="start" label="Monthly" />
          </Tabs>

          {/* ── List tab ─────────────────────────────────────────────── */}
          {tabValue === 0 && (
            sorted.length === 0 ? (
              <Box p={3}><Alert severity="info">No entries match the selected filter.</Alert></Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHeaders showBalance />
                  <TableBody><HistoryRows items={sorted} showBalance /></TableBody>
                </Table>
              </TableContainer>
            )
          )}

          {/* ── Monthly tab ──────────────────────────────────────────── */}
          {tabValue === 1 && (
            <Box>
              {monthKeys.length === 0 ? (
                <Box p={3}><Alert severity="info">No entries match the selected filter.</Alert></Box>
              ) : (
                monthKeys.map((key, idx) => {
                  const items = sortItems(byMonth[key], sort);
                  const earned   = items.filter(i => i.type === 'earned').reduce((s, i) => s + i.points, 0);
                  const deducted = items.filter(i => i.type === 'deducted').reduce((s, i) => s + i.points, 0);
                  const redeemed = items.filter(i => i.type === 'redeemed').reduce((s, i) => s + i.points, 0);
                  const net = earned - deducted - redeemed;

                  return (
                    <Box key={key}>
                      {idx > 0 && <Divider />}
                      {/* Month header */}
                      <Box
                        display="flex" alignItems="center" flexWrap="wrap" gap={1}
                        px={2} py={1.5} sx={{ bgcolor: 'action.hover' }}
                      >
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mr: 1 }}>
                          {monthLabel(key)}
                        </Typography>
                        {earned > 0 && (
                          <Chip size="small" label={`+${formatPoints(earned)} earned`} color="success" variant="outlined" />
                        )}
                        {deducted > 0 && (
                          <Chip size="small" label={`−${formatPoints(deducted)} deducted`} color="warning" variant="outlined" />
                        )}
                        {redeemed > 0 && (
                          <Chip size="small" label={`−${formatPoints(redeemed)} redeemed`} color="error" variant="outlined" />
                        )}
                        <Chip
                          size="small"
                          label={`Net: ${net >= 0 ? '+' : ''}${formatPoints(net)}`}
                          color={net >= 0 ? 'default' : 'error'}
                          variant="filled"
                        />
                      </Box>
                      {/* Month rows — no Balance column in monthly view */}
                      <TableContainer>
                        <Table size="small">
                          <TableHeaders showBalance={false} />
                          <TableBody><HistoryRows items={items} showBalance={false} /></TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  );
                })
              )}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default RewardPointsHistory;

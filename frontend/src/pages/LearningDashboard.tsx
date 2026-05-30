import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Button,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Psychology as AIIcon,
  ModelTraining,
  CheckCircle,
  Cancel,
  TrendingUp,
  Speed as AccuracyIcon,
  Memory,
  Storage,
  AccountCircle,
  Label,
  Delete,
  TextFields,
  AttachMoney,
  Category,
  DeviceHub,
  CalendarToday,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useModelStatus,
  useLearningStatistics,
  usePerformanceAnalytics,
  useAccuracyAnalytics,
  useUserPatterns,
  useTrainModel,
  useDeletePattern,
} from '../hooks/useLearning';
import { usePageTitle, getPageTitle } from '../hooks/usePageTitle';

// ─── Tab panel wrapper ────────────────────────────────────────────────────────

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const confidenceColor = (c: number) => (c >= 0.8 ? 'success' : c >= 0.6 ? 'warning' : 'error') as 'success' | 'warning' | 'error';
const confidenceLabel = (c: number) => (c >= 0.8 ? 'High' : c >= 0.6 ? 'Medium' : 'Low');

// ─── Main component ───────────────────────────────────────────────────────────

const LearningDashboard: React.FC = () => {
  usePageTitle(getPageTitle('learning-dashboard', 'AI Learning'));
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [trainingResult, setTrainingResult] = useState<any>(null);

  const { data: modelStatus, isLoading: modelLoading } = useModelStatus();
  const { data: statsData } = useLearningStatistics();
  const { data: performanceData, isLoading: performanceLoading } = usePerformanceAnalytics();
  const { data: accuracyData, isLoading: accuracyLoading } = useAccuracyAnalytics();
  const { data: patternsData, isLoading: patternsLoading } = useUserPatterns();
  const trainModelMutation = useTrainModel();
  const deletePattern = useDeletePattern();

  const handleTrainModel = async () => {
    const confirmed = window.confirm(
      'Retrain the AI model from all historical transactions? This may take a moment.'
    );
    if (!confirmed) return;
    try {
      const result = await trainModelMutation.mutateAsync();
      setTrainingResult(result);
      queryClient.invalidateQueries({ queryKey: ['model-status'] });
    } catch (error: any) {
      setTrainingResult({ error: true, message: error.response?.data?.detail || 'Training failed' });
    }
  };

  const TrainButton = ({ fullWidth = false }) => (
    <Button
      variant="contained"
      startIcon={trainModelMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <ModelTraining />}
      onClick={handleTrainModel}
      disabled={trainModelMutation.isPending}
      fullWidth={fullWidth}
    >
      {trainModelMutation.isPending ? 'Training…' : 'Train Model'}
    </Button>
  );

  // ── Tab 0: Overview ──────────────────────────────────────────────────────────

  const OverviewTab = () => {
    if (modelLoading) return <CircularProgress />;
    const trained = modelStatus?.is_trained ?? false;
    const device = modelStatus?.device ?? 'n/a';

    return (
      <Grid container spacing={3}>
        {/* Stat cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Model Status</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                {trained
                  ? <CheckCircle color="success" />
                  : <Cancel color="disabled" />}
                <Typography variant="h6">{trained ? 'Trained' : 'Not Trained'}</Typography>
              </Box>
              {trained && (
                <Chip
                  size="small"
                  label={device.toUpperCase()}
                  color={device === 'cuda' ? 'success' : 'default'}
                  sx={{ mt: 1 }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Rules Built</Typography>
              <Typography variant="h4" color="primary">{modelStatus?.rules_built ?? 0}</Typography>
              <Typography variant="caption" color="text.secondary">Exact description rules</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Acceptance Rate</Typography>
              <Typography variant="h4" color="success.main">
                {statsData ? `${(statsData.success_rate * 100).toFixed(1)}%` : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">Suggestion acceptance</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Transactions Analyzed</Typography>
              <Typography variant="h4" color="info.main">{modelStatus?.total_transactions ?? 0}</Typography>
              <Typography variant="caption" color="text.secondary">In last training run</Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Train Model card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ModelTraining color="primary" /> Train Model
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Rebuilds the rule dictionary and XGBoost ML pipelines from your full transaction history.
                Run this after importing a large batch of transactions.
              </Typography>
              <TrainButton fullWidth />
            </CardContent>
          </Card>
        </Grid>

        {/* Payee→Category chain card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Storage color="primary" /> Payee→Category Links
              </Typography>
              <Typography variant="h4" color="secondary.main" sx={{ mb: 1 }}>
                {modelStatus?.payee_chain_entries ?? 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Automatic category mappings derived from your most common payee→category pairs.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // ── Tab 1: AI Model ──────────────────────────────────────────────────────────

  const AIModelTab = () => {
    if (modelLoading) return <CircularProgress />;

    const rows = [
      {
        component: 'Rule dictionary',
        value: modelStatus?.rules_built
          ? `${modelStatus.rules_built} rules`
          : 'Not built',
        trained: (modelStatus?.rules_built ?? 0) > 0,
      },
      {
        component: 'Payee→Category chain',
        value: modelStatus?.payee_chain_entries
          ? `${modelStatus.payee_chain_entries} links`
          : 'Not built',
        trained: (modelStatus?.payee_chain_entries ?? 0) > 0,
      },
      {
        component: 'Payee ML model',
        value: modelStatus?.payee_model_trained
          ? `Trained (${modelStatus.payee_training_samples} samples)`
          : 'Not trained',
        trained: modelStatus?.payee_model_trained ?? false,
      },
      {
        component: 'Category ML model',
        value: modelStatus?.category_model_trained
          ? `Trained (${modelStatus.category_training_samples} samples)`
          : 'Not trained',
        trained: modelStatus?.category_model_trained ?? false,
      },
      {
        component: 'XGBoost device',
        value: modelStatus?.device?.toUpperCase() ?? 'N/A',
        trained: modelStatus?.device === 'cuda',
        chipOverride: modelStatus?.device === 'cuda' ? 'success' : 'default',
      },
    ];

    const features = [
      { icon: <TextFields fontSize="small" />, label: 'Transaction description', detail: 'TF-IDF, 1–3 word n-grams' },
      { icon: <AttachMoney fontSize="small" />, label: 'Amount', detail: 'Raw value + log-scaled' },
      { icon: <Category fontSize="small" />, label: 'Amount bucket', detail: '0-500 / 500-2k / 2k-10k / 10k+' },
      { icon: <Label fontSize="small" />, label: 'Transaction type', detail: 'income / expense / transfer' },
      { icon: <AccountCircle fontSize="small" />, label: 'Account type', detail: 'savings / current / credit / …' },
      { icon: <DeviceHub fontSize="small" />, label: 'Account name', detail: 'Ordinal-encoded' },
      { icon: <CalendarToday fontSize="small" />, label: 'Day of week', detail: 'Cyclical sin/cos encoding' },
      { icon: <CalendarToday fontSize="small" />, label: 'Month of year', detail: 'Cyclical sin/cos encoding' },
    ];

    return (
      <Grid container spacing={3}>
        {/* Training breakdown table */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Training Breakdown</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Component</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.component}>
                        <TableCell>{r.component}</TableCell>
                        <TableCell>{r.value}</TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={r.trained ? 'Ready' : 'None'}
                            color={(r.chipOverride as any) ?? (r.trained ? 'success' : 'default')}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Features used */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Features Used by XGBoost</Typography>
              <List dense disablePadding>
                {features.map((f) => (
                  <ListItem key={f.label} disableGutters>
                    <ListItemIcon sx={{ minWidth: 32 }}>{f.icon}</ListItemIcon>
                    <ListItemText
                      primary={f.label}
                      secondary={f.detail}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Re-train */}
        <Grid item xs={12}>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <TrainButton />
          </Box>
        </Grid>
      </Grid>
    );
  };

  // ── Tab 2: Predictions ───────────────────────────────────────────────────────

  const PredictionsTab = () => {
    if (performanceLoading || accuracyLoading) return <CircularProgress />;
    if (!performanceData) return <Alert severity="info">No prediction data yet.</Alert>;

    const { overall_metrics, confidence_distribution } = performanceData;
    const total = overall_metrics.total_suggestions_made || 1;

    return (
      <Grid container spacing={3}>
        {/* Metric cards */}
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Suggestions Made</Typography>
              <Typography variant="h4" color="primary">{overall_metrics.total_suggestions_made}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Acceptance Rate</Typography>
              <Typography variant="h4" color="success.main">
                {overall_metrics.acceptance_rate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Last 7 Days</Typography>
              <Typography variant="h4" color="info.main">{overall_metrics.recent_suggestions_7_days}</Typography>
              <Typography variant="caption" color="text.secondary">New suggestions</Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Confidence distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Confidence Distribution</Typography>
              {[
                { label: 'High (≥ 80%)', value: confidence_distribution.high_confidence, color: 'success' as const },
                { label: 'Medium (60–79%)', value: confidence_distribution.medium_confidence, color: 'warning' as const },
                { label: 'Low (< 60%)', value: confidence_distribution.low_confidence, color: 'error' as const },
              ].map(({ label, value, color }) => (
                <Box key={label} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{label}</Typography>
                    <Typography variant="body2">{value}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(value / total) * 100}
                    color={color}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Field accuracy */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Field Accuracy</Typography>
              {accuracyLoading ? (
                <CircularProgress size={24} />
              ) : accuracyData?.field_accuracy?.length ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Field</TableCell>
                        <TableCell align="right">Avg Confidence</TableCell>
                        <TableCell align="right">Suggestions</TableCell>
                        <TableCell align="center">Performance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {accuracyData.field_accuracy.map((f) => (
                        <TableRow key={f.field_type}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {f.field_type === 'payee' ? <AccountCircle fontSize="small" /> : <Label fontSize="small" />}
                              {f.field_type.charAt(0).toUpperCase() + f.field_type.slice(1)}
                            </Box>
                          </TableCell>
                          <TableCell align="right">{(f.average_confidence * 100).toFixed(1)}%</TableCell>
                          <TableCell align="right">{f.suggestion_count}</TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={confidenceLabel(f.average_confidence)}
                              color={confidenceColor(f.average_confidence)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">No accuracy data yet.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // ── Tab 3: Patterns ──────────────────────────────────────────────────────────

  const PatternsTab = () => {
    if (patternsLoading) return <CircularProgress />;
    const patterns = patternsData ?? [];
    const withPayee = patterns.filter((p) => p.payee_name).length;
    const withCategory = patterns.filter((p) => p.category_name).length;

    return (
      <Grid container spacing={3}>
        {/* Summary cards */}
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Total Patterns</Typography>
              <Typography variant="h4" color="primary">{patterns.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>With Payee</Typography>
              <Typography variant="h4" color="secondary.main">{withPayee}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>With Category</Typography>
              <Typography variant="h4" color="info.main">{withCategory}</Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Pattern table */}
        <Grid item xs={12}>
          {patterns.length === 0 ? (
            <Alert severity="info">
              No patterns learned yet. The AI learns from your transaction edits and selections.
            </Alert>
          ) : (
            <Card>
              <CardContent>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Keywords</TableCell>
                        <TableCell>Payee</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell align="center">Success Rate</TableCell>
                        <TableCell align="center">Usage</TableCell>
                        <TableCell align="center">Confidence</TableCell>
                        <TableCell align="center">Delete</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {patterns.map((pattern) => {
                        const isDeleting =
                          deletePattern.isPending && deletePattern.variables === pattern.id;
                        return (
                          <TableRow key={pattern.id}>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {pattern.description_keywords.slice(0, 3).map((kw) => (
                                  <Chip key={kw} label={kw} size="small" variant="outlined" />
                                ))}
                              </Box>
                            </TableCell>
                            <TableCell>{pattern.payee_name ?? '—'}</TableCell>
                            <TableCell>{pattern.category_name ?? '—'}</TableCell>
                            <TableCell align="center">
                              <Chip
                                size="small"
                                label={`${(pattern.success_rate * 100).toFixed(0)}%`}
                                color={confidenceColor(pattern.success_rate)}
                              />
                            </TableCell>
                            <TableCell align="center">{pattern.usage_frequency}</TableCell>
                            <TableCell align="center">
                              <Chip
                                size="small"
                                label={`${(pattern.confidence_score * 100).toFixed(0)}%`}
                                color={confidenceColor(pattern.confidence_score)}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Delete pattern">
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={isDeleting}
                                  onClick={() => deletePattern.mutate(pattern.id)}
                                >
                                  {isDeleting ? <CircularProgress size={16} /> : <Delete />}
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Page header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon />
          AI Learning
        </Typography>
        <TrainButton />
      </Box>

      {/* Training result banner */}
      {trainingResult && (
        <Alert
          severity={trainingResult.error ? 'error' : 'success'}
          icon={trainingResult.error ? undefined : <ModelTraining />}
          onClose={() => setTrainingResult(null)}
          sx={{ mb: 2 }}
        >
          {trainingResult.error ? (
            trainingResult.message
          ) : (
            <Box>
              <Typography variant="subtitle2" gutterBottom>{trainingResult.message}</Typography>
              <Typography variant="body2">
                Model: {trainingResult.training_stats?.model_type} on {trainingResult.training_stats?.device?.toUpperCase()}
              </Typography>
              <Typography variant="body2">
                Transactions: {trainingResult.training_stats?.total_transactions} &nbsp;|&nbsp;
                Rules: {trainingResult.training_stats?.rules_built} &nbsp;|&nbsp;
                Payee→Category links: {trainingResult.training_stats?.payee_chain_entries}
              </Typography>
              <Typography variant="body2">
                Payee ML: {trainingResult.training_stats?.payee_model_trained
                  ? `trained (${trainingResult.training_stats?.payee_training_samples} samples)`
                  : 'not trained'} &nbsp;|&nbsp;
                Category ML: {trainingResult.training_stats?.category_model_trained
                  ? `trained (${trainingResult.training_stats?.category_training_samples} samples)`
                  : 'not trained'}
              </Typography>
            </Box>
          )}
        </Alert>
      )}

      {/* Tabs */}
      <Paper>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          aria-label="AI Learning tabs"
        >
          <Tab label="Overview" icon={<TrendingUp />} iconPosition="start" />
          <Tab label="AI Model" icon={<Memory />} iconPosition="start" />
          <Tab label="Predictions" icon={<AccuracyIcon />} iconPosition="start" />
          <Tab label="Patterns" icon={<Storage />} iconPosition="start" />
        </Tabs>

        <TabPanel value={tabValue} index={0}><OverviewTab /></TabPanel>
        <TabPanel value={tabValue} index={1}><AIModelTab /></TabPanel>
        <TabPanel value={tabValue} index={2}><PredictionsTab /></TabPanel>
        <TabPanel value={tabValue} index={3}><PatternsTab /></TabPanel>
      </Paper>
    </Box>
  );
};

export default LearningDashboard;

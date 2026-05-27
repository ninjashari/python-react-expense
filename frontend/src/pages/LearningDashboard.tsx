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
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  Psychology as AIIcon,
  Analytics as AnalyticsIcon,
  Pattern as PatternIcon,
  Speed as AccuracyIcon,
  Delete,
  Refresh,
  Info,
  CheckCircle,
  ModelTraining,
} from '@mui/icons-material';
import { 
  usePerformanceAnalytics, 
  usePatternAnalytics, 
  useAccuracyAnalytics,
  useLearningStatistics,
  useUserPatterns,
  useTrainModel
} from '../hooks/useLearning';
import { usePageTitle, getPageTitle } from '../hooks/usePageTitle';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`learning-tabpanel-${index}`}
      aria-labelledby={`learning-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const LearningDashboard: React.FC = () => {
  usePageTitle(getPageTitle('learning-dashboard', 'Learning Analytics'));
  const [tabValue, setTabValue] = useState(0);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [trainingResult, setTrainingResult] = useState<any>(null);

  // Load analytics data
  const { data: performanceData, isLoading: performanceLoading, error: performanceError } = usePerformanceAnalytics();
  const { data: patternData, isLoading: patternLoading, error: patternError } = usePatternAnalytics();
  const { data: accuracyData, isLoading: accuracyLoading, error: accuracyError } = useAccuracyAnalytics();
  const { data: statsData } = useLearningStatistics();
  const { data: patternsData, isLoading: patternsDataLoading } = useUserPatterns();
  const trainModelMutation = useTrainModel();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  const handleTrainModel = async () => {
    const confirmed = window.confirm(
      'This will retrain the AI model using your historical transaction data. ' +
      'This may take a few moments. Continue?'
    );

    if (!confirmed) return;

    try {
      const result = await trainModelMutation.mutateAsync();
      setTrainingResult(result);
    } catch (error: any) {
      setTrainingResult({
        error: true,
        message: error.response?.data?.detail || 'Failed to train model'
      });
    }
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  // Performance Overview Component
  const PerformanceOverview = () => {
    if (performanceLoading) return <CircularProgress />;
    if (performanceError) return <Alert severity="error">Error loading performance data</Alert>;
    if (!performanceData) return <Alert severity="info">No performance data available</Alert>;

    const { overall_metrics, confidence_distribution, top_patterns } = performanceData;

    return (
      <Grid container spacing={3}>
        {/* Key Metrics */}
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="primary" />
            Performance Overview
          </Typography>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Suggestions
              </Typography>
              <Typography variant="h4" component="div" color="primary">
                {overall_metrics.total_suggestions_made}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Acceptance Rate
              </Typography>
              <Typography variant="h4" component="div" color="success.main">
                {overall_metrics.acceptance_rate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Recent Activity
              </Typography>
              <Typography variant="h4" component="div" color="info.main">
                {overall_metrics.recent_suggestions_7_days}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Last 7 days
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                High Confidence
              </Typography>
              <Typography variant="h4" component="div" color="success.main">
                {confidence_distribution.high_confidence}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Suggestions ≥80%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Confidence Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Confidence Distribution
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">High (≥80%)</Typography>
                  <Typography variant="body2">{confidence_distribution.high_confidence}</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={(confidence_distribution.high_confidence / overall_metrics.total_suggestions_made) * 100}
                  color="success"
                  sx={{ mb: 2 }}
                />
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Medium (60-79%)</Typography>
                  <Typography variant="body2">{confidence_distribution.medium_confidence}</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={(confidence_distribution.medium_confidence / overall_metrics.total_suggestions_made) * 100}
                  color="warning"
                  sx={{ mb: 2 }}
                />
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Low (&lt;60%)</Typography>
                  <Typography variant="body2">{confidence_distribution.low_confidence}</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={(confidence_distribution.low_confidence / overall_metrics.total_suggestions_made) * 100}
                  color="error"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Patterns */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Most Successful Patterns
              </Typography>
              <List>
                {top_patterns.slice(0, 5).map((pattern, index) => (
                  <ListItem key={pattern.id}>
                    <ListItemIcon>
                      <Chip 
                        label={`${(pattern.success_rate * 100).toFixed(0)}%`} 
                        size="small" 
                        color={getConfidenceColor(pattern.success_rate)}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box>
                          {pattern.keywords.join(', ')}
                          {pattern.payee_name && (
                            <Chip 
                              label={`→ ${pattern.payee_name}`} 
                              size="small" 
                              variant="outlined" 
                              sx={{ ml: 1 }} 
                            />
                          )}
                          {pattern.category_name && (
                            <Chip 
                              label={`→ ${pattern.category_name}`} 
                              size="small" 
                              variant="outlined" 
                              sx={{ ml: 1 }} 
                            />
                          )}
                        </Box>
                      }
                      secondary={`Used ${pattern.usage_frequency} times`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Pattern Analytics Component
  const PatternAnalytics = () => {
    if (patternLoading) return <CircularProgress />;
    if (patternError) return <Alert severity="error">Error loading pattern data</Alert>;
    if (!patternData) return <Alert severity="info">No pattern data available</Alert>;

    const { pattern_distribution, keyword_insights } = patternData;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PatternIcon color="primary" />
            Pattern Analytics
          </Typography>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Patterns
              </Typography>
              <Typography variant="h4" component="div">
                {pattern_distribution.total_patterns}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Category Patterns
              </Typography>
              <Typography variant="h4" component="div" color="info.main">
                {pattern_distribution.by_category}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Payee Patterns
              </Typography>
              <Typography variant="h4" component="div" color="secondary.main">
                {pattern_distribution.by_payee}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Keyword Insights
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Total unique keywords: {keyword_insights.total_unique_keywords}
              </Typography>
              <List>
                {keyword_insights.most_frequent_keywords.slice(0, 8).map((keyword) => (
                  <ListItem key={keyword.keyword} dense>
                    <ListItemText
                      primary={keyword.keyword}
                      secondary={`Used ${keyword.frequency} times`}
                    />
                    <Box sx={{ minWidth: 80 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={(keyword.frequency / keyword_insights.most_frequent_keywords[0]?.frequency) * 100}
                        color="primary"
                      />
                    </Box>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pattern Management
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Manage your learned transaction patterns
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button variant="outlined" startIcon={<Refresh />}>
                  Refresh Patterns
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  startIcon={<Delete />}
                  onClick={() => setResetDialogOpen(true)}
                >
                  Reset All Patterns
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Accuracy Analytics Component
  const AccuracyAnalytics = () => {
    if (accuracyLoading) return <CircularProgress />;
    if (accuracyError) return <Alert severity="error">Error loading accuracy data</Alert>;
    if (!accuracyData) return <Alert severity="info">No accuracy data available</Alert>;

    const { field_accuracy } = accuracyData;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccuracyIcon color="primary" />
            Accuracy Analytics
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Field-Specific Accuracy
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Field Type</TableCell>
                      <TableCell align="right">Average Confidence</TableCell>
                      <TableCell align="right">Suggestions Made</TableCell>
                      <TableCell align="center">Performance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {field_accuracy.map((field) => (
                      <TableRow key={field.field_type}>
                        <TableCell component="th" scope="row">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {field.field_type === 'payee' ? '👤' : '📁'}
                            {field.field_type.charAt(0).toUpperCase() + field.field_type.slice(1)}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {(field.average_confidence * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell align="right">
                          {field.suggestion_count}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={getConfidenceLabel(field.average_confidence)}
                            color={getConfidenceColor(field.average_confidence)}
                            size="small"
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
      </Grid>
    );
  };

  // Pattern Management Component
  const PatternManagement = () => {
    if (patternsDataLoading) return <CircularProgress />;
    if (!patternsData) return <Alert severity="info">No patterns learned yet</Alert>;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PatternIcon color="primary" />
            Pattern Management
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Pattern Keywords</TableCell>
                      <TableCell>Payee</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell align="center">Success Rate</TableCell>
                      <TableCell align="center">Usage</TableCell>
                      <TableCell align="center">Confidence</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {patternsData.map((pattern) => (
                      <TableRow key={pattern.id}>
                        <TableCell>
                          <Box>
                            {pattern.description_keywords.slice(0, 3).map((keyword) => (
                              <Chip key={keyword} label={keyword} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>{pattern.payee_name || '-'}</TableCell>
                        <TableCell>{pattern.category_name || '-'}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${(pattern.success_rate * 100).toFixed(0)}%`}
                            color={getConfidenceColor(pattern.success_rate)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">{pattern.usage_frequency}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${(pattern.confidence_score * 100).toFixed(0)}%`}
                            color={getConfidenceColor(pattern.confidence_score)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Delete pattern">
                            <IconButton size="small" color="error">
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon />
          Learning Analytics
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Retrain AI model using your historical transaction data">
            <Button
              variant="outlined"
              startIcon={<ModelTraining />}
              onClick={handleTrainModel}
              disabled={trainModelMutation.isPending}
            >
              {trainModelMutation.isPending ? 'Training...' : 'Train Model'}
            </Button>
          </Tooltip>
          <Tooltip title="View learning system insights and performance metrics">
            <IconButton>
              <Info />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Training Results */}
      {trainingResult && (
        <Alert 
          severity={trainingResult.error ? 'error' : 'success'}
          onClose={() => setTrainingResult(null)}
          sx={{ mb: 2 }}
        >
          {trainingResult.error ? (
            trainingResult.message
          ) : (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {trainingResult.message}
              </Typography>
              <Typography variant="body2">
                • Transactions analyzed: {trainingResult.training_stats?.total_transactions || 0}
              </Typography>
              <Typography variant="body2">
                • Payee patterns learned: {trainingResult.training_stats?.payee_patterns_learned || 0}
              </Typography>
              <Typography variant="body2">
                • Category patterns learned: {trainingResult.training_stats?.category_patterns_learned || 0}
              </Typography>
            </Box>
          )}
        </Alert>
      )}

      {/* Overview Cards */}
      {statsData && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle color="success" />
                  <Box>
                    <Typography variant="h6">{statsData.total_suggestions_made}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Suggestions
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUp color="primary" />
                  <Box>
                    <Typography variant="h6">{(statsData.success_rate * 100).toFixed(1)}%</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Success Rate
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PatternIcon color="info" />
                  <Box>
                    <Typography variant="h6">{statsData.total_patterns_learned}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Patterns Learned
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccuracyIcon color="secondary" />
                  <Box>
                    <Typography variant="h6">{(statsData.average_confidence * 100).toFixed(1)}%</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Avg Confidence
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="learning analytics tabs">
          <Tab label="Performance" icon={<TrendingUp />} />
          <Tab label="Patterns" icon={<PatternIcon />} />
          <Tab label="Accuracy" icon={<AccuracyIcon />} />
          <Tab label="Management" icon={<AnalyticsIcon />} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <PerformanceOverview />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <PatternAnalytics />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <AccuracyAnalytics />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <PatternManagement />
        </TabPanel>
      </Paper>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
        <DialogTitle>Reset Learning Patterns</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will permanently delete all learned patterns and start fresh. This action cannot be undone.
          </Alert>
          <Typography>
            Are you sure you want to reset all learning patterns? The AI will need to relearn your preferences.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error">
            Reset All Patterns
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LearningDashboard;
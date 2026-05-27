import React from 'react';
import {
  Box,
  Typography,
  Alert,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Chip,
  Divider,
  Grid,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Refresh,
  TrendingUp,
} from '@mui/icons-material';

interface ImportResultsProps {
  results: {
    message: string;
    transactions_created: number;
    errors: string[];
  } | null;
  onStartOver: () => void;
}

const ImportResults: React.FC<ImportResultsProps> = ({
  results,
  onStartOver,
}) => {
  if (!results) {
    return (
      <Box textAlign="center">
        <Typography variant="h6">No results to display</Typography>
      </Box>
    );
  }

  const hasErrors = results.errors && results.errors.length > 0;
  const successCount = results.transactions_created || 0;
  const errorCount = results.errors?.length || 0;
  const totalProcessed = successCount + errorCount;

  const getSeverity = () => {
    if (successCount === 0 && hasErrors) return 'error';
    if (hasErrors) return 'warning';
    return 'success';
  };

  const getStatusIcon = () => {
    switch (getSeverity()) {
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      default:
        return <CheckCircle color="success" />;
    }
  };

  const getStatusMessage = () => {
    if (successCount === 0 && hasErrors) {
      return 'Import failed - no transactions were created';
    }
    if (hasErrors) {
      return 'Import completed with some errors';
    }
    return 'Import completed successfully!';
  };

  return (
    <Box>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        {getStatusIcon()}
        <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>
          {getStatusMessage()}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {results.message}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Summary Statistics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Import Summary
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Transactions Created"
                    secondary={`${successCount} transaction${successCount !== 1 ? 's' : ''}`}
                  />
                  <Chip
                    label={successCount.toString()}
                    color="success"
                    size="small"
                  />
                </ListItem>
                
                {hasErrors && (
                  <ListItem>
                    <ListItemIcon>
                      <Error color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Errors Encountered"
                      secondary={`${errorCount} row${errorCount !== 1 ? 's' : ''} with errors`}
                    />
                    <Chip
                      label={errorCount.toString()}
                      color="error"
                      size="small"
                    />
                  </ListItem>
                )}

                <ListItem>
                  <ListItemIcon>
                    <TrendingUp />
                  </ListItemIcon>
                  <ListItemText
                    primary="Success Rate"
                    secondary={`${totalProcessed > 0 ? Math.round((successCount / totalProcessed) * 100) : 0}%`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Actions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Next Steps
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={onStartOver}
                  fullWidth
                >
                  Import Another File
                </Button>
                
                {successCount > 0 && (
                  <Button
                    variant="outlined"
                    href="/transactions"
                    fullWidth
                  >
                    View Imported Transactions
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Error Details */}
        {hasErrors && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="error">
                  Error Details
                </Typography>
                <Alert severity="error" sx={{ mb: 2 }}>
                  The following rows could not be imported. Please check your data and try again:
                </Alert>
                
                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {results.errors.map((error, index) => (
                    <Box key={index}>
                      <Typography variant="body2" color="error" sx={{ py: 1 }}>
                        {error}
                      </Typography>
                      {index < results.errors.length - 1 && <Divider />}
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Success Tips */}
        {successCount > 0 && (
          <Grid item xs={12}>
            <Alert severity="success">
              <Typography variant="subtitle2" gutterBottom>
                Import successful! Here's what happened:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Created {successCount} new transaction{successCount !== 1 ? 's' : ''}</li>
                <li>New payees and categories were automatically created</li>
                <li>All transactions are now visible in your transactions list</li>
                <li>Account balances have been updated</li>
              </ul>
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default ImportResults;
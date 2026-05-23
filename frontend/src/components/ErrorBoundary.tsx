import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Typography, Alert, Card, CardContent } from '@mui/material';
import { Refresh, BugReport } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error reporting service
      // errorReportingService.captureException(error, { extra: errorInfo });
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          bgcolor="grey.50"
          p={3}
        >
          <Card sx={{ maxWidth: 600, width: '100%' }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" mb={3}>
                <BugReport color="error" sx={{ mr: 2, fontSize: 40 }} />
                <Typography variant="h4" component="h1" color="error">
                  Oops! Something went wrong
                </Typography>
              </Box>

              <Alert severity="error" sx={{ mb: 3 }}>
                <Typography variant="body1" gutterBottom>
                  We're sorry, but something unexpected happened. The application encountered an error and couldn't continue.
                </Typography>
              </Alert>

              <Box display="flex" gap={2} mb={3}>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={this.handleReload}
                  color="primary"
                >
                  Reload Page
                </Button>
                <Button
                  variant="outlined"
                  onClick={this.handleReset}
                  color="secondary"
                >
                  Try Again
                </Button>
              </Box>

              {/* Show error details in development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Box mt={3}>
                  <Typography variant="h6" gutterBottom>
                    Error Details (Development Mode):
                  </Typography>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2" component="pre" sx={{ 
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem'
                    }}>
                      {this.state.error.name}: {this.state.error.message}
                    </Typography>
                  </Alert>
                  
                  {this.state.error.stack && (
                    <Alert severity="info">
                      <Typography variant="body2" component="pre" sx={{ 
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                        fontSize: '0.7rem',
                        maxHeight: '200px',
                        overflow: 'auto'
                      }}>
                        {this.state.error.stack}
                      </Typography>
                    </Alert>
                  )}
                </Box>
              )}

              <Typography variant="body2" color="textSecondary" mt={3}>
                If this problem persists, please contact support or try refreshing the page.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
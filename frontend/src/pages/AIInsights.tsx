import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  Send as SendIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';
import { useQueryData, useQuestionSuggestions } from '../hooks/useOptimizedQueries';
import { QueryResponse } from '../types';
import { formatCurrency } from '../utils/formatters';

const AIInsights: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [currentResult, setCurrentResult] = useState<QueryResponse | null>(null);

  // Hooks
  const queryDataMutation = useQueryData();
  const { data: suggestions, isLoading: suggestionsLoading } = useQuestionSuggestions();

  const handleAskQuestion = async () => {
    if (!question.trim()) return;

    try {
      const result = await queryDataMutation.mutateAsync({
        question: question.trim(),
      });
      setCurrentResult(result);
    } catch (error) {
      console.error('Failed to execute query:', error);
    }
  };

  const handleSuggestionClick = (suggestedQuestion: string) => {
    setQuestion(suggestedQuestion);
  };

  const formatCellValue = (value: any, column: string): string => {
    if (value === null || value === undefined) return '-';
    
    // Format currency columns
    if (column.toLowerCase().includes('amount') || 
        column.toLowerCase().includes('balance') || 
        column.toLowerCase().includes('total')) {
      return formatCurrency(value);
    }
    
    // Format dates
    if (column.toLowerCase().includes('date') && typeof value === 'string') {
      try {
        return new Date(value).toLocaleDateString('en-IN');
      } catch {
        return value;
      }
    }
    
    return String(value);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PsychologyIcon color="primary" />
          AI Data Query
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Ask questions about your financial data and get results in table format
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Question Input */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Ask Your Question
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., Show me all my food expenses last month, What are my top 5 highest transactions?, List all my credit card accounts and balances"
                  variant="outlined"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskQuestion();
                    }
                  }}
                />
              </Box>

              <Button
                variant="contained"
                onClick={handleAskQuestion}
                disabled={!question.trim() || queryDataMutation.isPending}
                startIcon={queryDataMutation.isPending ? <CircularProgress size={20} /> : <SendIcon />}
                fullWidth
              >
                {queryDataMutation.isPending ? 'Querying Data...' : 'Get Data'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Question Suggestions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Sample Questions
              </Typography>
              {suggestionsLoading ? (
                <CircularProgress />
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {suggestions?.suggestions.map((suggestion, index) => (
                    <Chip
                      key={index}
                      label={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      clickable
                      variant="outlined"
                      size="small"
                      sx={{ 
                        justifyContent: 'flex-start',
                        height: 'auto',
                        padding: '8px',
                        '& .MuiChip-label': {
                          whiteSpace: 'normal',
                          textAlign: 'left'
                        }
                      }}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Query Results */}
        {currentResult && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TableChartIcon color="primary" />
                  Query Results
                  <Chip 
                    label={`${currentResult.total_records} records`} 
                    size="small" 
                    color="primary" 
                    variant="outlined" 
                  />
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {currentResult.description}
                </Typography>

                {currentResult.data.length === 0 ? (
                  <Alert severity="info">
                    No data found for your query. Try a different question.
                  </Alert>
                ) : (
                  <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          {currentResult.columns.map((column) => (
                            <TableCell key={column} sx={{ fontWeight: 'bold' }}>
                              {column.charAt(0).toUpperCase() + column.slice(1).replace(/_/g, ' ')}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {currentResult.data.map((row, index) => (
                          <TableRow key={index} hover>
                            {currentResult.columns.map((column) => (
                              <TableCell key={column}>
                                {formatCellValue(row[column], column)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Error Display */}
        {queryDataMutation.isError && (
          <Grid item xs={12}>
            <Alert severity="error">
              {queryDataMutation.error?.message || 'Failed to execute query. Please try again.'}
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default AIInsights;
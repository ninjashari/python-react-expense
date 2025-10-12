import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpIcon,
  QuestionAnswer as QuestionAnswerIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useAskInsight, useFinancialContext, useQuestionSuggestions } from '../hooks/useOptimizedQueries';
import { InsightResponse } from '../types';
import { formatCurrency } from '../utils/formatters';

const AIInsights: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [timeframe, setTimeframe] = useState<string>('all_time');
  const [currentInsight, setCurrentInsight] = useState<InsightResponse | null>(null);

  // Hooks
  const askInsightMutation = useAskInsight();
  const { data: financialContext, isLoading: contextLoading, refetch: refetchContext } = useFinancialContext(timeframe);
  const { data: suggestions, isLoading: suggestionsLoading } = useQuestionSuggestions();

  const handleAskQuestion = async () => {
    if (!question.trim()) return;

    try {
      const result = await askInsightMutation.mutateAsync({
        question: question.trim(),
        timeframe: timeframe === 'all_time' ? undefined : timeframe,
      });
      setCurrentInsight(result);
    } catch (error) {
      console.error('Failed to get insight:', error);
    }
  };

  const handleSuggestionClick = (suggestedQuestion: string) => {
    setQuestion(suggestedQuestion);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PsychologyIcon color="primary" />
          AI Financial Insights
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Ask questions about your financial data and get AI-powered insights
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Question Input & Suggestions */}
        <Grid item xs={12} md={6}>
          {/* Question Input */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <QuestionAnswerIcon />
                Ask Your Question
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Time Period</InputLabel>
                  <Select
                    value={timeframe}
                    label="Time Period"
                    onChange={(e) => setTimeframe(e.target.value)}
                  >
                    <MenuItem value="last_month">Last Month</MenuItem>
                    <MenuItem value="last_3_months">Last 3 Months</MenuItem>
                    <MenuItem value="last_year">Last Year</MenuItem>
                    <MenuItem value="all_time">All Time</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., How much did I spend on food last month? What are my top expense categories?"
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
                disabled={!question.trim() || askInsightMutation.isPending}
                startIcon={askInsightMutation.isPending ? <CircularProgress size={20} /> : <SendIcon />}
                fullWidth
              >
                {askInsightMutation.isPending ? 'Analyzing...' : 'Get Insight'}
              </Button>
            </CardContent>
          </Card>

          {/* Question Suggestions */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Suggested Questions
              </Typography>
              {suggestionsLoading ? (
                <CircularProgress />
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {suggestions?.suggestions.map((suggestion, index) => (
                    <Chip
                      key={index}
                      label={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      clickable
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Financial Context */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUpIcon />
                  Financial Overview
                </Typography>
                <Tooltip title="Refresh Data">
                  <IconButton onClick={() => refetchContext()} disabled={contextLoading}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>

              {contextLoading ? (
                <CircularProgress />
              ) : financialContext ? (
                <Box>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h6" color="success.main">
                          {formatCurrency(financialContext.total_income)}
                        </Typography>
                        <Typography variant="caption">Income</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h6" color="error.main">
                          {formatCurrency(financialContext.total_expenses)}
                        </Typography>
                        <Typography variant="caption">Expenses</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h6" color={financialContext.net_savings >= 0 ? 'success.main' : 'error.main'}>
                          {formatCurrency(financialContext.net_savings)}
                        </Typography>
                        <Typography variant="caption">Net Savings</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h6">
                          {formatCurrency(financialContext.current_net_worth)}
                        </Typography>
                        <Typography variant="caption">Net Worth</Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>Top Categories</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {Object.entries(financialContext.top_categories).slice(0, 5).map(([category, amount]) => (
                          <ListItem key={category}>
                            <ListItemText 
                              primary={category} 
                              secondary={formatCurrency(amount)} 
                            />
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>Account Balances</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {Object.entries(financialContext.accounts).map(([accountName, account]) => (
                          <ListItem key={accountName}>
                            <ListItemText 
                              primary={accountName} 
                              secondary={`${account.type} - ${formatCurrency(account.balance)}`} 
                            />
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              ) : (
                <Alert severity="info">No financial data available</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* AI Insight Response */}
        {currentInsight && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PsychologyIcon color="primary" />
                  AI Insight
                  <Chip 
                    label={`${Math.round(currentInsight.confidence * 100)}% confidence`} 
                    size="small" 
                    color="primary" 
                    variant="outlined" 
                  />
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {currentInsight.answer}
                  </Typography>
                </Box>

                {currentInsight.related_transactions.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Related Transactions
                    </Typography>
                    <List>
                      {currentInsight.related_transactions.slice(0, 5).map((transaction) => (
                        <ListItem key={transaction.id} divider>
                          <ListItemText
                            primary={transaction.description}
                            secondary={
                              <Box>
                                <Typography variant="body2" component="span">
                                  {new Date(transaction.date).toLocaleDateString()} • 
                                  {formatCurrency(transaction.amount)} • 
                                  {transaction.type}
                                </Typography>
                                {transaction.category && (
                                  <Chip 
                                    label={transaction.category.name} 
                                    size="small" 
                                    sx={{ ml: 1 }} 
                                  />
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Error Display */}
        {askInsightMutation.isError && (
          <Grid item xs={12}>
            <Alert severity="error">
              {askInsightMutation.error?.message || 'Failed to generate insight. Please try again.'}
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default AIInsights;
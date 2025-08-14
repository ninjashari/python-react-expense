import api from './api';

// Types for Learning API
export interface SmartSuggestionRequest {
  description: string;
  amount?: number;
  account_id?: string;
  account_type?: string;
}

export interface SuggestionItem {
  id: string;
  name: string;
  type: 'ai_suggestion' | 'historical' | 'existing' | 'create_new';
  confidence: number;
  reason: string;
  usage_count?: number;
  color?: string; // For categories
}

export interface SmartSuggestionResponse {
  payee_suggestions: SuggestionItem[];
  category_suggestions: SuggestionItem[];
  confidence_explanation?: string;
}

export interface UserSelectionRequest {
  transaction_id: string;
  field_type: 'payee' | 'category';
  selected_value_id?: string;
  selected_value_name: string;
  transaction_description?: string;
  transaction_amount?: number;
  account_type?: string;
  was_suggested: boolean;
  suggestion_confidence?: number;
  selection_method: 'manual' | 'inline_edit' | 'form_edit' | 'form_create';
}

export interface LearningFeedbackRequest {
  suggestion_id: string;
  was_accepted: boolean;
  user_selected_id?: string;
  user_selected_name?: string;
  transaction_context: Record<string, any>;
}

export interface UserTransactionPattern {
  id: string;
  description_keywords: string[];
  payee_name?: string;
  category_name?: string;
  confidence_score: number;
  usage_frequency: number;
  success_rate: number;
  last_used: string;
  created_at: string;
}

export interface LearningStatistics {
  total_suggestions_made: number;
  total_suggestions_accepted: number;
  total_patterns_learned: number;
  average_confidence: number;
  success_rate: number;
  last_updated: string;
}

export interface PerformanceAnalytics {
  overall_metrics: {
    total_suggestions_made: number;
    total_suggestions_accepted: number;
    acceptance_rate: number;
    recent_suggestions_7_days: number;
  };
  confidence_distribution: {
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
  };
  top_patterns: Array<{
    id: string;
    keywords: string[];
    payee_name?: string;
    category_name?: string;
    success_rate: number;
    usage_frequency: number;
    confidence_score: number;
  }>;
}

export interface PatternAnalytics {
  pattern_distribution: {
    by_category: number;
    by_payee: number;
    total_patterns: number;
  };
  keyword_insights: {
    total_unique_keywords: number;
    most_frequent_keywords: Array<{
      keyword: string;
      frequency: number;
    }>;
  };
  category_breakdown: Array<{
    category_id?: string;
    pattern_count: number;
    average_confidence: number;
  }>;
  payee_breakdown: Array<{
    payee_id?: string;
    pattern_count: number;
    average_confidence: number;
  }>;
}

export interface AccuracyAnalytics {
  daily_accuracy: Array<{
    date: string;
    total_suggestions: number;
    accurate_suggestions: number;
    accuracy_rate: number;
  }>;
  field_accuracy: Array<{
    field_type: 'payee' | 'category';
    average_confidence: number;
    suggestion_count: number;
  }>;
}

export interface AutoCategorizationResult {
  status: string;
  message: string;
  categorized_transactions: Array<{
    transaction_id: string;
    description: string;
    updates: Record<string, string>;
    confidence: number;
  }>;
  total_processed: number;
}

export interface BulkProcessResult {
  status: string;
  action: string;
  processed_count: number;
  results: Array<{
    transaction_id: string;
    description: string;
    suggestions?: {
      payee: SuggestionItem[];
      category: SuggestionItem[];
    };
    potential_duplicates?: Array<{
      id: string;
      date: string;
      description: string;
      similarity_score: number;
    }>;
  }>;
}

export interface SmartImportResult {
  status: string;
  processed_data: Array<{
    [key: string]: any;
    ai_suggestions?: {
      payee?: SuggestionItem;
      category?: SuggestionItem;
      confidence_score: number;
    };
  }>;
  total_rows: number;
  rows_with_suggestions: number;
}

export interface SpendingPrediction {
  month: number;
  year: number;
  month_name: string;
  category_id: string;
  category_name: string;
  category_color: string;
  predicted_amount: number;
  predicted_transactions: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface SpendingPredictionsResult {
  predictions: SpendingPrediction[];
  total_months_analyzed: number;
  categories_with_predictions: number;
}

export interface SpendingAnomaly {
  type: 'large_amount' | 'unusual_frequency' | 'new_payee_spending';
  transaction_id?: string;
  date?: string;
  description?: string;
  amount?: number;
  category_name?: string;
  payee_name?: string;
  severity: 'high' | 'medium' | 'low';
  baseline_mean?: number;
  deviation_factor?: number;
  recent_count?: number;
  expected_count?: number;
  frequency_factor?: number;
  total_amount?: number;
  transaction_count?: number;
}

export interface AnomaliesResult {
  anomalies: SpendingAnomaly[];
  summary: {
    total_anomalies: number;
    high_severity: number;
    medium_severity: number;
    analysis_period: string;
    baseline_period: string;
  };
}

export interface BudgetRecommendation {
  category_id: string;
  category_name: string;
  category_color: string;
  current_avg_spending: number;
  recommended_budget: number;
  spending_variance: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  months_analyzed: number;
  savings_opportunity: number;
}

export interface BudgetRecommendationsResult {
  category_recommendations: BudgetRecommendation[];
  summary: {
    total_recommended_budget: number;
    average_monthly_income: number;
    recommended_savings_rate: number;
    budget_feasibility: 'good' | 'tight' | 'over_budget';
    total_categories: number;
  };
  insights: {
    highest_spending_category?: string;
    most_variable_category?: string;
    best_savings_opportunity?: string;
  };
}

export interface TrendForecast {
  month: number;
  year: number;
  month_name: string;
  forecasted_expense: number;
  forecasted_income: number;
  forecasted_net_income: number;
  confidence: number;
}

export interface TrendForecastResult {
  historical_data: Array<{
    month: number;
    year: number;
    month_name: string;
    income: number;
    expense: number;
    transfer: number;
    net_income: number;
    transaction_counts: {
      income: number;
      expense: number;
      transfer: number;
    };
    month_key: string;
  }>;
  trend_analysis: {
    expense_trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
    income_trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
    months_analyzed: number;
    data_quality: 'good' | 'limited' | 'insufficient';
  };
  forecasts: TrendForecast[];
  insights: {
    avg_monthly_expense: number;
    avg_monthly_income: number;
    avg_monthly_net: number;
    most_expensive_month?: string;
    best_savings_month?: string;
  };
}

class LearningApiService {
  /**
   * Get AI-powered suggestions for payee and category based on transaction description
   */
  async getSmartSuggestions(request: SmartSuggestionRequest): Promise<SmartSuggestionResponse> {
    return api.post('/learning/suggestions', request).then(res => res.data);
  }

  /**
   * Record a user selection for learning purposes
   */
  async recordUserSelection(request: UserSelectionRequest): Promise<{ status: string; message: string }> {
    return api.post('/learning/record-selection', request).then(res => res.data);
  }

  /**
   * Record feedback about suggestion quality for learning improvement
   */
  async recordLearningFeedback(request: LearningFeedbackRequest): Promise<{ status: string; message: string }> {
    return api.post('/learning/feedback', request).then(res => res.data);
  }

  /**
   * Get all learned patterns for the current user
   */
  async getUserPatterns(): Promise<UserTransactionPattern[]> {
    return api.get('/learning/patterns').then(res => res.data);
  }

  /**
   * Get learning system statistics for the current user
   */
  async getLearningStatistics(): Promise<LearningStatistics> {
    return api.get('/learning/statistics').then(res => res.data);
  }

  /**
   * Delete a specific learning pattern
   */
  async deleteLearningPattern(patternId: string): Promise<{ status: string; message: string }> {
    return api.delete(`/learning/patterns/${patternId}`).then(res => res.data);
  }

  /**
   * Reset all learning patterns for the current user
   */
  async resetLearningPatterns(): Promise<{ status: string; message: string }> {
    return api.post('/learning/patterns/reset').then(res => res.data);
  }

  /**
   * Get enhanced suggestions that combine AI suggestions with existing options
   */
  async getEnhancedSuggestions(
    request: SmartSuggestionRequest,
    existingPayees: Array<{ id: string; name: string; color?: string }> = [],
    existingCategories: Array<{ id: string; name: string; color?: string }> = []
  ): Promise<{
    payee_suggestions: Array<SuggestionItem & { isExisting?: boolean }>;
    category_suggestions: Array<SuggestionItem & { isExisting?: boolean }>;
  }> {
    try {
      // Get AI suggestions
      const aiSuggestions = await this.getSmartSuggestions(request);
      
      // Merge with existing options and rank by relevance
      const enhancedPayeeSuggestions = this.mergeAndRankSuggestions(
        aiSuggestions.payee_suggestions,
        existingPayees,
        'payee',
        request.description
      );
      
      const enhancedCategorySuggestions = this.mergeAndRankSuggestions(
        aiSuggestions.category_suggestions,
        existingCategories,
        'category',
        request.description
      );
      
      return {
        payee_suggestions: enhancedPayeeSuggestions,
        category_suggestions: enhancedCategorySuggestions,
      };
    } catch (error) {
      // Fallback to existing options if AI suggestions fail
      console.warn('AI suggestions failed, falling back to existing options:', error);
      
      return {
        payee_suggestions: existingPayees.map(p => ({
          id: p.id,
          name: p.name,
          type: 'existing' as const,
          confidence: 0.5,
          reason: 'Existing option',
          isExisting: true,
        })),
        category_suggestions: existingCategories.map(c => ({
          id: c.id,
          name: c.name,
          type: 'existing' as const,
          confidence: 0.5,
          reason: 'Existing option',
          color: c.color,
          isExisting: true,
        })),
      };
    }
  }

  /**
   * Merge AI suggestions with existing options and rank them intelligently
   */
  private mergeAndRankSuggestions(
    aiSuggestions: SuggestionItem[],
    existingItems: Array<{ id: string; name: string; color?: string }>,
    type: 'payee' | 'category',
    description: string
  ): Array<SuggestionItem & { isExisting?: boolean }> {
    const suggestions: Array<SuggestionItem & { isExisting?: boolean }> = [];
    
    // Add AI suggestions first (highest priority)
    aiSuggestions.forEach(suggestion => {
      suggestions.push({
        ...suggestion,
        isExisting: false,
      });
    });
    
    // Add existing items that aren't already in AI suggestions
    const aiSuggestionIds = new Set(aiSuggestions.map(s => s.id));
    
    existingItems.forEach(item => {
      if (!aiSuggestionIds.has(item.id)) {
        // Calculate relevance score based on name similarity to description
        const relevanceScore = this.calculateRelevanceScore(item.name, description);
        
        suggestions.push({
          id: item.id,
          name: item.name,
          type: relevanceScore > 0.3 ? 'historical' : 'existing',
          confidence: Math.min(relevanceScore, 0.8), // Cap at 0.8 for non-AI suggestions
          reason: relevanceScore > 0.3 ? 'Similar to description' : 'Existing option',
          color: item.color,
          isExisting: true,
        });
      }
    });
    
    // Sort by confidence (AI suggestions first, then by relevance)
    const sortedSuggestions = suggestions.sort((a, b) => {
      // AI suggestions always come first
      if (a.type === 'ai_suggestion' && b.type !== 'ai_suggestion') return -1;
      if (b.type === 'ai_suggestion' && a.type !== 'ai_suggestion') return 1;
      
      // Then sort by confidence
      return b.confidence - a.confidence;
    });
    
    // Only limit AI suggestions to top 5, but keep all existing options
    const topAiSuggestions = sortedSuggestions.filter(s => s.type === 'ai_suggestion').slice(0, 5); // Limit AI to 5
    const otherSuggestions = sortedSuggestions.filter(s => s.type !== 'ai_suggestion'); // Keep all existing/historical
    
    return [...topAiSuggestions, ...otherSuggestions];
  }

  /**
   * Calculate relevance score between item name and description
   */
  private calculateRelevanceScore(itemName: string, description: string): number {
    if (!itemName || !description) return 0;
    
    const itemWords = itemName.toLowerCase().split(/\s+/);
    const descWords = description.toLowerCase().split(/\s+/);
    
    let matches = 0;
    itemWords.forEach(itemWord => {
      if (itemWord.length >= 3 && descWords.some(descWord => 
        descWord.includes(itemWord) || itemWord.includes(descWord)
      )) {
        matches++;
      }
    });
    
    return matches / Math.max(itemWords.length, descWords.length);
  }

  /**
   * Get performance analytics for the learning system
   */
  async getPerformanceAnalytics(): Promise<PerformanceAnalytics> {
    return api.get('/learning/analytics/performance').then(res => res.data);
  }

  /**
   * Get pattern analytics and insights
   */
  async getPatternAnalytics(): Promise<PatternAnalytics> {
    return api.get('/learning/analytics/patterns').then(res => res.data);
  }

  /**
   * Get accuracy analytics over time
   */
  async getAccuracyAnalytics(): Promise<AccuracyAnalytics> {
    return api.get('/learning/analytics/accuracy').then(res => res.data);
  }

  /**
   * Automatically categorize uncategorized transactions using high-confidence patterns
   */
  async autoCategorizeTransactions(): Promise<AutoCategorizationResult> {
    return api.post('/learning/auto-categorize').then(res => res.data);
  }

  /**
   * Bulk process multiple transactions with AI assistance
   */
  async bulkProcessTransactions(transactionIds: string[], action: 'categorize' | 'duplicate_check' | 'validate'): Promise<BulkProcessResult> {
    return api.post('/learning/bulk-process', {
      transaction_ids: transactionIds,
      action
    }).then(res => res.data);
  }

  /**
   * Preprocess import data with AI suggestions for better categorization
   */
  async smartImportPreprocess(importData: Array<Record<string, any>>): Promise<SmartImportResult> {
    return api.post('/learning/smart-import-preprocess', importData).then(res => res.data);
  }

  /**
   * Get spending pattern predictions for future months
   */
  async getSpendingPredictions(): Promise<SpendingPredictionsResult> {
    return api.get('/learning/predictions/spending-patterns').then(res => res.data);
  }

  /**
   * Detect spending anomalies and unusual patterns
   */
  async getSpendingAnomalies(): Promise<AnomaliesResult> {
    return api.get('/learning/predictions/anomalies').then(res => res.data);
  }

  /**
   * Get intelligent budget recommendations
   */
  async getBudgetRecommendations(): Promise<BudgetRecommendationsResult> {
    return api.get('/learning/recommendations/budget').then(res => res.data);
  }

  /**
   * Get expense trend analysis and forecasting
   */
  async getTrendForecast(): Promise<TrendForecastResult> {
    return api.get('/learning/trends/forecast').then(res => res.data);
  }
}

export const learningApi = new LearningApiService();
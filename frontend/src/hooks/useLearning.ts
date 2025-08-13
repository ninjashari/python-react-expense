import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  learningApi, 
  SmartSuggestionRequest, 
  UserSelectionRequest,
  SuggestionItem
} from '../services/learningApi';

/**
 * Hook for getting smart suggestions based on transaction description
 */
export const useSmartSuggestions = (
  request: SmartSuggestionRequest,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['smart-suggestions', request],
    queryFn: () => learningApi.getSmartSuggestions(request),
    enabled: enabled && !!request.description && request.description.length >= 3,
    staleTime: 30000, // Cache for 30 seconds
    retry: 1, // Only retry once if it fails
  });
};

/**
 * Hook for enhanced suggestions that combine AI with existing options
 */
export const useEnhancedSuggestions = (
  description: string,
  amount?: number,
  accountId?: string,
  accountType?: string,
  existingPayees: Array<{ id: string; name: string }> = [],
  existingCategories: Array<{ id: string; name: string; color: string }> = []
) => {
  return useQuery({
    queryKey: ['enhanced-suggestions', description, amount, accountId, existingPayees.length, existingCategories.length],
    queryFn: () => learningApi.getEnhancedSuggestions(
      { description, amount, account_id: accountId, account_type: accountType },
      existingPayees,
      existingCategories
    ),
    enabled: !!description && description.length >= 3,
    staleTime: 30000,
    retry: 1,
  });
};

/**
 * Hook for recording user selections for learning
 */
export const useRecordSelection = () => {
  return useMutation({
    mutationFn: (request: UserSelectionRequest) => 
      learningApi.recordUserSelection(request),
    retry: 1,
  });
};

/**
 * Hook for learning statistics
 */
export const useLearningStatistics = () => {
  return useQuery({
    queryKey: ['learning-statistics'],
    queryFn: () => learningApi.getLearningStatistics(),
    staleTime: 60000, // Cache for 1 minute
    retry: 1,
  });
};

/**
 * Hook for user patterns
 */
export const useUserPatterns = () => {
  return useQuery({
    queryKey: ['user-patterns'],
    queryFn: () => learningApi.getUserPatterns(),
    staleTime: 300000, // Cache for 5 minutes
    retry: 1,
  });
};

/**
 * Enhanced hook for smart transaction form that provides AI suggestions
 */
export const useSmartTransactionForm = (
  payees: Array<{ id: string; name: string }> = [],
  categories: Array<{ id: string; name: string; color: string }> = []
) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | undefined>();
  const [accountId, setAccountId] = useState<string | undefined>();
  const [accountType, setAccountType] = useState<string | undefined>();
  
  const recordSelection = useRecordSelection();
  
  // Get enhanced suggestions when description changes
  const { 
    data: suggestions, 
    isLoading: suggestionsLoading,
    error: suggestionsError 
  } = useEnhancedSuggestions(
    description, 
    amount, 
    accountId, 
    accountType, 
    payees, 
    categories
  );
  
  // Record a selection when user chooses an option
  const recordUserSelection = useCallback((
    transactionId: string,
    fieldType: 'payee' | 'category',
    selectedId: string | null,
    selectedName: string,
    wasSuggested: boolean,
    suggestionConfidence?: number,
    selectionMethod: string = 'form_edit'
  ) => {
    recordSelection.mutate({
      transaction_id: transactionId,
      field_type: fieldType,
      selected_value_id: selectedId || undefined,
      selected_value_name: selectedName,
      transaction_description: description,
      transaction_amount: amount,
      account_type: accountType,
      was_suggested: wasSuggested,
      suggestion_confidence: suggestionConfidence,
      selection_method: selectionMethod as any,
    });
  }, [description, amount, accountType, recordSelection]);
  
  return {
    // Form state
    description,
    setDescription,
    amount,
    setAmount,
    accountId,
    setAccountId,
    accountType,
    setAccountType,
    
    // Suggestions
    suggestions: suggestions || { payee_suggestions: [], category_suggestions: [] },
    suggestionsLoading,
    suggestionsError,
    
    // Actions
    recordUserSelection,
    
    // Helper functions
    getTopSuggestion: (type: 'payee' | 'category') => {
      const suggestionList = type === 'payee' 
        ? suggestions?.payee_suggestions || []
        : suggestions?.category_suggestions || [];
      
      return suggestionList.find(s => s.type === 'ai_suggestion' && s.confidence > 0.6);
    },
    
    hasHighConfidenceSuggestions: () => {
      const allSuggestions = [
        ...(suggestions?.payee_suggestions || []),
        ...(suggestions?.category_suggestions || [])
      ];
      return allSuggestions.some(s => s.type === 'ai_suggestion' && s.confidence > 0.6);
    },
  };
};

/**
 * Hook for auto-suggesting high confidence patterns
 */
export const useAutoSuggestions = (
  description: string,
  confidenceThreshold: number = 0.6
) => {
  const [autoAppliedSuggestions, setAutoAppliedSuggestions] = useState<{
    payee?: SuggestionItem;
    category?: SuggestionItem;
  }>({});
  
  const { data: suggestions } = useSmartSuggestions({
    description,
  }, description.length >= 3);
  
  useEffect(() => {
    if (!suggestions) return;
    
    const highConfidencePayee = suggestions.payee_suggestions.find(
      s => s.type === 'ai_suggestion' && s.confidence >= confidenceThreshold
    );
    
    const highConfidenceCategory = suggestions.category_suggestions.find(
      s => s.type === 'ai_suggestion' && s.confidence >= confidenceThreshold
    );
    
    if (highConfidencePayee || highConfidenceCategory) {
      setAutoAppliedSuggestions({
        payee: highConfidencePayee,
        category: highConfidenceCategory,
      });
    }
  }, [suggestions, confidenceThreshold]);
  
  return {
    autoAppliedSuggestions,
    clearAutoSuggestions: () => setAutoAppliedSuggestions({}),
    hasAutoSuggestions: Object.keys(autoAppliedSuggestions).length > 0,
  };
};

/**
 * Hook for tracking learning performance metrics
 */
export const useLearningMetrics = () => {
  const [sessionStats, setSessionStats] = useState({
    suggestionsShown: 0,
    suggestionsAccepted: 0,
    suggestionsRejected: 0,
  });
  
  const trackSuggestionShown = useCallback(() => {
    setSessionStats(prev => ({
      ...prev,
      suggestionsShown: prev.suggestionsShown + 1,
    }));
  }, []);
  
  const trackSuggestionAccepted = useCallback(() => {
    setSessionStats(prev => ({
      ...prev,
      suggestionsAccepted: prev.suggestionsAccepted + 1,
    }));
  }, []);
  
  const trackSuggestionRejected = useCallback(() => {
    setSessionStats(prev => ({
      ...prev,
      suggestionsRejected: prev.suggestionsRejected + 1,
    }));
  }, []);
  
  const getSessionAcceptanceRate = useCallback(() => {
    if (sessionStats.suggestionsShown === 0) return 0;
    return (sessionStats.suggestionsAccepted / sessionStats.suggestionsShown) * 100;
  }, [sessionStats]);
  
  return {
    sessionStats,
    trackSuggestionShown,
    trackSuggestionAccepted,
    trackSuggestionRejected,
    getSessionAcceptanceRate,
  };
};

/**
 * Hook for performance analytics
 */
export const usePerformanceAnalytics = () => {
  return useQuery({
    queryKey: ['learning-performance-analytics'],
    queryFn: () => learningApi.getPerformanceAnalytics(),
    staleTime: 300000, // Cache for 5 minutes
    retry: 1,
  });
};

/**
 * Hook for pattern analytics
 */
export const usePatternAnalytics = () => {
  return useQuery({
    queryKey: ['learning-pattern-analytics'],
    queryFn: () => learningApi.getPatternAnalytics(),
    staleTime: 300000, // Cache for 5 minutes
    retry: 1,
  });
};

/**
 * Hook for accuracy analytics
 */
export const useAccuracyAnalytics = () => {
  return useQuery({
    queryKey: ['learning-accuracy-analytics'],
    queryFn: () => learningApi.getAccuracyAnalytics(),
    staleTime: 300000, // Cache for 5 minutes
    retry: 1,
  });
};

/**
 * Hook for auto-categorization
 */
export const useAutoCategorization = () => {
  return useMutation({
    mutationFn: () => learningApi.autoCategorizeTransactions(),
    retry: 1,
  });
};

/**
 * Hook for bulk processing transactions
 */
export const useBulkProcessing = () => {
  return useMutation({
    mutationFn: ({ transactionIds, action }: { 
      transactionIds: string[]; 
      action: 'categorize' | 'duplicate_check' | 'validate';
    }) => learningApi.bulkProcessTransactions(transactionIds, action),
    retry: 1,
  });
};

/**
 * Hook for smart import preprocessing
 */
export const useSmartImportPreprocess = () => {
  return useMutation({
    mutationFn: (importData: Array<Record<string, any>>) => 
      learningApi.smartImportPreprocess(importData),
    retry: 1,
  });
};

/**
 * Hook for spending pattern predictions
 */
export const useSpendingPredictions = () => {
  return useQuery({
    queryKey: ['spending-predictions'],
    queryFn: () => learningApi.getSpendingPredictions(),
    staleTime: 600000, // Cache for 10 minutes
    retry: 1,
  });
};

/**
 * Hook for spending anomaly detection
 */
export const useSpendingAnomalies = () => {
  return useQuery({
    queryKey: ['spending-anomalies'],
    queryFn: () => learningApi.getSpendingAnomalies(),
    staleTime: 300000, // Cache for 5 minutes
    retry: 1,
  });
};

/**
 * Hook for budget recommendations
 */
export const useBudgetRecommendations = () => {
  return useQuery({
    queryKey: ['budget-recommendations'],
    queryFn: () => learningApi.getBudgetRecommendations(),
    staleTime: 600000, // Cache for 10 minutes
    retry: 1,
  });
};

/**
 * Hook for trend forecasting
 */
export const useTrendForecast = () => {
  return useQuery({
    queryKey: ['trend-forecast'],
    queryFn: () => learningApi.getTrendForecast(),
    staleTime: 600000, // Cache for 10 minutes
    retry: 1,
  });
};
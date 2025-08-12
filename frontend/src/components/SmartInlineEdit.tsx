import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Fade,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Psychology as AIIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import SmartAutocomplete from './SmartAutocomplete';
import { useEnhancedSuggestions, useRecordSelection, useLearningMetrics } from '../hooks/useLearning';
import { SuggestionItem } from '../services/learningApi';

interface SmartInlineEditProps {
  // Transaction context
  transactionId: string;
  transactionDescription: string;
  transactionAmount?: number;
  accountType?: string;
  
  // Field properties
  fieldType: 'payee' | 'category';
  currentValue: any;
  
  // Options and handlers
  allOptions: Array<{ id: string; name: string; color?: string }>;
  onSelectionChange: (newValue: any) => Promise<void>;
  
  // Display properties
  placeholder?: string;
  emptyDisplay?: string;
  minWidth?: number;
  
  // State
  isSaving?: boolean;
  error?: string;
}

const SmartInlineEdit: React.FC<SmartInlineEditProps> = ({
  transactionId,
  transactionDescription,
  transactionAmount,
  accountType,
  fieldType,
  currentValue,
  allOptions,
  onSelectionChange,
  placeholder = `Select ${fieldType}...`,
  emptyDisplay = '-',
  minWidth = 150,
  isSaving = false,
  error,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSuggestionUsed, setLastSuggestionUsed] = useState<SuggestionItem | null>(null);
  
  const recordSelection = useRecordSelection();
  const { trackSuggestionShown, trackSuggestionAccepted } = useLearningMetrics();
  
  // Get enhanced suggestions
  const {
    data: suggestions,
    isLoading: suggestionsLoading
  } = useEnhancedSuggestions(
    transactionDescription,
    transactionAmount,
    undefined, // accountId not needed here
    accountType,
    fieldType === 'payee' ? allOptions as Array<{ id: string; name: string }> : [],
    fieldType === 'category' ? allOptions as Array<{ id: string; name: string; color: string }> : []
  );
  
  // Get current suggestions for this field type
  const currentSuggestions = fieldType === 'payee' 
    ? suggestions?.payee_suggestions || []
    : suggestions?.category_suggestions || [];
  
  // Check if there are high-confidence AI suggestions
  const hasHighConfidenceSuggestion = currentSuggestions.some(
    s => s.type === 'ai_suggestion' && s.confidence > 0.8
  );
  
  const topAISuggestion = currentSuggestions.find(
    s => s.type === 'ai_suggestion' && s.confidence > 0.7
  );
  
  // Handle selection change with learning
  const handleSelectionChange = async (event: React.SyntheticEvent, newValue: any) => {
    if (!newValue) return;
    
    // Find the suggestion that was selected
    const selectedSuggestion = currentSuggestions.find(s => s.id === newValue.id);
    const wasSuggestion = selectedSuggestion?.type === 'ai_suggestion';
    
    try {
      // Update the transaction
      await onSelectionChange(newValue);
      
      // Record the selection for learning
      recordSelection.mutate({
        transaction_id: transactionId,
        field_type: fieldType,
        selected_value_id: newValue.id,
        selected_value_name: newValue.name,
        transaction_description: transactionDescription,
        transaction_amount: transactionAmount,
        account_type: accountType,
        was_suggested: wasSuggestion,
        suggestion_confidence: selectedSuggestion?.confidence,
        selection_method: 'inline_edit',
      });
      
      // Track metrics
      if (wasSuggestion) {
        trackSuggestionAccepted();
        setLastSuggestionUsed(selectedSuggestion!);
      }
      
      // Show success feedback
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      
    } catch (error) {
      console.error('Failed to update selection:', error);
    }
    
    setIsEditing(false);
  };
  
  const handleSuggestionShown = (suggestion: SuggestionItem) => {
    trackSuggestionShown();
  };
  
  // Auto-expand editing mode if there are high-confidence suggestions
  useEffect(() => {
    if (hasHighConfidenceSuggestion && !currentValue && transactionDescription.length >= 5) {
      // Auto-expand for new transactions with good suggestions
      setIsEditing(true);
    }
  }, [hasHighConfidenceSuggestion, currentValue, transactionDescription]);
  
  // Display component
  const renderDisplayValue = () => {
    if (isSaving) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Saving...
          </Typography>
        </Box>
      );
    }
    
    if (showSuccess) {
      return (
        <Fade in={showSuccess}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SuccessIcon sx={{ fontSize: 16, color: 'success.main' }} />
            <Typography variant="body2" color="success.main">
              Saved!
            </Typography>
            {lastSuggestionUsed && (
              <Chip
                size="small"
                icon={<AIIcon />}
                label="AI Suggested"
                color="primary"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>
        </Fade>
      );
    }
    
    if (error) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
          <Typography variant="body2" color="error.main">
            Error
          </Typography>
        </Box>
      );
    }
    
    if (fieldType === 'category' && currentValue) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {currentValue.color && (
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: currentValue.color,
              }}
            />
          )}
          <Typography variant="body2">
            {currentValue.name}
          </Typography>
          {topAISuggestion && !currentValue && (
            <Tooltip title={`AI suggests: ${topAISuggestion.name}`}>
              <AIIcon sx={{ fontSize: 14, color: 'primary.main', opacity: 0.7 }} />
            </Tooltip>
          )}
        </Box>
      );
    }
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color={currentValue ? 'text.primary' : 'text.secondary'}>
          {currentValue?.name || emptyDisplay}
        </Typography>
        {topAISuggestion && !currentValue && (
          <Tooltip title={`AI suggests: ${topAISuggestion.name}`}>
            <AIIcon sx={{ fontSize: 14, color: 'primary.main', opacity: 0.7 }} />
          </Tooltip>
        )}
      </Box>
    );
  };
  
  if (isEditing) {
    return (
      <Box sx={{ minWidth, position: 'relative' }}>
        <SmartAutocomplete
          value={currentValue}
          onChange={handleSelectionChange}
          options={currentSuggestions}
          getOptionLabel={(option) => option?.name || ''}
          loading={suggestionsLoading}
          placeholder={placeholder}
          fieldType={fieldType}
          size="small"
          variant="standard"
          onSuggestionShown={handleSuggestionShown}
          sx={{
            '& .MuiAutocomplete-endAdornment': {
              display: 'none'
            },
            '& .MuiInputBase-input': {
              cursor: 'pointer',
              padding: '6px 8px !important',
              fontSize: '0.875rem',
            },
            '& .MuiInput-underline:before, & .MuiInput-underline:after': {
              display: 'none',
            }
          }}
        />
      </Box>
    );
  }
  
  return (
    <Box 
      sx={{ 
        minWidth,
        cursor: 'pointer',
        padding: '6px 8px',
        borderRadius: 1,
        '&:hover': {
          backgroundColor: 'action.hover'
        },
        ...(hasHighConfidenceSuggestion && !currentValue && {
          border: '1px dashed',
          borderColor: 'primary.main',
          backgroundColor: 'primary.50',
        })
      }}
      onClick={() => setIsEditing(true)}
    >
      {renderDisplayValue()}
      
      {/* High confidence suggestion indicator */}
      {hasHighConfidenceSuggestion && !currentValue && (
        <Box sx={{ mt: 0.5 }}>
          <Chip
            size="small"
            icon={<AIIcon />}
            label={`Try: ${topAISuggestion?.name}`}
            color="primary"
            variant="outlined"
            sx={{ 
              height: 18, 
              fontSize: '0.65rem',
              '& .MuiChip-icon': { fontSize: '0.7rem' }
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default SmartInlineEdit;
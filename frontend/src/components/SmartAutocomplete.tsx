import React, { useState, useCallback } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Tooltip,
  Avatar,
} from '@mui/material';
import {
  Psychology as AIIcon,
  History as HistoryIcon,
  List as ExistingIcon,
  Add as CreateIcon,
  Star as ConfidenceIcon,
} from '@mui/icons-material';
import { SuggestionItem } from '../services/learningApi';

interface SmartAutocompleteProps {
  // Basic autocomplete props
  value: any;
  onChange: (event: React.SyntheticEvent, newValue: any) => void;
  options: Array<SuggestionItem & { isExisting?: boolean }>;
  getOptionLabel: (option: any) => string;
  
  // Smart features
  loading?: boolean;
  placeholder?: string;
  label?: string;
  fieldType: 'payee' | 'category';
  disabled?: boolean;
  size?: 'small' | 'medium';
  
  // Learning callbacks
  onSuggestionShown?: (suggestion: SuggestionItem) => void;
  onSuggestionAccepted?: (suggestion: SuggestionItem) => void;
  onSuggestionRejected?: (suggestion: SuggestionItem) => void;
  
  // Styling
  sx?: any;
  fullWidth?: boolean;
  variant?: 'standard' | 'outlined' | 'filled';
}

const SmartAutocomplete: React.FC<SmartAutocompleteProps> = ({
  value,
  onChange,
  options,
  getOptionLabel,
  loading = false,
  placeholder,
  label,
  fieldType,
  disabled = false,
  size = 'small',
  onSuggestionShown,
  onSuggestionAccepted,
  onSuggestionRejected,
  sx,
  fullWidth = true,
  variant = 'standard',
}) => {
  const [hasShownSuggestions, setHasShownSuggestions] = useState(false);

  // Group suggestions by type for better UX
  const groupedOptions = React.useMemo(() => {
    const aiSuggestions = options.filter(opt => opt.type === 'ai_suggestion');
    const historicalSuggestions = options.filter(opt => opt.type === 'historical');
    const existingSuggestions = options.filter(opt => opt.type === 'existing');
    
    // AI suggestions first, then historical, then existing
    return [...aiSuggestions, ...historicalSuggestions, ...existingSuggestions];
  }, [options]);

  // Track when suggestions are shown (first time dropdown opens)
  const handleOpen = useCallback(() => {
    if (!hasShownSuggestions && options.length > 0) {
      setHasShownSuggestions(true);
      options.forEach(option => {
        if (option.type === 'ai_suggestion' && onSuggestionShown) {
          onSuggestionShown(option);
        }
      });
    }
  }, [hasShownSuggestions, options, onSuggestionShown]);

  // Track when user selects an option
  const handleChange = useCallback((event: React.SyntheticEvent, newValue: any) => {
    if (newValue && onSuggestionAccepted) {
      const selectedOption = options.find(opt => opt.id === newValue.id);
      if (selectedOption && selectedOption.type === 'ai_suggestion') {
        onSuggestionAccepted(selectedOption);
      }
    }
    onChange(event, newValue);
  }, [onChange, options, onSuggestionAccepted]);

  const getSuggestionTypeIcon = (type: string) => {
    switch (type) {
      case 'ai_suggestion':
        return <AIIcon sx={{ fontSize: 16, color: 'primary.main' }} />;
      case 'historical':
        return <HistoryIcon sx={{ fontSize: 16, color: 'info.main' }} />;
      case 'existing':
        return <ExistingIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
      case 'create_new':
        return <CreateIcon sx={{ fontSize: 16, color: 'success.main' }} />;
      default:
        return null;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success.main';
    if (confidence >= 0.6) return 'warning.main';
    return 'text.secondary';
  };

  const renderOption = (props: any, option: SuggestionItem & { isExisting?: boolean }) => (
    <Box 
      component="li" 
      {...props} 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        padding: '8px 12px !important',
        '&[aria-selected="true"]': {
          backgroundColor: 'action.selected',
        }
      }}
    >
      {/* Suggestion type icon */}
      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 20 }}>
        {getSuggestionTypeIcon(option.type)}
      </Box>

      {/* Category color dot (for categories only) */}
      {fieldType === 'category' && option.color && (
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: option.color,
            minWidth: 12,
          }}
        />
      )}

      {/* Option name and details */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {option.name}
        </Typography>
        
        {/* AI suggestion details */}
        {option.type === 'ai_suggestion' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography 
              variant="caption" 
              color="text.secondary"
              noWrap
              sx={{ flex: 1 }}
            >
              {option.reason}
            </Typography>
            
            {/* Confidence indicator */}
            <Tooltip title={`${Math.round(option.confidence * 100)}% confidence`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ConfidenceIcon 
                  sx={{ 
                    fontSize: 12, 
                    color: getConfidenceColor(option.confidence) 
                  }} 
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: getConfidenceColor(option.confidence),
                    fontWeight: 'bold',
                    minWidth: 28,
                    textAlign: 'right'
                  }}
                >
                  {Math.round(option.confidence * 100)}%
                </Typography>
              </Box>
            </Tooltip>
          </Box>
        )}
        
        {/* Usage count for historical suggestions */}
        {option.type === 'historical' && option.usage_count && (
          <Typography variant="caption" color="text.secondary">
            Used {option.usage_count} times
          </Typography>
        )}
      </Box>
    </Box>
  );

  const renderInput = (params: any) => {
    const hasAISuggestions = options.some(opt => opt.type === 'ai_suggestion');
    const topSuggestion = options.find(opt => opt.type === 'ai_suggestion' && opt.confidence > 0.8);
    
    return (
      <TextField
        {...params}
        label={label}
        placeholder={placeholder}
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        disabled={disabled}
        InputProps={{
          ...params.InputProps,
          startAdornment: hasAISuggestions ? (
            <Tooltip title="AI suggestions available">
              <AIIcon 
                sx={{ 
                  fontSize: 18, 
                  color: topSuggestion ? 'success.main' : 'primary.main',
                  mr: 1
                }} 
              />
            </Tooltip>
          ) : undefined,
          endAdornment: (
            <>
              {loading && <CircularProgress size={20} />}
              {params.InputProps.endAdornment}
            </>
          ),
        }}
        helperText={
          topSuggestion && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Chip
                size="small"
                icon={<AIIcon />}
                label={`Suggested: ${topSuggestion.name} (${Math.round(topSuggestion.confidence * 100)}%)`}
                color="primary"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.75rem' }}
              />
            </Box>
          )
        }
      />
    );
  };

  const renderTags = (tagValue: any[], getTagProps: any) => {
    return tagValue.map((option, index) => {
      const suggestion = options.find(opt => opt.id === option.id);
      const isAISuggestion = suggestion?.type === 'ai_suggestion';
      
      return (
        <Chip
          {...getTagProps({ index })}
          key={option.id}
          label={option.name}
          size="small"
          color={isAISuggestion ? 'primary' : 'default'}
          avatar={
            isAISuggestion ? (
              <Avatar sx={{ bgcolor: 'primary.main', width: 20, height: 20 }}>
                <AIIcon sx={{ fontSize: 12 }} />
              </Avatar>
            ) : undefined
          }
        />
      );
    });
  };

  return (
    <Autocomplete
      value={value}
      onChange={handleChange}
      options={groupedOptions}
      getOptionLabel={getOptionLabel}
      renderOption={renderOption}
      renderInput={renderInput}
      renderTags={renderTags}
      loading={loading}
      disabled={disabled}
      size={size}
      onOpen={handleOpen}
      isOptionEqualToValue={(option, value) => option?.id === value?.id}
      groupBy={(option) => {
        switch (option.type) {
          case 'ai_suggestion':
            return '🧠 AI Suggestions';
          case 'historical':
            return '📊 Recent Selections';
          case 'existing':
            return '📋 All Options';
          default:
            return 'Other';
        }
      }}
      sx={{
        '& .MuiAutocomplete-groupLabel': {
          fontSize: '0.75rem',
          fontWeight: 'bold',
          color: 'primary.main',
          backgroundColor: 'action.hover',
          padding: '4px 12px',
        },
        '& .MuiAutocomplete-option[aria-selected="true"]': {
          backgroundColor: 'action.selected !important',
        },
        ...sx,
      }}
      slotProps={{
        popper: {
          placement: 'bottom-start',
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 4],
              },
            },
          ],
        },
      }}
    />
  );
};

export default SmartAutocomplete;
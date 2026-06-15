import React, { useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Fade,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import SmartAutocomplete, { SimpleOption } from './SmartAutocomplete';

interface SmartInlineEditProps {
  transactionId: string;
  transactionDescription: string;
  transactionAmount?: number;
  accountType?: string;
  fieldType: 'payee' | 'category';
  currentValue: any;
  allOptions: Array<{ id: string; name: string; color?: string }>;
  onSelectionChange: (newValue: any) => Promise<void>;
  onCreateNew?: (name: string) => Promise<{ id: string; name: string; color?: string }>;
  placeholder?: string;
  emptyDisplay?: string;
  minWidth?: number;
  isSaving?: boolean;
  error?: string;
}

const SmartInlineEdit: React.FC<SmartInlineEditProps> = ({
  fieldType,
  currentValue,
  allOptions,
  onSelectionChange,
  onCreateNew,
  placeholder = `Select ${fieldType}...`,
  emptyDisplay = '-',
  minWidth = 150,
  isSaving = false,
  error,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const options: SimpleOption[] = allOptions.map(o => ({ ...o, type: 'existing' }));

  const handleSelectionChange = async (event: React.SyntheticEvent, newValue: any) => {
    if (!newValue) return;
    try {
      await onSelectionChange(newValue);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to update selection:', err);
    }
    setIsEditing(false);
  };

  const renderDisplayValue = () => {
    if (isSaving) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">Saving...</Typography>
        </Box>
      );
    }

    if (showSuccess) {
      return (
        <Fade in={showSuccess}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SuccessIcon sx={{ fontSize: 16, color: 'success.main' }} />
            <Typography variant="body2" color="success.main">Saved!</Typography>
          </Box>
        </Fade>
      );
    }

    if (error) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
          <Typography variant="body2" color="error.main">Error</Typography>
        </Box>
      );
    }

    if (currentValue) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {currentValue.color && (
            <Box sx={{
              width: 12, height: 12, borderRadius: '50%',
              backgroundColor: currentValue.color,
              border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0,
            }} />
          )}
          <Typography variant="body2">{currentValue.name}</Typography>
        </Box>
      );
    }

    return (
      <Typography variant="body2" color="text.secondary">{emptyDisplay}</Typography>
    );
  };

  if (isEditing) {
    return (
      <Box sx={{ minWidth, position: 'relative' }}>
        <SmartAutocomplete
          value={currentValue}
          onChange={handleSelectionChange}
          options={options}
          getOptionLabel={(o) => o?.name || ''}
          placeholder={placeholder}
          fieldType={fieldType}
          size="small"
          variant="standard"
          allowCreate={!!onCreateNew}
          onCreateNew={onCreateNew}
          sx={{
            '& .MuiAutocomplete-endAdornment': { display: 'none' },
            '& .MuiInputBase-input': { cursor: 'pointer', padding: '6px 8px !important', fontSize: '0.875rem' },
            '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' },
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minWidth, cursor: 'pointer', padding: '6px 8px', borderRadius: 1,
        '&:hover': { backgroundColor: 'action.hover' },
      }}
      onClick={() => setIsEditing(true)}
    >
      {renderDisplayValue()}
    </Box>
  );
};

export default SmartInlineEdit;

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  CircularProgress,
  Tooltip,
  Typography,
} from '@mui/material';
import { Edit, Check, Close } from '@mui/icons-material';

interface InlineTextEditProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  placeholder?: string;
  emptyDisplay?: string;
  isSaving?: boolean;
  multiline?: boolean;
  maxLength?: number;
}

const InlineTextEdit: React.FC<InlineTextEditProps> = ({
  value,
  onSave,
  placeholder = "Enter text...",
  emptyDisplay = "-",
  isSaving = false,
  multiline = false,
  maxLength,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  const handleEdit = () => {
    setIsEditing(true);
    setTempValue(value);
  };

  const handleSave = async () => {
    const trimmedValue = tempValue.trim();
    console.log('InlineTextEdit handleSave called with:', { trimmedValue, originalValue: value });
    if (trimmedValue !== value) {
      try {
        console.log('Calling onSave with trimmed value:', trimmedValue);
        await onSave(trimmedValue);
        console.log('onSave completed successfully');
      } catch (error) {
        console.error('Failed to save:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        setTempValue(value); // Reset to original value on error
        // Don't exit editing mode on error so user can try again
        return;
      }
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !multiline) {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 200 }}>
        <TextField
          ref={inputRef}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          size="small"
          multiline={multiline}
          maxRows={multiline ? 3 : 1}
          fullWidth
          disabled={isSaving}
          inputProps={{ maxLength }}
          sx={{
            '& .MuiInputBase-input': {
              fontSize: '0.875rem',
            }
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {isSaving ? (
            <CircularProgress size={20} />
          ) : (
            <>
              <Tooltip title="Save">
                <IconButton
                  size="small"
                  onClick={handleSave}
                  color="primary"
                  disabled={isSaving}
                >
                  <Check fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel">
                <IconButton
                  size="small"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minHeight: 40,
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: 1,
        transition: 'background-color 0.2s',
        '&:hover': {
          backgroundColor: 'action.hover',
        },
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleEdit}
    >
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          color: value ? 'text.primary' : 'text.secondary',
          fontStyle: value ? 'normal' : 'italic',
          wordBreak: 'break-word',
        }}
      >
        {value || emptyDisplay}
      </Typography>
      
      {isHovered && (
        <Tooltip title="Click to edit">
          <Edit fontSize="small" sx={{ color: 'action.active', opacity: 0.7 }} />
        </Tooltip>
      )}
    </Box>
  );
};

export default InlineTextEdit;
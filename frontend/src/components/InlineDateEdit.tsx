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

interface InlineDateEditProps {
  value: string; // Date in YYYY-MM-DD format
  onSave: (newValue: string) => Promise<void>;
  isSaving?: boolean;
  displayFormat?: (date: string) => string;
}

const InlineDateEdit: React.FC<InlineDateEditProps> = ({
  value,
  onSave,
  isSaving = false,
  displayFormat,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
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
    if (tempValue !== value) {
      try {
        await onSave(tempValue);
      } catch (error) {
        console.error('Failed to save date:', error);
        setTempValue(value); // Reset to original value on error
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
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (displayFormat) {
      return displayFormat(dateStr);
    }
    // Default format: convert YYYY-MM-DD to a more readable format
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  if (isEditing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 200 }}>
        <TextField
          ref={inputRef}
          type="date"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          size="small"
          fullWidth
          disabled={isSaving}
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
          color: 'text.primary',
          wordBreak: 'break-word',
        }}
      >
        {formatDisplayDate(value)}
      </Typography>
      
      {isHovered && (
        <Tooltip title="Click to edit">
          <Edit fontSize="small" sx={{ color: 'action.active', opacity: 0.7 }} />
        </Tooltip>
      )}
    </Box>
  );
};

export default InlineDateEdit;
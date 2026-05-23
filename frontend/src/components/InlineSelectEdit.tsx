import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  IconButton,
  CircularProgress,
  Tooltip,
  Chip,
} from '@mui/material';
import { Edit, Check, Close } from '@mui/icons-material';

interface SelectOption {
  value: string;
  label: string;
  color?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}

interface InlineSelectEditProps {
  value: string;
  options: SelectOption[];
  onSave: (newValue: string) => Promise<void>;
  getDisplayValue?: (value: string) => React.ReactNode;
  isSaving?: boolean;
}

const InlineSelectEdit: React.FC<InlineSelectEditProps> = ({
  value,
  options,
  onSave,
  getDisplayValue,
  isSaving = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [isHovered, setIsHovered] = useState(false);
  const selectRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
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
        console.error('Failed to save:', error);
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
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTempValue(event.target.value);
  };

  if (isEditing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
        <TextField
          ref={selectRef}
          value={tempValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          select
          size="small"
          fullWidth
          disabled={isSaving}
          sx={{
            '& .MuiInputBase-input': {
              fontSize: '0.875rem',
            }
          }}
        >
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
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
      {getDisplayValue ? getDisplayValue(value) : (
        <Chip
          label={options.find(opt => opt.value === value)?.label || value}
          size="small"
          color={options.find(opt => opt.value === value)?.color || 'default'}
        />
      )}
      
      {isHovered && (
        <Tooltip title="Click to edit">
          <Edit fontSize="small" sx={{ color: 'action.active', opacity: 0.7, ml: 1 }} />
        </Tooltip>
      )}
    </Box>
  );
};

export default InlineSelectEdit;
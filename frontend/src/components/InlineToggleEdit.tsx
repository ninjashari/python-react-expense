import React, { useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Tooltip,
} from '@mui/material';

interface ToggleOption {
  value: string;
  label: string;
  color?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}

interface InlineToggleEditProps {
  value: string;
  options: ToggleOption[];
  onSave: (newValue: string) => Promise<void>;
  isSaving?: boolean;
}

const InlineToggleEdit: React.FC<InlineToggleEditProps> = ({
  value,
  options,
  onSave,
  isSaving = false,
}) => {
  const [isToggling, setIsToggling] = useState(false);

  const currentOption = options.find(opt => opt.value === value);
  
  const handleToggle = async () => {
    if (isSaving || isToggling) return;
    
    setIsToggling(true);
    
    try {
      // Find current index and get next option (cycle through all options)
      const currentIndex = options.findIndex(opt => opt.value === value);
      const nextIndex = (currentIndex + 1) % options.length;
      const nextValue = options[nextIndex].value;
      
      await onSave(nextValue);
    } catch (error) {
      console.error('Failed to toggle value:', error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minHeight: 40,
        cursor: isSaving || isToggling ? 'default' : 'pointer',
        padding: '4px 8px',
        borderRadius: 1,
        transition: 'background-color 0.2s',
        '&:hover': {
          backgroundColor: isSaving || isToggling ? 'transparent' : 'action.hover',
        },
      }}
      onClick={handleToggle}
    >
      {isSaving || isToggling ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Chip
            label={currentOption?.label || value}
            size="small"
            color={currentOption?.color || 'default'}
            sx={{ opacity: 0.7 }}
          />
        </Box>
      ) : (
        <Tooltip title={`Click to cycle through: ${options.map(opt => opt.label).join(' → ')}`}>
          <Chip
            label={currentOption?.label || value}
            size="small"
            color={currentOption?.color || 'default'}
            sx={{
              transition: 'transform 0.1s',
              '&:hover': {
                transform: 'scale(1.05)',
              },
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

export default InlineToggleEdit;
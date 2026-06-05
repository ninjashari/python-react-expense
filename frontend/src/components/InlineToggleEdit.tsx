import React, { useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { ArrowDropDown } from '@mui/icons-material';

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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isSavingLocal, setIsSavingLocal] = useState(false);

  const open = Boolean(anchorEl);
  const saving = isSaving || isSavingLocal;
  const currentOption = options.find(opt => opt.value === value);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (saving) return;
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = async (event: React.MouseEvent, newValue: string) => {
    event.stopPropagation();
    setAnchorEl(null);
    if (newValue === value) return;

    setIsSavingLocal(true);
    try {
      await onSave(newValue);
    } catch (error) {
      console.error('Failed to change value:', error);
    } finally {
      setIsSavingLocal(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minHeight: 40,
        padding: '4px 8px',
      }}
    >
      {saving ? (
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
        <>
          <Tooltip title="Click to change type">
            <Chip
              label={currentOption?.label || value}
              size="small"
              color={currentOption?.color || 'default'}
              onClick={handleOpen}
              onDelete={handleOpen}
              deleteIcon={<ArrowDropDown />}
              sx={{
                cursor: 'pointer',
                transition: 'transform 0.1s',
                '& .MuiChip-deleteIcon': { color: 'inherit', ml: '-2px' },
                '&:hover': { transform: 'scale(1.05)' },
              }}
            />
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            {options.map((option) => (
              <MenuItem
                key={option.value}
                selected={option.value === value}
                onClick={(e) => handleSelect(e, option.value)}
                sx={{ py: 0.75 }}
              >
                <Chip
                  label={option.label}
                  size="small"
                  color={option.color || 'default'}
                />
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  );
};

export default InlineToggleEdit;

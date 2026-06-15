import React, { useState, useCallback } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Add as CreateIcon } from '@mui/icons-material';

export interface SimpleOption {
  id: string;
  name: string;
  color?: string;
  type?: string;
}

interface SmartAutocompleteProps {
  value: any;
  onChange: (event: React.SyntheticEvent, newValue: any) => void;
  options: SimpleOption[];
  getOptionLabel: (option: any) => string;
  loading?: boolean;
  placeholder?: string;
  label?: string;
  fieldType: 'payee' | 'category';
  disabled?: boolean;
  size?: 'small' | 'medium';
  allowCreate?: boolean;
  onCreateNew?: (name: string) => Promise<{ id: string; name: string; color?: string }>;
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
  allowCreate = true,
  onCreateNew,
  sx,
  fullWidth = true,
  variant = 'standard',
}) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleChange = useCallback(async (event: React.SyntheticEvent, newValue: any) => {
    if (newValue?.type === 'create_new' && onCreateNew) {
      setIsCreating(true);
      try {
        const created = await onCreateNew(newValue.name);
        onChange(event, created);
      } catch (err) {
        console.error('Failed to create:', err);
      } finally {
        setIsCreating(false);
      }
      return;
    }
    onChange(event, newValue);
  }, [onChange, onCreateNew]);

  const renderOption = (props: any, option: SimpleOption) => (
    <Box
      component="li"
      {...props}
      sx={{ display: 'flex', alignItems: 'center', gap: 1, padding: '8px 12px !important' }}
    >
      {option.type === 'create_new' && <CreateIcon sx={{ fontSize: 16, color: 'success.main' }} />}
      {fieldType === 'category' && option.color && option.type !== 'create_new' && (
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: option.color, minWidth: 12 }} />
      )}
      <Typography variant="body2" noWrap>{option.name}</Typography>
    </Box>
  );

  const renderInput = (params: any) => (
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
        endAdornment: (
          <>
            {(loading || isCreating) && <CircularProgress size={20} />}
            {params.InputProps.endAdornment}
          </>
        ),
      }}
    />
  );

  return (
    <Autocomplete
      value={value}
      onChange={handleChange}
      options={options}
      getOptionLabel={getOptionLabel}
      renderOption={renderOption}
      renderInput={renderInput}
      loading={loading || isCreating}
      disabled={disabled}
      size={size}
      isOptionEqualToValue={(option, val) => option?.id === val?.id}
      ListboxProps={{ style: { maxHeight: '400px', overflowY: 'auto' } }}
      filterOptions={(opts, params) => {
        if (!params.inputValue) return opts;
        const filtered = opts.filter(o =>
          o.name.toLowerCase().includes(params.inputValue.toLowerCase())
        );
        if (allowCreate && onCreateNew && params.inputValue.trim()) {
          const exact = opts.find(o => o.name.toLowerCase() === params.inputValue.toLowerCase());
          if (!exact) {
            filtered.push({
              id: `create_new_${params.inputValue}`,
              name: params.inputValue.trim(),
              type: 'create_new',
            });
          }
        }
        return filtered;
      }}
      sx={sx}
      slotProps={{
        popper: {
          placement: 'bottom-start',
          modifiers: [{ name: 'offset', options: { offset: [0, 4] } }],
        },
      }}
    />
  );
};

export default SmartAutocomplete;

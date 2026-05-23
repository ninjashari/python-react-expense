import React from 'react';
import Select, { MultiValue, ActionMeta, components } from 'react-select';
import { Box, Chip, Typography } from '@mui/material';
import { Clear } from '@mui/icons-material';

export interface Option {
  value: any;
  label: string;
  color?: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  value: MultiValue<Option>;
  onChange: (value: MultiValue<Option>, action: ActionMeta<Option>) => void;
  placeholder?: string;
  isSearchable?: boolean;
  isClearable?: boolean;
  isDisabled?: boolean;
  label?: string;
  error?: string;
}

const MultiValueContainer = (props: any) => {
  const { selectProps, data } = props;
  const color = data.color || '#1976d2';
  
  return (
    <components.MultiValueContainer {...props}>
      <Chip
        size="small"
        label={data.label}
        onDelete={() => {
          selectProps.onChange(
            selectProps.value.filter((val: Option) => val.value !== data.value),
            { action: 'remove-value', removedValue: data }
          );
        }}
        sx={{
          backgroundColor: color,
          color: 'white',
          '& .MuiChip-deleteIcon': {
            color: 'white',
          },
        }}
      />
    </components.MultiValueContainer>
  );
};

const customStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    minHeight: '40px',
    border: state.isFocused ? '2px solid #1976d2' : '1px solid #c4c4c4',
    boxShadow: state.isFocused ? '0 0 0 1px #1976d2' : 'none',
    '&:hover': {
      border: state.isFocused ? '2px solid #1976d2' : '1px solid #999',
    },
  }),
  multiValue: () => ({
    display: 'none', // Hide default multi-value, we use custom MultiValueContainer
  }),
  multiValueLabel: () => ({
    display: 'none',
  }),
  multiValueRemove: () => ({
    display: 'none',
  }),
  menu: (provided: any) => ({
    ...provided,
    zIndex: 9999,
  }),
  menuPortal: (provided: any) => ({
    ...provided,
    zIndex: 9999,
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? '#1976d2'
      : state.isFocused
      ? '#f5f5f5'
      : 'white',
    color: state.isSelected ? 'white' : 'black',
    '&:hover': {
      backgroundColor: state.isSelected ? '#1976d2' : '#f5f5f5',
    },
  }),
};

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select options...',
  isSearchable = true,
  isClearable = true,
  isDisabled = false,
  label,
  error,
}) => {
  return (
    <Box sx={{ mb: 2 }}>
      {label && (
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          {label}
        </Typography>
      )}
      
      <Select
        isMulti
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        isSearchable={isSearchable}
        isClearable={isClearable}
        isDisabled={isDisabled}
        styles={customStyles}
        components={{
          MultiValueContainer,
        }}
        menuPortalTarget={document.body}
        menuPosition="fixed"
        className={error ? 'react-select-error' : ''}
      />
      
      {/* Display selected values as chips below the select */}
      {value && value.length > 0 && (
        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {value.map((option) => (
            <Chip
              key={option.value}
              size="small"
              label={option.label}
              onDelete={() => {
                onChange(
                  value.filter((val) => val.value !== option.value),
                  { action: 'remove-value', removedValue: option }
                );
              }}
              sx={{
                backgroundColor: option.color || '#1976d2',
                color: 'white',
                '& .MuiChip-deleteIcon': {
                  color: 'white',
                },
              }}
            />
          ))}
          {isClearable && (
            <Chip
              size="small"
              label="Clear All"
              onClick={() => onChange([], { action: 'clear', removedValues: Array.isArray(value) ? value : [] } as any)}
              variant="outlined"
              icon={<Clear />}
              sx={{ borderColor: '#d32f2f', color: '#d32f2f' }}
            />
          )}
        </Box>
      )}
      
      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default MultiSelectDropdown;
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/formatters';
import { Option } from './MultiSelectDropdown';

interface ReportHeaderProps {
  title: string;
  startDate?: string;
  endDate?: string;
  selectedAccounts: Option[];
  generatedAt?: Date;
}

const ReportHeader: React.FC<ReportHeaderProps> = ({
  title,
  startDate,
  endDate,
  selectedAccounts,
  generatedAt = new Date(),
}) => {
  const { user } = useAuth();

  const formatDateRange = () => {
    if (!startDate && !endDate) {
      return 'All Time';
    }
    if (startDate && endDate) {
      return `From ${formatDate(startDate)} till ${formatDate(endDate)}`;
    }
    if (startDate) {
      return `From ${formatDate(startDate)}`;
    }
    return `Till ${formatDate(endDate!)}`;
  };

  const getAccountsText = () => {
    if (selectedAccounts.length === 0) {
      return 'All Accounts';
    }
    return selectedAccounts.map(a => a.label).join(', ');
  };

  return (
    <Paper
      sx={{
        p: 3,
        mb: 3,
        backgroundColor: '#e8f5e9',
        '@media print': {
          boxShadow: 'none',
          border: '1px solid #ccc',
        },
      }}
    >
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {user && (
          <Typography variant="body2" color="text.secondary">
            <strong>User:</strong> {user.name}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          <strong>Date Range:</strong> {formatDateRange()}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Accounts:</strong> {getAccountsText()}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Currency:</strong> INR
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Report Generated:</strong> {formatDate(generatedAt.toISOString())} {generatedAt.toLocaleTimeString()}
        </Typography>
      </Box>
    </Paper>
  );
};

export default ReportHeader;

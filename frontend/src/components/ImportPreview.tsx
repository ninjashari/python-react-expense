import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Chip,
  Button,
  Alert,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  FileUpload,
  AccountBalance,
  Category,
  Person,
  DateRange,
  AttachMoney,
  Description,
  Visibility,
} from '@mui/icons-material';
import { Account } from '../types';

interface ColumnMappings {
  date: string;
  amount: string;
  description: string;
  payee?: string;
  category?: string;
  transactionType?: string;
}

interface ImportPreviewProps {
  file: File | null;
  account: Account | null;
  columnMappings: ColumnMappings;
  sampleData: any[];
  defaultTransactionType: string;
  onPreviewClick: () => void;
}

const ImportPreview: React.FC<ImportPreviewProps> = ({
  file,
  account,
  columnMappings,
  sampleData,
  defaultTransactionType,
  onPreviewClick,
}) => {
  const getMappedFields = () => {
    const mapped: Array<{ field: string; column: string }> = [];
    const unmapped: string[] = [];

    Object.entries(columnMappings).forEach(([key, value]) => {
      if (value) {
        mapped.push({ field: key, column: value });
      } else {
        unmapped.push(key);
      }
    });

    return { mapped, unmapped };
  };

  const { mapped, unmapped } = getMappedFields();

  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'date':
        return <DateRange />;
      case 'amount':
        return <AttachMoney />;
      case 'description':
        return <Description />;
      case 'payee':
        return <Person />;
      case 'category':
        return <Category />;
      case 'transactionType':
        return <FileUpload />;
      default:
        return <Description />;
    }
  };

  const getFieldDisplayName = (field: string) => {
    switch (field) {
      case 'transactionType':
        return 'Transaction Type';
      case 'payee':
        return 'Payee';
      case 'category':
        return 'Category';
      default:
        return field.charAt(0).toUpperCase() + field.slice(1);
    }
  };

  const estimatedRecords = sampleData.length > 0 ? 'Multiple records detected' : 'Unknown';

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review import configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Please review the settings below before importing your transactions.
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* File Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                File Information
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <FileUpload />
                  </ListItemIcon>
                  <ListItemText
                    primary="File Name"
                    secondary={file?.name || 'No file selected'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <FileUpload />
                  </ListItemIcon>
                  <ListItemText
                    primary="File Size"
                    secondary={file ? `${(file.size / 1024).toFixed(1)} KB` : 'Unknown'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Description />
                  </ListItemIcon>
                  <ListItemText
                    primary="Estimated Records"
                    secondary={estimatedRecords}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Import Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Import Settings
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <AccountBalance />
                  </ListItemIcon>
                  <ListItemText
                    primary="Target Account"
                    secondary={account ? `${account.name} (${account.type})` : 'Not selected'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Category />
                  </ListItemIcon>
                  <ListItemText
                    primary="Default Transaction Type"
                    secondary={defaultTransactionType}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Column Mappings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Column Mappings
              </Typography>
              
              {mapped.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Mapped Fields
                  </Typography>
                  <List dense>
                    {mapped.map(({ field, column }) => (
                      <ListItem key={field}>
                        <ListItemIcon>
                          {getFieldIcon(field)}
                        </ListItemIcon>
                        <ListItemText
                          primary={getFieldDisplayName(field)}
                          secondary={`Column: ${column}`}
                        />
                        <Chip
                          label="Mapped"
                          color="success"
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {unmapped.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Unmapped Fields (will use defaults)
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {unmapped.map((field) => (
                      <Chip
                        key={field}
                        label={getFieldDisplayName(field)}
                        variant="outlined"
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Preview Button */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Visibility />}
              onClick={onPreviewClick}
              size="large"
            >
              Preview Data
            </Button>
          </Box>
        </Grid>

        {/* Important Notes */}
        <Grid item xs={12}>
          <Alert severity="info">
            <Typography variant="subtitle2" gutterBottom>
              What will happen during import:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>New payees and categories will be created automatically if they don't exist</li>
              <li>Transaction amounts will be treated as positive values</li>
              <li>Dates will be parsed automatically from common formats</li>
              <li>Duplicate transactions are not automatically detected</li>
              <li>All transactions will be associated with your selected account</li>
            </ul>
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ImportPreview;
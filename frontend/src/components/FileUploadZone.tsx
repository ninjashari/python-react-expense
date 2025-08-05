import React from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  CloudUpload,
  FileUpload,
} from '@mui/icons-material';

interface FileUploadZoneProps {
  getRootProps: () => any;
  getInputProps: () => any;
  isDragActive: boolean;
  isProcessing: boolean;
}

const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  getRootProps,
  getInputProps,
  isDragActive,
  isProcessing,
}) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select or drag a file to upload
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Supported formats: CSV, Excel (.xlsx, .xls)
      </Typography>

      <Paper
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.300',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
      >
        <input {...getInputProps()} />
        
        {isProcessing ? (
          <Box>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="h6">
              Processing file...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Analyzing columns and preparing data
            </Typography>
          </Box>
        ) : (
          <Box>
            {isDragActive ? (
              <FileUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            ) : (
              <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            )}
            
            <Typography variant="h6" gutterBottom>
              {isDragActive
                ? 'Drop the file here...'
                : 'Drag & drop your file here, or click to select'
              }
            </Typography>
            
            <Typography variant="body2" color="text.secondary">
              Maximum file size: 10MB
            </Typography>
          </Box>
        )}
      </Paper>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Tips for best results:
        </Typography>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            <Typography variant="body2">
              Include column headers in the first row
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              Use date format: YYYY-MM-DD, MM/DD/YYYY, or DD/MM/YYYY
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              Amount should be numeric (decimals allowed)
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              Include transaction type column if available (income/expense/transfer)
            </Typography>
          </li>
        </ul>
      </Box>
    </Box>
  );
};

export default FileUploadZone;
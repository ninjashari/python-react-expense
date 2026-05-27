import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  Alert,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Description,
  Psychology,
  CheckCircle,
  Error,
  Visibility,
  AccountBalance,
} from '@mui/icons-material';

interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  duration?: number;
  details?: string;
  icon: React.ReactNode;
}

interface PDFProcessingProgressProps {
  isProcessing: boolean;
  currentStep: number;
  steps: ProcessingStep[];
  estimatedTime: number;
  onCancel?: () => void;
  processingNotes?: string[];
  extractedCount?: number;
}

const PDFProcessingProgress: React.FC<PDFProcessingProgressProps> = ({
  isProcessing,
  currentStep,
  steps,
  estimatedTime,
  onCancel,
  processingNotes = [],
  extractedCount,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isProcessing) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
        setProgress(prev => Math.min(prev + (100 / estimatedTime), 95));
      }, 1000);
    } else {
      setElapsedTime(0);
      setProgress(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, estimatedTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getStepIcon = (step: ProcessingStep, index: number) => {
    if (step.status === 'completed') {
      return <CheckCircle color="success" />;
    } else if (step.status === 'error') {
      return <Error color="error" />;
    } else if (step.status === 'active') {
      return <CircularProgress size={20} />;
    } else {
      return step.icon;
    }
  };

  const getProgressColor = () => {
    if (currentStep >= steps.length) return 'success';
    if (steps[currentStep]?.status === 'error') return 'error';
    return 'primary';
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">
            Processing PDF Document
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip 
              label={`${formatTime(elapsedTime)} / ~${formatTime(estimatedTime)}`}
              variant="outlined"
              size="small"
            />
            {extractedCount !== undefined && (
              <Chip 
                label={`${extractedCount} transactions found`}
                color="success"
                size="small"
              />
            )}
          </Box>
        </Box>

        {/* Overall Progress Bar */}
        <Box mb={3}>
          <LinearProgress 
            variant={isProcessing ? "determinate" : "indeterminate"}
            value={progress}
            color={getProgressColor()}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {isProcessing ? `Step ${currentStep + 1} of ${steps.length}` : 'Preparing...'}
          </Typography>
        </Box>

        {/* Detailed Steps */}
        <Stepper activeStep={currentStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.id} completed={step.status === 'completed'}>
              <StepLabel 
                icon={getStepIcon(step, index)}
                error={step.status === 'error'}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="subtitle2">
                    {step.label}
                  </Typography>
                  {step.duration && (
                    <Chip 
                      label={formatTime(step.duration)}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary">
                  {step.description}
                </Typography>
                {step.details && (
                  <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                    {step.details}
                  </Typography>
                )}
                {step.status === 'error' && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    Processing failed at this step. Please check your PDF and try again.
                  </Alert>
                )}
              </StepContent>
            </Step>
          ))}
        </Stepper>

        {/* Processing Notes */}
        {processingNotes.length > 0 && (
          <Box mt={3}>
            <Typography variant="subtitle2" gutterBottom>
              Processing Notes
            </Typography>
            <List dense>
              {processingNotes.map((note, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <CheckCircle color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={note} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Cancel Button */}
        {isProcessing && onCancel && (
          <Box display="flex" justifyContent="center" mt={3}>
            <Typography 
              variant="body2" 
              color="primary" 
              sx={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={onCancel}
            >
              Cancel Processing
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// Default processing steps for PDF LLM import
export const createPDFProcessingSteps = (): ProcessingStep[] => [
  {
    id: 'pdf_analysis',
    label: 'Analyzing PDF',
    description: 'Examining PDF structure and determining extraction method',
    status: 'pending',
    icon: <Description />,
  },
  {
    id: 'text_extraction',
    label: 'Extracting Text',
    description: 'Extracting text content using direct extraction or OCR',
    status: 'pending',
    icon: <Visibility />,
  },
  {
    id: 'llm_processing',
    label: 'LLM Analysis',
    description: 'Using AI to identify and extract transaction data',
    status: 'pending',
    icon: <Psychology />,
  },
  {
    id: 'data_validation',
    label: 'Validating Data',
    description: 'Verifying extracted transactions and formatting data',
    status: 'pending',
    icon: <CheckCircle />,
  },
  {
    id: 'account_mapping',
    label: 'Account Integration',
    description: 'Mapping transactions to accounts and creating payees/categories',
    status: 'pending',
    icon: <AccountBalance />,
  },
];

export default PDFProcessingProgress;
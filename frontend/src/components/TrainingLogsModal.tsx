import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';

interface TrainingLog {
  timestamp: string;
  level: string;
  message: string;
}

interface TrainingLogsModalProps {
  open: boolean;
  isTraining: boolean;
  logs: TrainingLog[];
  onClose: () => void;
}

const LogContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: '#1e1e1e',
  color: '#d4d4d4',
  padding: theme.spacing(2),
  maxHeight: 400,
  overflowY: 'auto',
  fontFamily: '"Roboto Mono", monospace',
  fontSize: '0.85rem',
  lineHeight: 1.6,

  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: '#2d2d2d',
  },
  '&::-webkit-scrollbar-thumb': {
    background: '#555',
    borderRadius: '4px',
    '&:hover': {
      background: '#777',
    },
  },
}));

const LogLine = styled(Typography)(() => ({
  fontFamily: '"Roboto Mono", monospace',
  fontSize: '0.85rem',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  marginBottom: '4px',

  '&.AI': {
    color: '#4ec9b0',
  },
  '&.info': {
    color: '#d4d4d4',
  },
  '&.success': {
    color: '#6a9955',
  },
  '&.warning': {
    color: '#dcdcaa',
  },
  '&.error': {
    color: '#f48771',
  },
}));

const TrainingLogsModal: React.FC<TrainingLogsModalProps> = ({
  open,
  isTraining,
  logs,
  onClose,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (message: string): string => {
    if (message.includes('[AI]')) return 'AI';
    if (message.includes('Error') || message.includes('error')) return 'error';
    if (message.includes('Success') || message.includes('success')) return 'success';
    if (message.includes('WARNING') || message.includes('warning')) return 'warning';
    return 'info';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          {isTraining && <CircularProgress size={24} />}
          AI Model Training Progress
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box mb={2}>
          {isTraining && (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Training in progress...
              </Typography>
              <LinearProgress variant="indeterminate" />
            </Box>
          )}
          {!isTraining && logs.length > 0 && (
            <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
              ✓ Training completed successfully
            </Typography>
          )}
        </Box>

        <LogContainer>
          <div ref={scrollRef}>
            {logs.length === 0 ? (
              <LogLine className="info">
                Waiting for training logs...
              </LogLine>
            ) : (
              logs.map((log, index) => (
                <LogLine
                  key={index}
                  className={getLogColor(log.message)}
                >
                  {log.message}
                </LogLine>
              ))
            )}
          </div>
        </LogContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {isTraining ? 'Continue in Background' : 'Close'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TrainingLogsModal;

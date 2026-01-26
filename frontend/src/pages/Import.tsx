import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Close,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useQuery } from '@tanstack/react-query';
import { accountsApi, importApi } from '../services/api';
import { Account, PDFLLMPreviewResponse, PDFLLMImportResponse } from '../types';
import FileUploadZone from '../components/FileUploadZone';
import ColumnMappingStep from '../components/ColumnMappingStep';
import PDFLLMStep from '../components/PDFLLMStep';
import PDFProcessingProgress, { createPDFProcessingSteps } from '../components/PDFProcessingProgress';
import TransactionReviewStep from '../components/TransactionReviewStep';
import ImportPreview from '../components/ImportPreview';
import ImportResults from '../components/ImportResults';

const getSteps = (isLlm: boolean) => 
  isLlm 
    ? ['Upload File', 'Configure', 'Process & Review', 'Import']
    : ['Upload File', 'Configure', 'Preview', 'Import'];

interface ImportData {
  files: File[];
  fileType: string;
  columns: string[];
  sampleData: any[];
  columnMappings: {
    date: string;
    amount: string;
    description: string;
    payee?: string;
    category?: string;
    transactionType?: string;
    withdrawal?: string;  // For ICICI style debit/withdrawal column
    deposit?: string;     // For ICICI style credit/deposit column
  };
  account: Account | null;
  defaultTransactionType: string;
  // PDF LLM specific fields
  isPdfLlm: boolean;
  llmModel?: string;
  pdfPreview?: PDFLLMPreviewResponse;
  llmResults?: PDFLLMImportResponse[];
}

const Import: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [importData, setImportData] = useState<ImportData>({
    files: [],
    fileType: '',
    columns: [],
    sampleData: [],
    columnMappings: {
      date: '',
      amount: '',
      description: '',
    },
    account: null,
    defaultTransactionType: 'expense',
    isPdfLlm: false,
    llmModel: 'llama3.1',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  
  // PDF LLM specific state
  const [processingSteps, setProcessingSteps] = useState(createPDFProcessingSteps());
  const [currentProcessingStep, setCurrentProcessingStep] = useState(0);
  const [isLLMProcessing, setIsLLMProcessing] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    // Check if multiple PDF files are being uploaded
    const pdfFiles = acceptedFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length > 1) {
      alert('Multiple PDF file uploads are not supported. Please upload PDF files one at a time.');
      return;
    }
    
    // Check if mixing PDF with other file types
    if (pdfFiles.length === 1 && acceptedFiles.length > 1) {
      alert('Cannot upload PDF files together with CSV/Excel files. Please upload them separately.');
      return;
    }

    setIsProcessing(true);
    try {
      const file = acceptedFiles[0];
      const fileName = file.name.toLowerCase();
      let fileType = '';
      let isPdfLlm = false;

      // Determine file type from first file
      if (fileName.endsWith('.csv')) {
        fileType = 'csv';
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        fileType = 'excel';
      } else if (fileName.endsWith('.pdf')) {
        fileType = 'pdf';
        isPdfLlm = true;
      }

      if (isPdfLlm) {
        // Handle PDF LLM import (single file only)
        const formData = new FormData();
        formData.append('file', file);
        
        const previewData = await importApi.previewPdfLlm(formData);
        
        setImportData(prev => ({
          ...prev,
          files: [file], // Single file for PDF
          fileType,
          isPdfLlm: true,
          pdfPreview: previewData,
          columns: [],
          sampleData: [],
        }));
        
        // For PDF LLM, skip column mapping and go to account selection
        setActiveStep(1);
      } else {
        // Handle CSV/Excel import - use first file for mapping
        const formData = new FormData();
        formData.append('file', file);
        
        const mappingData = await importApi.getColumnMapping(formData, fileType);
        
        setImportData(prev => ({
          ...prev,
          files: acceptedFiles,
          fileType,
          isPdfLlm: false,
          columns: mappingData.columns,
          sampleData: mappingData.sample_data,
          columnMappings: {
            date: mappingData.suggested_mappings.date || '',
            amount: mappingData.suggested_mappings.amount || '',
            description: mappingData.suggested_mappings.description || '',
            payee: mappingData.suggested_mappings.payee || '',
            category: mappingData.suggested_mappings.category || '',
            transactionType: mappingData.suggested_mappings.transaction_type || '',
            withdrawal: mappingData.suggested_mappings.withdrawal || '',
            deposit: mappingData.suggested_mappings.deposit || '',
          },
        }));
        
        setActiveStep(1);
      }
    } catch (error) {
      console.error('Error processing file:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 15,
  });

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setImportData({
      files: [],
      fileType: '',
      columns: [],
      sampleData: [],
      columnMappings: {
        date: '',
        amount: '',
        description: '',
      },
      account: null,
      defaultTransactionType: 'expense',
      isPdfLlm: false,
      llmModel: 'llama3.1',
    });
    setImportResults(null);
    // Reset PDF LLM specific state
    setIsLLMProcessing(false);
    setCurrentProcessingStep(0);
    setProcessingSteps(createPDFProcessingSteps());
  };

  const handlePDFLLMProcessing = async () => {
    if (!importData.files || importData.files.length === 0 || !importData.account) return;

    setIsLLMProcessing(true);
    setCurrentProcessingStep(0);

    try {
      // Reset processing steps
      const steps = createPDFProcessingSteps();
      setProcessingSteps(steps);

      // Step 1: PDF Analysis
      steps[0].status = 'active';
      setProcessingSteps([...steps]);
      setCurrentProcessingStep(0);

      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time

      // Step 2: Text Extraction
      steps[0].status = 'completed';
      steps[1].status = 'active';
      setProcessingSteps([...steps]);
      setCurrentProcessingStep(1);

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 3: LLM Processing
      steps[1].status = 'completed';
      steps[1].details = `Using ${importData.pdfPreview?.extraction_method || 'text extraction'}`;
      steps[2].status = 'active';
      setProcessingSteps([...steps]);
      setCurrentProcessingStep(2);

      // Process all files
      const allResults: PDFLLMImportResponse[] = [];
      for (const file of importData.files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('account_id', importData.account.id.toString());
        formData.append('llm_model', importData.llmModel || 'llama3.1');
        formData.append('preview_only', 'true'); // Preview mode first

        const results = await importApi.importPdfLlm(formData);
        allResults.push(results);
      }

      // Step 4: Data Validation
      steps[2].status = 'completed';
      steps[2].details = `Model: ${importData.llmModel}, Files: ${importData.files.length}`;
      steps[3].status = 'active';
      setProcessingSteps([...steps]);
      setCurrentProcessingStep(3);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 5: Account Mapping
      steps[3].status = 'completed';
      steps[4].status = 'active';
      setProcessingSteps([...steps]);
      setCurrentProcessingStep(4);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Complete
      steps[4].status = 'completed';
      setProcessingSteps([...steps]);
      setCurrentProcessingStep(5);

      // Store results for review
      setImportData(prev => ({ ...prev, llmResults: allResults }));

    } catch (error) {
      console.error('LLM processing error:', error);
      const steps = [...processingSteps];
      steps[currentProcessingStep].status = 'error';
      setProcessingSteps(steps);
    } finally {
      setIsLLMProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!importData.files || importData.files.length === 0 || !importData.account) return;

    setIsProcessing(true);
    try {
      let results: any;

      if (importData.isPdfLlm && importData.llmResults) {
        // Handle LLM final import with reviewed transactions from all files
        const allTransactions = importData.llmResults.flatMap(result => result.transactions);
        console.log('Importing transactions:', allTransactions.length, 'transactions from', importData.llmResults.length, 'files');
        console.log('Sample transaction:', allTransactions[0]);
        console.log('Account ID:', importData.account.id);
        results = await importApi.importTransactionsBatch(
          allTransactions,
          importData.account.id
        );
        console.log('Import results:', results);
      } else {
        // Handle CSV/Excel import - process all files
        const allResults = [];
        for (const file of importData.files) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('account_id', importData.account.id.toString());
          formData.append('date_column', importData.columnMappings.date);
          formData.append('amount_column', importData.columnMappings.amount);
          formData.append('description_column', importData.columnMappings.description);
          formData.append('default_transaction_type', importData.defaultTransactionType);
          
          if (importData.columnMappings.payee) {
            formData.append('payee_column', importData.columnMappings.payee);
          }
          if (importData.columnMappings.category) {
            formData.append('category_column', importData.columnMappings.category);
          }
          if (importData.columnMappings.transactionType) {
            formData.append('transaction_type_column', importData.columnMappings.transactionType);
          }
          if (importData.columnMappings.withdrawal) {
            formData.append('withdrawal_column', importData.columnMappings.withdrawal);
          }
          if (importData.columnMappings.deposit) {
            formData.append('deposit_column', importData.columnMappings.deposit);
          }

          if (importData.fileType === 'csv') {
            const fileResult = await importApi.importCsv(formData);
            allResults.push(fileResult);
          } else {
            const fileResult = await importApi.importExcel(formData);
            allResults.push(fileResult);
          }
        }
        
        // Combine results from all files
        const totalTransactionsCreated = allResults.reduce((sum, r) => sum + (r.transactions_created || 0), 0);
        results = {
          success: allResults.every(r => r.success !== false),
          message: `Imported from ${allResults.length} file${allResults.length !== 1 ? 's' : ''}`,
          transactions_created: totalTransactionsCreated,
          errors: allResults.flatMap(r => r.errors || []),
        };
      }

      setImportResults(results);
      setActiveStep(3);
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <>
            <FileUploadZone
              getRootProps={getRootProps}
              getInputProps={getInputProps}
              isDragActive={isDragActive}
              isProcessing={isProcessing}
            />
            {importData.files.length > 0 && (
              <Box mt={3}>
                <Typography variant="h6" gutterBottom>
                  Selected Files ({importData.files.length})
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>File Name</TableCell>
                        <TableCell align="right">Size</TableCell>
                        <TableCell align="right">Type</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {importData.files.map((file, index) => (
                        <TableRow key={index}>
                          <TableCell>{file.name}</TableCell>
                          <TableCell align="right">
                            {(file.size / 1024).toFixed(2)} KB
                          </TableCell>
                          <TableCell align="right">
                            {file.name.split('.').pop()?.toUpperCase()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </>
        );
      case 1:
        return importData.isPdfLlm ? (
          <PDFLLMStep
            accounts={accounts || []}
            selectedAccount={importData.account}
            llmModel={importData.llmModel || 'llama3.1'}
            pdfPreview={importData.pdfPreview}
            onAccountChange={(account) => 
              setImportData(prev => ({ ...prev, account }))
            }
            onModelChange={(model) => 
              setImportData(prev => ({ ...prev, llmModel: model }))
            }
          />
        ) : (
          <ColumnMappingStep
            columns={importData.columns}
            sampleData={importData.sampleData}
            columnMappings={importData.columnMappings}
            accounts={accounts || []}
            selectedAccount={importData.account}
            defaultTransactionType={importData.defaultTransactionType}
            onMappingChange={(mappings) => 
              setImportData(prev => ({ ...prev, columnMappings: mappings }))
            }
            onAccountChange={(account) => 
              setImportData(prev => ({ ...prev, account }))
            }
            onTransactionTypeChange={(type) => 
              setImportData(prev => ({ ...prev, defaultTransactionType: type }))
            }
          />
        );
      case 2:
        if (importData.isPdfLlm) {
          // PDF LLM Processing and Review
          if (!importData.llmResults && !isLLMProcessing) {
            // Show start processing button
            return (
              <Box textAlign="center" py={4}>
                <Typography variant="h6" gutterBottom>
                  Ready to Process PDF
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Click below to start extracting transactions from your PDF using AI
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handlePDFLLMProcessing}
                  disabled={!importData.account || !importData.pdfPreview?.has_financial_data}
                >
                  Start AI Processing
                </Button>
              </Box>
            );
          } else if (isLLMProcessing) {
            // Show processing progress
            return (
              <PDFProcessingProgress
                isProcessing={isLLMProcessing}
                currentStep={currentProcessingStep}
                steps={processingSteps}
                estimatedTime={importData.pdfPreview?.estimated_processing_time || 15}
                processingNotes={importData.llmResults?.[0]?.processing_notes || []}
                extractedCount={importData.llmResults?.reduce((sum, r) => sum + (r.transactions?.length || 0), 0)}
              />
            );
          } else if (importData.llmResults) {
            // Show transaction review - combine all transactions from multiple files
            const allTransactions = importData.llmResults.flatMap(r => r.transactions || []);
            const firstResult = importData.llmResults[0];
            
            return (
              <TransactionReviewStep
                transactions={allTransactions}
                account={importData.account!}
                onTransactionsChange={(transactions) => 
                  setImportData(prev => ({ 
                    ...prev, 
                    llmResults: prev.llmResults ? [
                      { ...prev.llmResults[0], transactions }
                    ] : undefined 
                  }))
                }
                onConfirm={handleImport}
                extractionMethod={firstResult.extraction_method}
                processingNotes={firstResult.processing_notes || []}
                isImporting={isProcessing}
              />
            );
          }
        } else {
          // Regular CSV/Excel preview
          return (
            <ImportPreview
              file={importData.files[0]}
              account={importData.account}
              columnMappings={importData.columnMappings}
              sampleData={importData.sampleData}
              defaultTransactionType={importData.defaultTransactionType}
              onPreviewClick={() => setPreviewDialogOpen(true)}
            />
          );
        }
        return null;
      case 3:
        return (
          <ImportResults
            results={importResults}
            onStartOver={handleReset}
          />
        );
      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return importData.files.length > 0;
      case 1:
        if (importData.isPdfLlm) {
          return importData.account !== null && importData.pdfPreview?.has_financial_data;
        } else {
          const hasAmountField = importData.columnMappings.amount || 
            (importData.columnMappings.withdrawal && importData.columnMappings.deposit);
          return (
            importData.columnMappings.date &&
            hasAmountField &&
            importData.columnMappings.description &&
            importData.account
          );
        }
      case 2:
        if (importData.isPdfLlm) {
          // For PDF LLM import, can proceed if we have LLM results and not currently processing
          const totalTransactions = importData.llmResults?.reduce((sum, r) => sum + (r.transactions?.length || 0), 0) || 0;
          return importData.llmResults && !isLLMProcessing && totalTransactions > 0;
        } else {
          return true; // Regular import can always proceed to import step
        }
      default:
        return false;
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Import Transactions
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {getSteps(importData.isPdfLlm).map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ minHeight: 400 }}>
          {getStepContent(activeStep)}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
          <Button
            color="inherit"
            disabled={activeStep === 0 || activeStep === 3}
            onClick={handleBack}
            sx={{ mr: 1 }}
          >
            Back
          </Button>
          <Box sx={{ flex: '1 1 auto' }} />
          {activeStep === getSteps(importData.isPdfLlm).length - 1 ? (
            <Button onClick={handleReset} variant="contained">
              Import More Files
            </Button>
          ) : activeStep === 2 && !importData.isPdfLlm ? (
            <Button
              onClick={handleImport}
              variant="contained"
              disabled={!canProceed() || isProcessing}
              startIcon={isProcessing ? <CircularProgress size={20} /> : null}
            >
              {isProcessing ? 'Importing...' : 'Import Transactions'}
            </Button>
          ) : activeStep === 2 && importData.isPdfLlm && importData.llmResults ? (
            // PDF LLM: Transaction review step - import is handled by the review component
            null
          ) : (
            <Button
              onClick={handleNext}
              variant="contained"
              disabled={!canProceed() || isLLMProcessing}
            >
              Next
            </Button>
          )}
        </Box>
      </Paper>

      {/* Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Data Preview
          <IconButton
            aria-label="close"
            onClick={() => setPreviewDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {importData.columns.map((column) => (
                    <TableCell key={column}>{column}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {importData.sampleData.slice(0, 10).map((row, index) => (
                  <TableRow key={index}>
                    {importData.columns.map((column) => (
                      <TableCell key={column}>
                        {row[column]?.toString() || '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Import;
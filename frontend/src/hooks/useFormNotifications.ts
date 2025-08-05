import { useCallback } from 'react';
import { FieldError, FieldErrors } from 'react-hook-form';
import { useToast } from '../contexts/ToastContext';

// Hook for form-related notifications
export const useFormNotifications = () => {
  const toast = useToast();

  // Show validation errors from react-hook-form
  const showValidationErrors = useCallback((errors: FieldErrors) => {
    const errorMessages: string[] = [];
    
    const extractErrors = (fieldErrors: FieldErrors, prefix = '') => {
      Object.keys(fieldErrors).forEach(key => {
        const error = fieldErrors[key];
        const fieldName = prefix ? `${prefix}.${key}` : key;
        
        if (error?.message) {
          errorMessages.push(`${fieldName}: ${error.message}`);
        } else if (error && typeof error === 'object' && !Array.isArray(error)) {
          extractErrors(error as FieldErrors, fieldName);
        }
      });
    };

    extractErrors(errors);

    if (errorMessages.length > 0) {
      if (errorMessages.length === 1) {
        toast.showError(errorMessages[0]);
      } else {
        toast.showError(`Please fix the following errors:\n${errorMessages.join('\n')}`);
      }
    }
  }, [toast]);

  // Show success for form submissions
  const showFormSuccess = useCallback((action: string, resourceName?: string) => {
    const resource = resourceName || 'item';
    switch (action.toLowerCase()) {
      case 'create':
      case 'created':
        toast.showSuccess(`${resource} created successfully!`);
        break;
      case 'update':
      case 'updated':
        toast.showSuccess(`${resource} updated successfully!`);
        break;
      case 'delete':
      case 'deleted':
        toast.showSuccess(`${resource} deleted successfully!`);
        break;
      case 'save':
      case 'saved':
        toast.showSuccess(`${resource} saved successfully!`);
        break;
      default:
        toast.showSuccess(`${action} completed successfully!`);
    }
  }, [toast]);

  // Show form submission error
  const showFormError = useCallback((action: string, error: string, resourceName?: string) => {
    const resource = resourceName || 'item';
    toast.showError(`Failed to ${action} ${resource}: ${error}`);
  }, [toast]);

  // Show form field validation warning
  const showFieldWarning = useCallback((field: string, message: string) => {
    toast.showWarning(`${field}: ${message}`);
  }, [toast]);

  // Show form auto-save notification
  const showAutoSave = useCallback((success: boolean) => {
    if (success) {
      toast.showInfo('Changes saved automatically', 2000);
    } else {
      toast.showWarning('Auto-save failed. Please save manually.');
    }
  }, [toast]);

  // Show form reset notification
  const showFormReset = useCallback(() => {
    toast.showInfo('Form has been reset');
  }, [toast]);

  // Show form import success/error
  const showImportResult = useCallback((success: boolean, count?: number, errors?: string[]) => {
    if (success) {
      const message = count ? `Successfully imported ${count} items` : 'Import completed successfully';
      toast.showSuccess(message);
    } else {
      toast.showError('Import failed. Please check your file and try again.');
    }

    if (errors && errors.length > 0) {
      toast.showWarning(`Import completed with warnings: ${errors.join(', ')}`);
    }
  }, [toast]);

  return {
    showValidationErrors,
    showFormSuccess,
    showFormError,
    showFieldWarning,
    showAutoSave,
    showFormReset,
    showImportResult,
  };
};
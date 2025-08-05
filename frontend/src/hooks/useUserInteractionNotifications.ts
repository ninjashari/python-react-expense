import { useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';

// Hook for user interaction notifications
export const useUserInteractionNotifications = () => {
  const toast = useToast();

  // Copy to clipboard notifications
  const showCopySuccess = useCallback((content?: string) => {
    const message = content ? `Copied "${content}" to clipboard` : 'Copied to clipboard';
    toast.showSuccess(message, 3000);
  }, [toast]);

  const showCopyError = useCallback(() => {
    toast.showError('Failed to copy to clipboard');
  }, [toast]);

  // File download notifications
  const showDownloadStart = useCallback((fileName?: string) => {
    const message = fileName ? `Downloading ${fileName}...` : 'Download started...';
    toast.showInfo(message, 3000);
  }, [toast]);

  const showDownloadSuccess = useCallback((fileName?: string) => {
    const message = fileName ? `${fileName} downloaded successfully` : 'Download completed';
    toast.showSuccess(message);
  }, [toast]);

  const showDownloadError = useCallback((fileName?: string) => {
    const message = fileName ? `Failed to download ${fileName}` : 'Download failed';
    toast.showError(message);
  }, [toast]);

  // File upload notifications
  const showUploadStart = useCallback((fileName?: string) => {
    const message = fileName ? `Uploading ${fileName}...` : 'Upload started...';
    toast.showInfo(message);
  }, [toast]);

  const showUploadProgress = useCallback((progress: number, fileName?: string) => {
    const file = fileName || 'file';
    toast.showInfo(`Uploading ${file}: ${progress}%`, 2000);
  }, [toast]);

  const showUploadSuccess = useCallback((fileName?: string) => {
    const message = fileName ? `${fileName} uploaded successfully` : 'Upload completed';
    toast.showSuccess(message);
  }, [toast]);

  const showUploadError = useCallback((error: string, fileName?: string) => {
    const file = fileName || 'file';
    toast.showError(`Failed to upload ${file}: ${error}`);
  }, [toast]);

  // Search and filter notifications
  const showSearchResults = useCallback((count: number, query: string) => {
    if (count === 0) {
      toast.showInfo(`No results found for "${query}"`);
    } else {
      toast.showInfo(`Found ${count} result${count === 1 ? '' : 's'} for "${query}"`, 3000);
    }
  }, [toast]);

  const showFilterApplied = useCallback((filterCount: number) => {
    const message = filterCount === 1 ? '1 filter applied' : `${filterCount} filters applied`;
    toast.showInfo(message, 3000);
  }, [toast]);

  const showFiltersCleared = useCallback(() => {
    toast.showInfo('All filters cleared', 3000);
  }, [toast]);

  // Data export notifications
  const showExportStart = useCallback((format: string) => {
    toast.showInfo(`Preparing ${format.toUpperCase()} export...`);
  }, [toast]);

  const showExportSuccess = useCallback((format: string, recordCount?: number) => {
    const records = recordCount ? ` (${recordCount} records)` : '';
    toast.showSuccess(`${format.toUpperCase()} export completed${records}`);
  }, [toast]);

  const showExportError = useCallback((format: string, error: string) => {
    toast.showError(`${format.toUpperCase()} export failed: ${error}`);
  }, [toast]);

  // Bulk operations notifications
  const showBulkSelectionChange = useCallback((selectedCount: number, totalCount: number) => {
    if (selectedCount === 0) {
      toast.showInfo('Selection cleared', 2000);
    } else if (selectedCount === totalCount) {
      toast.showInfo(`All ${totalCount} items selected`, 2000);
    } else {
      toast.showInfo(`${selectedCount} of ${totalCount} items selected`, 2000);
    }
  }, [toast]);

  const showBulkActionStart = useCallback((action: string, count: number) => {
    toast.showInfo(`${action} ${count} item${count === 1 ? '' : 's'}...`);
  }, [toast]);

  const showBulkActionComplete = useCallback((action: string, successCount: number, failCount: number = 0) => {
    if (failCount === 0) {
      toast.showSuccess(`${action} completed for ${successCount} item${successCount === 1 ? '' : 's'}`);
    } else {
      toast.showWarning(`${action} completed: ${successCount} successful, ${failCount} failed`);
    }
  }, [toast]);

  // Settings and preferences notifications
  const showSettingsSaved = useCallback(() => {
    toast.showSuccess('Settings saved successfully');
  }, [toast]);

  const showSettingsReset = useCallback(() => {
    toast.showInfo('Settings reset to defaults');
  }, [toast]);

  const showPreferenceUpdated = useCallback((preference: string) => {
    toast.showSuccess(`${preference} preference updated`);
  }, [toast]);

  // Theme and UI notifications
  const showThemeChanged = useCallback((theme: string) => {
    toast.showInfo(`Switched to ${theme} theme`, 3000);
  }, [toast]);

  const showLanguageChanged = useCallback((language: string) => {
    toast.showInfo(`Language changed to ${language}`, 3000);
  }, [toast]);

  // Keyboard shortcuts notifications
  const showShortcutUsed = useCallback((shortcut: string, action: string) => {
    toast.showInfo(`Shortcut used: ${shortcut} → ${action}`, 2000);
  }, [toast]);

  // Data synchronization notifications
  const showSyncStart = useCallback(() => {
    toast.showInfo('Synchronizing data...');
  }, [toast]);

  const showSyncSuccess = useCallback(() => {
    toast.showSuccess('Data synchronized successfully');
  }, [toast]);

  const showSyncError = useCallback((error: string) => {
    toast.showError(`Synchronization failed: ${error}`);
  }, [toast]);

  const showSyncConflict = useCallback((conflictCount: number) => {
    toast.showWarning(`Sync completed with ${conflictCount} conflict${conflictCount === 1 ? '' : 's'} - manual review required`);
  }, [toast]);

  // Undo/Redo notifications
  const showUndoSuccess = useCallback((action: string) => {
    toast.showInfo(`Undid: ${action}`, 3000);
  }, [toast]);

  const showRedoSuccess = useCallback((action: string) => {
    toast.showInfo(`Redid: ${action}`, 3000);
  }, [toast]);

  const showUndoUnavailable = useCallback(() => {
    toast.showInfo('Nothing to undo', 2000);
  }, [toast]);

  const showRedoUnavailable = useCallback(() => {
    toast.showInfo('Nothing to redo', 2000);
  }, [toast]);

  return {
    // Clipboard
    showCopySuccess,
    showCopyError,
    
    // File operations
    showDownloadStart,
    showDownloadSuccess,
    showDownloadError,
    showUploadStart,
    showUploadProgress,
    showUploadSuccess,
    showUploadError,
    
    // Search and filtering
    showSearchResults,
    showFilterApplied,
    showFiltersCleared,
    
    // Export
    showExportStart,
    showExportSuccess,
    showExportError,
    
    // Bulk operations
    showBulkSelectionChange,
    showBulkActionStart,
    showBulkActionComplete,
    
    // Settings
    showSettingsSaved,
    showSettingsReset,
    showPreferenceUpdated,
    
    // Theme/UI
    showThemeChanged,
    showLanguageChanged,
    
    // Shortcuts
    showShortcutUsed,
    
    // Sync
    showSyncStart,
    showSyncSuccess,
    showSyncError,
    showSyncConflict,
    
    // Undo/Redo
    showUndoSuccess,
    showRedoSuccess,
    showUndoUnavailable,
    showRedoUnavailable,
  };
};
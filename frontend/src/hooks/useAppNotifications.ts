import { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

// Hook for app-level notifications (network status, etc.)
export const useAppNotifications = () => {
  const toast = useToast();

  useEffect(() => {
    // Network status notifications
    const handleOnline = () => {
      toast.showSuccess('Connection restored! You are back online.');
    };

    const handleOffline = () => {
      toast.showWarning('You are currently offline. Some features may not work properly.');
    };

    // Visibility change notifications (when user comes back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User came back to the tab - could refresh data here
        console.log('User returned to app');
      }
    };

    // Unhandled promise rejection notifications
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      // Don't show toast for expected API errors (they're handled elsewhere)
      const reason = event.reason;
      if (reason?.message && !reason.message.includes('Session expired')) {
        toast.showError('An unexpected error occurred. Please try again.');
      }
    };

    // Browser storage quota notifications
    const checkStorageQuota = async () => {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          const usage = estimate.usage || 0;
          const quota = estimate.quota || 0;
          const percentUsed = (usage / quota) * 100;

          if (percentUsed > 80) {
            toast.showWarning('Storage space is running low. Consider clearing browser data.');
          }
        } catch (error) {
          // Ignore storage check errors
        }
      }
    };

    // Memory usage warning (if available)
    const checkMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedPercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        if (usedPercent > 90) {
          toast.showWarning('High memory usage detected. Consider refreshing the page.');
        }
      }
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Initial checks
    if (!navigator.onLine) {
      toast.showWarning('You appear to be offline. Some features may not work properly.');
    }

    // Periodic checks
    const storageCheckInterval = setInterval(checkStorageQuota, 60000); // Every minute
    const memoryCheckInterval = setInterval(checkMemoryUsage, 30000); // Every 30 seconds

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      clearInterval(storageCheckInterval);
      clearInterval(memoryCheckInterval);
    };
  }, [toast]);

  // Function to manually trigger app notifications
  const notifyAppUpdate = () => {
    toast.showInfo('A new version is available! Please refresh the page to update.');
  };

  const notifyMaintenanceMode = (message?: string) => {
    toast.showWarning(message || 'The application is currently undergoing maintenance. Some features may be temporarily unavailable.');
  };

  const notifyDataSynced = () => {
    toast.showSuccess('Data synchronized successfully.');
  };

  const notifyBulkOperation = (operation: string, count: number, success: boolean) => {
    if (success) {
      toast.showSuccess(`${operation} completed successfully for ${count} items.`);
    } else {
      toast.showError(`${operation} failed for some items. Please try again.`);
    }
  };

  const notifyImportProgress = (progress: number, total: number) => {
    if (progress === total) {
      toast.showSuccess(`Import completed! ${total} items processed successfully.`);
    } else if (progress % 10 === 0 || progress === total - 1) {
      // Show progress every 10 items or on the last item
      toast.showInfo(`Import progress: ${progress}/${total} items processed...`);
    }
  };

  const notifyValidationWarning = (message: string) => {
    toast.showWarning(`Validation warning: ${message}`);
  };

  const notifyQuickAction = (action: string) => {
    toast.showInfo(`Quick action: ${action}`, 3000); // Shorter duration for quick actions
  };

  return {
    notifyAppUpdate,
    notifyMaintenanceMode,
    notifyDataSynced,
    notifyBulkOperation,
    notifyImportProgress,
    notifyValidationWarning,
    notifyQuickAction,
  };
};
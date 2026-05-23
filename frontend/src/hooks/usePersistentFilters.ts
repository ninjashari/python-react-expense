import { useState, useEffect } from 'react';

/**
 * Custom hook to persist filters in localStorage
 * @param key - The localStorage key to store filters under
 * @param defaultFilters - The default filter values
 */
export function usePersistentFilters<T>(key: string, defaultFilters: T) {
  // Initialize state with values from localStorage or defaults
  const [filters, setFiltersState] = useState<T>(() => {
    try {
      const savedFilters = localStorage.getItem(key);
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        // Merge saved filters with defaults to ensure all required fields exist
        return { ...defaultFilters, ...parsed };
      }
    } catch (error) {
      console.warn(`Failed to parse saved filters for key "${key}":`, error);
    }
    return defaultFilters;
  });

  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(filters));
    } catch (error) {
      console.warn(`Failed to save filters to localStorage for key "${key}":`, error);
    }
  }, [filters, key]);

  // Enhanced setFilters that also saves to localStorage
  const setFilters = (updater: T | ((prev: T) => T)) => {
    setFiltersState(prevFilters => {
      const newFilters = typeof updater === 'function' 
        ? (updater as (prev: T) => T)(prevFilters) 
        : updater;
      return newFilters;
    });
  };

  // Function to clear saved filters and reset to defaults
  const clearSavedFilters = () => {
    try {
      localStorage.removeItem(key);
      setFiltersState(defaultFilters);
    } catch (error) {
      console.warn(`Failed to clear saved filters for key "${key}":`, error);
    }
  };

  return {
    filters,
    setFilters,
    clearSavedFilters
  };
}
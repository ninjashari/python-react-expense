import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to persist filters in localStorage.
 * setFilters and clearSavedFilters are memoized so they have stable references
 * and do not cause useEffect re-runs in consumer components.
 */
export function usePersistentFilters<T>(key: string, defaultFilters: T) {
  const [filters, setFiltersState] = useState<T>(() => {
    try {
      const savedFilters = localStorage.getItem(key);
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        return { ...defaultFilters, ...parsed };
      }
    } catch (error) {
      console.warn(`Failed to parse saved filters for key "${key}":`, error);
    }
    return defaultFilters;
  });

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(filters));
    } catch (error) {
      console.warn(`Failed to save filters to localStorage for key "${key}":`, error);
    }
  }, [filters, key]);

  // Stable reference — won't change between renders
  const setFilters = useCallback((updater: T | ((prev: T) => T)) => {
    setFiltersState(prevFilters => {
      return typeof updater === 'function'
        ? (updater as (prev: T) => T)(prevFilters)
        : updater;
    });
  }, []);

  // Stable reference — won't change between renders
  const clearSavedFilters = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setFiltersState(defaultFilters);
    } catch (error) {
      console.warn(`Failed to clear saved filters for key "${key}":`, error);
    }
  // defaultFilters is a plain object literal defined in the consumer — treat as stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { filters, setFilters, clearSavedFilters };
}

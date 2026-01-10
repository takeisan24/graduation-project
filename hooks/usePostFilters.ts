/**
 * usePostFilters Hook
 * Manages filter state for posts (platform, date, search)
 */

'use client'

import { useState, useCallback } from 'react'

interface FilterState {
  platformFilter: string
  dateFilter: 'newest' | 'oldest'
  searchTerm: string
}

/**
 * Custom hook for managing post filter state
 * 
 * @returns Filter state and setter functions
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     platformFilter,
 *     dateFilter,
 *     searchTerm,
 *     setPlatformFilter,
 *     setDateFilter,
 *     setSearchTerm,
 *     resetFilters
 *   } = usePostFilters()
 * 
 *   return (
 *     <FilterBar
 *       platformFilter={platformFilter}
 *       onPlatformChange={setPlatformFilter}
 *       dateFilter={dateFilter}
 *       onDateChange={setDateFilter}
 *       searchTerm={searchTerm}
 *       onSearchChange={setSearchTerm}
 *     />
 *   )
 * }
 * ```
 */
export function usePostFilters(initialState?: Partial<FilterState>) {
  const [filters, setFilters] = useState<FilterState>({
    platformFilter: initialState?.platformFilter || 'all',
    dateFilter: initialState?.dateFilter || 'newest',
    searchTerm: initialState?.searchTerm || ''
  })

  const setPlatformFilter = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, platformFilter: value }))
  }, [])

  const setDateFilter = useCallback((value: 'newest' | 'oldest') => {
    setFilters(prev => ({ ...prev, dateFilter: value }))
  }, [])

  const setSearchTerm = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, searchTerm: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({
      platformFilter: 'all',
      dateFilter: 'newest',
      searchTerm: ''
    })
  }, [])

  return {
    // Individual values
    platformFilter: filters.platformFilter,
    dateFilter: filters.dateFilter,
    searchTerm: filters.searchTerm,
    
    // Setters
    setPlatformFilter,
    setDateFilter,
    setSearchTerm,
    
    // Utilities
    resetFilters,
    
    // Complete state object (for advanced use)
    filters
  }
}

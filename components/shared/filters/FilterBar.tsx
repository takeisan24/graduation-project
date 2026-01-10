/**
 * FilterBar Component
 * Complete filter UI combining platform, date, and search filters
 */

'use client'

import { PlatformFilter } from './PlatformFilter'
import { DateFilter } from './DateFilter'
import { SearchBar } from './SearchBar'

interface FilterBarProps {
  platformFilter: string
  dateFilter: 'newest' | 'oldest'
  searchTerm: string
  onPlatformChange: (value: string) => void
  onDateChange: (value: 'newest' | 'oldest') => void
  onSearchChange: (value: string) => void
  className?: string
}

/**
 * Complete filter bar with platform, date, and search filters
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
 *     setSearchTerm
 *   } = usePostFilters()
 * 
 *   return (
 *     <FilterBar
 *       platformFilter={platformFilter}
 *       dateFilter={dateFilter}
 *       searchTerm={searchTerm}
 *       onPlatformChange={setPlatformFilter}
 *       onDateChange={setDateFilter}
 *       onSearchChange={setSearchTerm}
 *     />
 *   )
 * }
 * ```
 */
export function FilterBar({
  platformFilter,
  dateFilter,
  searchTerm,
  onPlatformChange,
  onDateChange,
  onSearchChange,
  className = ''
}: FilterBarProps) {
  return (
    <div className={`flex gap-4 mb-3 ${className}`}>
      <PlatformFilter
        value={platformFilter}
        onChange={onPlatformChange}
      />
      
      <DateFilter
        value={dateFilter}
        onChange={onDateChange}
      />
      
      <SearchBar
        value={searchTerm}
        onChange={onSearchChange}
      />
    </div>
  )
}

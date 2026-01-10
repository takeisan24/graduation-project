/**
 * SearchBar Component
 * Reusable search input with icon
 */

'use client'

import { useTranslations } from 'next-intl'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * Search bar component with magnifying glass icon
 * 
 * @example
 * ```tsx
 * <SearchBar
 *   value={searchTerm}
 *   onChange={setSearchTerm}
 * />
 * ```
 */
export function SearchBar({
  value,
  onChange,
  placeholder,
  className = ''
}: SearchBarProps) {
  const tCommon = useTranslations('Common');
  const actualPlaceholder = placeholder || tCommon('searchPlaceholder');
  
  return (
    <div className={`flex-1 relative ${className}`}>
      <div className="relative">
        <svg 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
          />
        </svg>
        <input
          type="text"
          placeholder={actualPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-[#2A2A30] border border-[#3A3A42] rounded-lg text-[#F5F5F7] placeholder-gray-400 focus:outline-none focus:border-[#E33265] transition-colors"
        />
      </div>
    </div>
  )
}

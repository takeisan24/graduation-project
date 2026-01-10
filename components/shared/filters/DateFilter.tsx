/**
 * DateFilter Component
 * Dropdown select for date sorting
 */

'use client'

import { useTranslations } from 'next-intl'

interface DateFilterProps {
  value: 'newest' | 'oldest'
  onChange: (value: 'newest' | 'oldest') => void
  className?: string
}

/**
 * Date filter dropdown component
 * 
 * @example
 * ```tsx
 * <DateFilter
 *   value={dateFilter}
 *   onChange={setDateFilter}
 * />
 * ```
 */
export function DateFilter({
  value,
  onChange,
  className = ''
}: DateFilterProps) {
  const tCommon = useTranslations('Common');
  
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as 'newest' | 'oldest')}
        className="appearance-none flex items-center gap-2 px-4 py-2 bg-[#2A2A30] border border-[#3A3A42] rounded-lg text-[#F5F5F7] hover:bg-[#3A3A42] transition-colors cursor-pointer pr-8"
      >
        <option value="newest">{tCommon('newest')}</option>
        <option value="oldest">{tCommon('oldest')}</option>
      </select>
      <svg 
        className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M19 9l-7 7-7-7" 
        />
      </svg>
    </div>
  )
}

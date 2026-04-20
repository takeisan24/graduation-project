/**
 * useFilteredPosts Hook
 * Filters and sorts posts based on criteria
 */

'use client'

import { useMemo } from 'react'
import { filterAndSortPosts } from '@/lib/utils/filterUtils'

interface FilterablePost {
  platform: string
  platformIcon?: string
  content: string
  time: string
  [key: string]: any
}

/**
 * Custom hook for filtering and sorting posts
 * Uses memoization for performance
 * 
 * @param posts - Array of posts to filter
 * @param searchTerm - Search term to filter by
 * @param platformFilter - Platform to filter by ('all' for no filter)
 * @param dateFilter - Sort order ('newest' or 'oldest')
 * @returns Filtered and sorted posts array
 * 
 * @example
 * ```tsx
 * function MyComponent({ posts }) {
 *   const {
 *     platformFilter,
 *     dateFilter,
 *     searchTerm
 *   } = usePostFilters()
 * 
 *   const filteredPosts = useFilteredPosts(
 *     posts,
 *     searchTerm,
 *     platformFilter,
 *     dateFilter
 *   )
 * 
 *   return (
 *     <div>
 *       {filteredPosts.map(post => (
 *         <PostCard key={post.id} post={post} />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useFilteredPosts<T extends FilterablePost>(
  posts: T[],
  searchTerm: string,
  platformFilter: string,
  dateFilter: 'newest' | 'oldest'
): T[] {
  return useMemo(() => {
    return filterAndSortPosts(
      posts,
      searchTerm,
      platformFilter,
      dateFilter
    )
  }, [posts, searchTerm, platformFilter, dateFilter])
}

/**
 * Extended version with additional filtering options
 */
export function useFilteredPostsExtended<T extends FilterablePost>(
  posts: T[],
  options: {
    searchTerm: string
    platformFilter: string
    dateFilter: 'newest' | 'oldest'
    customFilter?: (post: T) => boolean
  }
): {
  filteredPosts: T[]
  totalCount: number
  filteredCount: number
} {
  const { searchTerm, platformFilter, dateFilter, customFilter } = options

  const result = useMemo(() => {
    let filtered = filterAndSortPosts(
      posts,
      searchTerm,
      platformFilter,
      dateFilter
    )

    // Apply custom filter if provided
    if (customFilter) {
      filtered = filtered.filter(customFilter)
    }

    return {
      filteredPosts: filtered,
      totalCount: posts.length,
      filteredCount: filtered.length
    }
  }, [posts, searchTerm, platformFilter, dateFilter, customFilter])

  return result
}

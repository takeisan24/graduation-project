/**
 * Filter Helper Functions
 * Business logic for filtering and sorting posts
 */

import { normalizePlatformKey } from '@/lib/utils/platform'

interface FilterablePost {
  platform: string
  platformIcon?: string
  content: string
  time: string
  [key: string]: any
}

/**
 * Filter and sort posts based on criteria
 * @param posts - Array of posts to filter
 * @param searchTerm - Search term to filter by
 * @param platformFilter - Platform to filter by ('all' for no filter)
 * @param dateFilter - Sort order ('newest' or 'oldest')
 * @returns Filtered and sorted posts array
 */
export function filterAndSortPosts<T extends FilterablePost>(
  posts: T[],
  searchTerm: string,
  platformFilter: string,
  dateFilter: 'newest' | 'oldest'
): T[] {
  const filtered = posts.filter(post => {
    const normalizedPostPlatform = normalizePlatformKey(post.platform)
    const normalizedPostIcon = post.platformIcon ? normalizePlatformKey(post.platformIcon) : null
    const normalizedFilter = normalizePlatformKey(platformFilter)

    // Search filter
    const matchesSearch = searchTerm === "" ||
      post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.platform.toLowerCase().includes(searchTerm.toLowerCase())

    // Platform filter
    const matchesPlatform = platformFilter === "all" ||
      normalizedPostPlatform === normalizedFilter ||
      normalizedPostIcon === normalizedFilter

    return matchesSearch && matchesPlatform
  })

  // Date sort
  if (dateFilter === "newest") {
    filtered.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  } else {
    filtered.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  }

  return filtered
}

/**
 * Search posts by term
 * @param posts - Array of posts
 * @param searchTerm - Search term
 * @returns Filtered posts
 */
export function searchPosts<T extends FilterablePost>(
  posts: T[],
  searchTerm: string
): T[] {
  if (!searchTerm) return posts
  
  const term = searchTerm.toLowerCase()
  return posts.filter(post =>
    post.content.toLowerCase().includes(term) ||
    post.platform.toLowerCase().includes(term)
  )
}

/**
 * Filter posts by platform
 * @param posts - Array of posts
 * @param platform - Platform to filter by
 * @returns Filtered posts
 */
export function filterByPlatform<T extends FilterablePost>(
  posts: T[],
  platform: string
): T[] {
  if (platform === 'all') return posts
  
  return posts.filter(post =>
    normalizePlatformKey(post.platform) === normalizePlatformKey(platform) ||
    (post.platformIcon ? normalizePlatformKey(post.platformIcon) === normalizePlatformKey(platform) : false)
  )
}

/**
 * Sort posts by date
 * @param posts - Array of posts
 * @param order - Sort order ('newest' or 'oldest')
 * @returns Sorted posts
 */
export function sortByDate<T extends FilterablePost>(
  posts: T[],
  order: 'newest' | 'oldest'
): T[] {
  const sorted = [...posts]
  
  if (order === 'newest') {
    sorted.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  } else {
    sorted.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  }
  
  return sorted
}

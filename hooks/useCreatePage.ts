"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { saveToLocalStorage, loadFromLocalStorage } from "@/lib/utils/storage"
import { CalendarEvent } from "@/lib/types/calendar"

/**
 * Main hook for managing create page state and functionality
 * Centralizes all state management and provides event handlers
 */
export function useCreatePage() {
  const searchParams = useSearchParams()
  
  // Main navigation state
  const [activeSection, setActiveSection] = useState("create")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [language, setLanguage] = useState<'vi' | 'en'>('vi')
  
  // Post management state
  const [openPosts, setOpenPosts] = useState<Array<{ id: number; type: string }>>([])
  const [selectedPostId, setSelectedPostId] = useState<number>(0)
  const [postContents, setPostContents] = useState<Record<number, string>>({})
  
  // Track which post is linked to which calendar event
  const [postToEventMap, setPostToEventMap] = useState<Record<number, { eventId: string, dateKey: string }>>({})
  
  // Modal states
  const [showPostPicker, setShowPostPicker] = useState(false)
  const [isPostPickerVisible, setIsPostPickerVisible] = useState(false)
  const [showClonePicker, setShowClonePicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSourceModal, setShowSourceModal] = useState(false)
  
  // Media state
  const [uploadedMedia, setUploadedMedia] = useState<Array<{
    id: string
    type: 'image' | 'video'
    preview: string
    file: File
  }>>([])
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  
  // Calendar state
  const [calendarEvents, setCalendarEvents] = useState<Record<string, CalendarEvent[]>>({})
  
  // Posts data state
  const [draftPosts, setDraftPosts] = useState<Array<{
    id: number
    platform: string
    platformIcon?: string
    content: string
    time: string
    status: string
    media?: string[]
  }>>([])
  
  const [publishedPosts, setPublishedPosts] = useState<Array<{
    id: number
    platform: string
    content: string
    time: string
    status: string
    url: string
    profileName?: string
    profilePic?: string
    engagement?: {
      likes: number
      comments: number
      shares: number
    }
  }>>([])
  
  const [failedPosts, setFailedPosts] = useState<Array<{
    id: number
    platform: string
    content: string
    date: string
    time: string
    error?: string
    profileName?: string
    profilePic?: string
    url?: string
  }>>([])
  // Retry UI states (for potential global popups)
  const [showRetryLoading, setShowRetryLoading] = useState(false)
  const [showRetryResult, setShowRetryResult] = useState(false)
  const [retrySuccess, setRetrySuccess] = useState(false)
  const [retryFailureReason, setRetryFailureReason] = useState("")
  
  // Video projects state
  const [videoProjects, setVideoProjects] = useState<Array<{
    id: string
    title: string
    thumbnail: string
    duration: string
    createdAt: string
    status: 'processing' | 'completed' | 'failed'
  }>>([])
  
  // API state
  const [apiStats, setApiStats] = useState({
    apiCalls: 1247,
    successRate: 98.5,
    rateLimit: {
      used: 750,
      total: 1000,
      resetTime: "2h 15m"
    }
  })
  
  const [apiKeys, setApiKeys] = useState<Array<{
    id: string
    name: string
    type: 'production' | 'development'
    lastUsed: string
    isActive: boolean
  }>>([
    {
      id: '1',
      name: 'Production Key',
      type: 'production',
      lastUsed: '2 hours ago',
      isActive: true
    },
    {
      id: '2',
      name: 'Development Key',
      type: 'development',
      lastUsed: '1 day ago',
      isActive: true
    }
  ])
  
  
  // Refs
  const postPickerRef = useRef<HTMLDivElement>(null)
  const clonePickerRef = useRef<HTMLDivElement>(null)
  
  // Initialize active section from URL and open platform if provided
  useEffect(() => {
    const section = searchParams.get("section")
    if (section) {
      setActiveSection(section)
    }
    
    // Only handle platform if there's no eventId or draftId (those are handled by their own useEffects)
    const platform = searchParams.get('platform')
    const eventId = searchParams.get('eventId')
    const draftId = searchParams.get('draftId')
    
    if (platform && section === 'create' && !eventId && !draftId) {
      const pretty = platform.charAt(0).toUpperCase() + platform.slice(1)
      const newId = Date.now()
      setOpenPosts(prev => [...prev, { id: newId, type: pretty }])
      setPostContents(prev => ({ ...prev, [newId]: '' }))
      setSelectedPostId(newId)
    }
  }, [searchParams])

  // If a draftId is present in URL, open it in the editor exactly once
  useEffect(() => {
    const draftIdParam = searchParams.get('draftId')
    if (!draftIdParam) return
    const draftId = Number(draftIdParam)
    const draft = draftPosts.find(d => d.id === draftId)
    if (!draft) return

    // Switch to create and open a tab with the draft content
    setActiveSection('create')
    const existing = openPosts.find(p => p.type === draft.platform)
    let targetId = existing?.id
    if (!targetId) {
      targetId = Date.now()
      setOpenPosts(prev => [...prev, { id: targetId!, type: draft.platform }])
    }
    setPostContents(prev => ({ ...prev, [targetId!]: draft.content }))
    setSelectedPostId(targetId!)
  }, [searchParams, draftPosts])

  // If an eventId is present in URL, open it in the editor from calendar events
  useEffect(() => {
    const eventIdParam = searchParams.get('eventId')
    if (!eventIdParam) return

    // Find the event in calendarEvents by searching all dates
    let foundEvent: CalendarEvent | null = null
    let foundDateKey: string | null = null
    for (const dateKey in calendarEvents) {
      const eventsOnDate = calendarEvents[dateKey]
      // Check if eventsOnDate is an array before calling .find()
      if (Array.isArray(eventsOnDate)) {
        foundEvent = eventsOnDate.find(e => e.id === eventIdParam) || null
        if (foundEvent) {
          foundDateKey = dateKey
          break
        }
      }
    }

    if (!foundEvent || !foundDateKey) return

    // Switch to create section and open a tab with the event content
    setActiveSection('create')
    const existing = openPosts.find(p => p.type === foundEvent!.platform)
    let targetId = existing?.id
    if (!targetId) {
      targetId = Date.now()
      setOpenPosts(prev => [...prev, { id: targetId!, type: foundEvent!.platform }])
    }
    setPostContents(prev => ({ ...prev, [targetId!]: foundEvent!.content || '' }))
    setSelectedPostId(targetId!)
    
    // Track this post is linked to the calendar event
    setPostToEventMap(prev => ({
      ...prev,
      [targetId!]: { eventId: eventIdParam, dateKey: foundDateKey! }
    }))
  }, [searchParams, calendarEvents])

  
  // Load data from localStorage on mount
  useEffect(() => {
    // Clear any previously saved/open tabs and their contents
    try {
      localStorage.removeItem('openPosts')
      localStorage.removeItem('postContents')
    } catch {}
    
    setOpenPosts([])
    setSelectedPostId(0)
    
    // Load post contents
    const savedPostContents = loadFromLocalStorage('postContents', {})
    if (Object.keys(savedPostContents).length > 0) {
      setPostContents(savedPostContents)
    }
    
    // Load calendar events
    const savedCalendarEvents = loadFromLocalStorage('calendarEvents', {})
    if (Object.keys(savedCalendarEvents).length > 0) {
      setCalendarEvents(savedCalendarEvents)
    }
    
    // Load draft posts; if none, seed curated VN drafts for demonstration
    const savedDraftPosts = loadFromLocalStorage('draftPosts', [])
    if ((savedDraftPosts || []).length > 0) {
      const cleanedDrafts = (savedDraftPosts as any[]).filter(d => (d?.content || '').toString().trim().length > 0)
      setDraftPosts(cleanedDrafts)
      if (cleanedDrafts.length !== (savedDraftPosts as any[]).length) {
        saveToLocalStorage('draftPosts', cleanedDrafts)
      }
    } else {
      // Generate 30 long-form Vietnamese drafts across platforms between June and September
      const platforms = ['Twitter','Instagram','LinkedIn','Facebook','Threads','Bluesky','YouTube','TikTok','Pinterest'] as const
      const year = new Date().getFullYear()
      const start = new Date(year, 5, 1) // June 1 (0-based month)
      const end = new Date(year, 8, 30) // Sept 30
      const between = (idx: number, total: number) => {
        const t = start.getTime() + ((end.getTime() - start.getTime()) * idx) / Math.max(total - 1, 1)
        return new Date(t)
      }
      const baseThoughts = [
        'Ghi chú nhanh cho chiến lược nội dung tuần này',
        'Ý tưởng triển khai chuỗi bài viết nhiều phần',
        'Tối ưu tông giọng cho nhóm khán giả mới',
        'Tái sử dụng nội dung để tăng hiệu suất',
        'Thử nghiệm A/B cho câu mở đầu thu hút',
        'Danh sách hashtag phù hợp theo chủ đề',
        'Kế hoạch trả lời bình luận để tăng tương tác',
        'Cách kể chuyện ngắn gọn mà vẫn truyền cảm',
        'Gợi ý CTA tự nhiên, không gây khó chịu',
        'Lịch đăng thử nghiệm theo múi giờ'
      ]
      const extraChunks = [
        'Mỗi đoạn nên tập trung một ý chính, rõ ràng, dễ hành động.',
        'Thêm ví dụ thực tế để người đọc dễ hình dung và áp dụng.',
        'Giữ câu ngắn nhưng không cụt, ưu tiên mạch logic tự nhiên.',
        'Tổng hợp phản hồi để cải thiện bài viết kế tiếp.',
        'Nhấn mạnh lợi ích, giảm mô tả tính năng khô khan.',
        'Kèm đường dẫn tài nguyên học thêm khi phù hợp.',
        'Hình ảnh nên nhất quán về màu sắc và bố cục.',
        'Theo dõi số liệu sau 24–48 giờ để rút kinh nghiệm.',
        'Đặt câu hỏi gợi mở để khuyến khích thảo luận.',
        'Tránh thuật ngữ quá hàn lâm khi không thật cần thiết.'
      ]
      const makeLong = (seed: string, i: number) => {
        let out = seed
        let k = 0
        const words = () => out.split(/\s+/).filter(Boolean).length
        while (words() < 65) {
          out += ' ' + extraChunks[(i + k) % extraChunks.length]
          k++
        }
        return out
      }
      const drafts = Array.from({ length: 30 }).map((_, i) => {
        const plat = platforms[i % platforms.length]
        const when = between(i, 30)
        const yyyy = when.getFullYear()
        const mm = String(when.getMonth() + 1).padStart(2, '0')
        const dd = String(when.getDate()).padStart(2, '0')
        const seed = `${baseThoughts[i % baseThoughts.length]}: triển khai cho ${plat} với nội dung có chiều sâu, tập trung giá trị thực tế và ví dụ minh họa.`
        return {
          id: Date.now() + 1000 + i,
          platform: plat,
          platformIcon: plat,
          content: makeLong(seed, i),
          time: `${yyyy}-${mm}-${dd}`,
          status: 'draft'
        }
      }) as any
      setDraftPosts(drafts)
      saveToLocalStorage('draftPosts', drafts)
    }
    
    // Load published posts
    const savedPublishedPosts = loadFromLocalStorage('publishedPosts', [])
    if (savedPublishedPosts.length > 0) {
      // Sanitize invalid/missing dates to valid ISO strings
      const year = new Date().getFullYear()
      const rngStart = new Date(year, 5, 1).getTime()
      const rngEnd = new Date(year, 8, 30, 23, 59).getTime()
      const safeISO = (t: any, idx: number) => {
        const d = new Date(t)
        if (!isNaN(d.getTime())) return d.toISOString()
        const r = rngStart + Math.floor(((rngEnd - rngStart) * (idx + 1)) / (savedPublishedPosts.length + 1))
        return new Date(r).toISOString()
      }
      const sanitized = savedPublishedPosts.map((p: any, i: number) => ({
        ...p,
        time: safeISO(p?.time, i)
      }))
      setPublishedPosts(sanitized)
      saveToLocalStorage('publishedPosts', sanitized)
    }
    
    // Load failed posts
    const savedFailedPosts = loadFromLocalStorage('failedPosts', [])
    if (savedFailedPosts.length > 0) {
      // Remove legacy error text from all failed posts and improve placeholder content
      const vnThoughts = [
        'Hôm nay đi dạo và chợt nghĩ: đôi khi im lặng cũng là câu trả lời.',
        'Khi vui hãy viết lại, sau này đọc sẽ thấy mình đã mạnh mẽ thế nào.',
        'Sáng nay cà phê đắng hơn mọi khi, nhưng lại tỉnh táo lạ thường.',
        'Bài học nhỏ: chậm lại không phải là dừng lại.',
        'Gió chiều thổi, mang theo mùi mưa rất dễ chịu.',
        'Việc nhỏ làm đều đặn còn mạnh hơn kế hoạch lớn bỏ dở.',
        'Nếu có thể, hãy nói cảm ơn với chính mình của hôm qua.',
        'Một ý tưởng vụt qua: viết ngắn nhưng để lại dư âm dài.',
        'Hôm nay thử làm một việc khó – kết quả chưa hoàn hảo nhưng mình vui.',
        'Tối yên tĩnh là lúc ý tưởng xuất hiện nhiều nhất.',
        'Nụ cười của ai đó luôn là năng lượng rất thật.',
        'Đang đọc lại vài ghi chú cũ và thấy mình đã thay đổi nhiều.',
        'Có những ngày chỉ cần hoàn thành một việc nhỏ là đủ.',
        'Âm nhạc khiến mọi chuyện trở nên nhẹ hơn một chút.',
        'Khi bối rối, hãy dọn bàn làm việc trước.',
        'Một tách trà nóng và một danh sách việc cần làm – bắt đầu thôi!',
        'Đôi khi điều mình cần chỉ là hít thở thật sâu.',
        'Ghi nhớ: kiên nhẫn là kỹ năng, không phải tính cách bẩm sinh.',
        'Thử nghiệm mới: đi bộ 10 phút trước khi làm việc.',
        'Câu nói thích nhất hôm nay: “Làm ít nhưng đều”.'
      ]
      const extraChunks = [
        'Mình ghi lại để mai xem có còn thấy đúng không.',
        'Nếu mai bận, ít nhất hôm nay đã viết đôi dòng.',
        'Dường như thời tiết ảnh hưởng rất nhiều đến tâm trạng.',
        'Tò mò không biết mọi người có cảm nhận giống mình không.',
        'Có lẽ tối nay sẽ dành vài phút để tổng kết lại.',
      ]
      const makeLong = (base: string, idx: number) => {
        let out = base + ' ' + extraChunks[idx % extraChunks.length]
        let k = 0
        const words = () => out.split(/\s+/).filter(Boolean).length
        while (words() < 60) {
          out += ' ' + extraChunks[(idx + k) % extraChunks.length]
          // add small elaborations to boost word count
          out += ' ' + 'Mình ghi thêm một chút để ghi nhớ cảm xúc lúc này và lý do vì sao ý tưởng xuất hiện.'
          k++
        }
        return out
      }
      const longVN = vnThoughts.map((b, i) => makeLong(b, i))
      const cleaned = savedFailedPosts.map((p: any, i: number) => ({
        ...p,
        error: '',
        content: (p.content && !p.content.startsWith('Đăng bài thất bại')) ? p.content : longVN[i % longVN.length]
      }))
      setFailedPosts(cleaned)
      saveToLocalStorage('failedPosts', cleaned)
    }

    // If no data, seed mock Vietnamese data
    const needSeedDrafts = (savedDraftPosts || []).length === 0
    const needSeedPublished = (savedPublishedPosts || []).length === 0
    const needSeedFailed = (savedFailedPosts || []).length === 0

    const platforms = ['Twitter','Instagram','LinkedIn','Facebook','Threads','Bluesky','YouTube','TikTok','Pinterest'] as const

    const randomPlatform = () => platforms[Math.floor(Math.random() * platforms.length)]
    const randomContent = (plat: string, i: number) => (
      `Bài viết ${i + 1} trên ${plat}: Chia sẻ trải nghiệm hằng ngày, mẹo hữu ích và cảm hứng. #${i + 1}`
    )
    const formatViDate = (d: Date) => d.toISOString()
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))

    // Generate dates from tháng 6 đến hôm nay (evenly spread)
    const generateDateBetween = (start: Date, end: Date, idx: number, total: number) => {
      const t = start.getTime() + ((end.getTime() - start.getTime()) * idx) / Math.max(total - 1, 1)
      return new Date(t)
    }

    if (needSeedPublished) {
      const year = new Date().getFullYear()
      const start = new Date(year, 5, 1) // June 1
      const end = new Date(year, 8, 30) // Sept 30
      const baseThoughts = [
        'Ghi chú nhanh cho chiến lược nội dung tuần này',
        'Ý tưởng triển khai chuỗi bài viết nhiều phần',
        'Tối ưu tông giọng cho nhóm khán giả mới',
        'Tái sử dụng nội dung để tăng hiệu suất',
        'Thử nghiệm A/B cho câu mở đầu thu hút',
        'Danh sách hashtag phù hợp theo chủ đề',
        'Kế hoạch trả lời bình luận để tăng tương tác',
        'Cách kể chuyện ngắn gọn mà vẫn truyền cảm',
        'Gợi ý CTA tự nhiên, không gây khó chịu',
        'Lịch đăng thử nghiệm theo múi giờ'
      ]
      const extraChunks = [
        'Mỗi đoạn nên tập trung một ý chính, rõ ràng, dễ hành động.',
        'Thêm ví dụ thực tế để người đọc dễ hình dung và áp dụng.',
        'Giữ câu ngắn nhưng không cụt, ưu tiên mạch logic tự nhiên.',
        'Tổng hợp phản hồi để cải thiện bài viết kế tiếp.',
        'Nhấn mạnh lợi ích, giảm mô tả tính năng khô khan.',
        'Kèm đường dẫn tài nguyên học thêm khi phù hợp.',
        'Hình ảnh nên nhất quán về màu sắc và bố cục.',
        'Theo dõi số liệu sau 24–48 giờ để rút kinh nghiệm.',
        'Đặt câu hỏi gợi mở để khuyến khích thảo luận.',
        'Tránh thuật ngữ quá hàn lâm khi không thật cần thiết.'
      ]
      const makeLong = (seed: string, i: number) => {
        let out = seed
        let k = 0
        const words = () => out.split(/\s+/).filter(Boolean).length
        while (words() < 65) {
          out += ' ' + extraChunks[(i + k) % extraChunks.length]
          k++
        }
        return out
      }
      const mockPublished = Array.from({ length: 30 }).map((_, i) => {
        const platform = randomPlatform()
        const when = generateDateBetween(start, end, i, 30)
        const seed = `${baseThoughts[i % baseThoughts.length]}: triển khai cho ${platform} với ví dụ cụ thể và giá trị áp dụng ngay.`
        return {
          id: Date.now() + i,
          platform,
          content: makeLong(seed, i),
          time: formatViDate(when),
          status: 'published',
          url: `https://${platform.toLowerCase()}.com/bai-viet/${Date.now() + i}`,
          engagement: {
            likes: Math.floor(Math.random() * 500),
            comments: Math.floor(Math.random() * 120),
            shares: Math.floor(Math.random() * 60)
          }
        }
      })
      setPublishedPosts(mockPublished as any)
      saveToLocalStorage('publishedPosts', mockPublished)
    }

    // Do not seed drafts; keep empty until user saves

    if (needSeedFailed) {
      const end = new Date()
      const start = new Date(end.getFullYear(), end.getMonth() - 2, 1)
      const vnThoughts = [
        'Hôm nay đi dạo và chợt nghĩ: đôi khi im lặng cũng là câu trả lời.',
        'Khi vui hãy viết lại, sau này đọc sẽ thấy mình đã mạnh mẽ thế nào.',
        'Sáng nay cà phê đắng hơn mọi khi, nhưng lại tỉnh táo lạ thường.',
        'Bài học nhỏ: chậm lại không phải là dừng lại.',
        'Gió chiều thổi, mang theo mùi mưa rất dễ chịu.',
        'Việc nhỏ làm đều đặn còn mạnh hơn kế hoạch lớn bỏ dở.',
        'Nếu có thể, hãy nói cảm ơn với chính mình của hôm qua.',
        'Một ý tưởng vụt qua: viết ngắn nhưng để lại dư âm dài.',
        'Hôm nay thử làm một việc khó – kết quả chưa hoàn hảo nhưng mình vui.',
        'Tối yên tĩnh là lúc ý tưởng xuất hiện nhiều nhất.',
        'Nụ cười của ai đó luôn là năng lượng rất thật.',
        'Đang đọc lại vài ghi chú cũ và thấy mình đã thay đổi nhiều.',
        'Có những ngày chỉ cần hoàn thành một việc nhỏ là đủ.',
        'Âm nhạc khiến mọi chuyện trở nên nhẹ hơn một chút.',
        'Khi bối rối, hãy dọn bàn làm việc trước.',
        'Một tách trà nóng và một danh sách việc cần làm – bắt đầu thôi!',
        'Đôi khi điều mình cần chỉ là hít thở thật sâu.',
        'Ghi nhớ: kiên nhẫn là kỹ năng, không phải tính cách bẩm sinh.',
        'Thử nghiệm mới: đi bộ 10 phút trước khi làm việc.',
        'Câu nói thích nhất hôm nay: “Làm ít nhưng đều”.'
      ]
      const extraChunks = [
        'Mình ghi lại để mai xem có còn thấy đúng không.',
        'Nếu mai bận, ít nhất hôm nay đã viết đôi dòng.',
        'Dường như thời tiết ảnh hưởng rất nhiều đến tâm trạng.',
        'Tò mò không biết mọi người có cảm nhận giống mình không.',
        'Có lẽ tối nay sẽ dành vài phút để tổng kết lại.',
      ]
      const makeLong = (base: string, idx: number) => {
        let out = base + ' ' + extraChunks[idx % extraChunks.length]
        let k = 0
        const words = () => out.split(/\s+/).filter(Boolean).length
        while (words() < 60) {
          out += ' ' + extraChunks[(idx + k) % extraChunks.length]
          out += ' ' + 'Mình ghi thêm một chút để ghi nhớ cảm xúc lúc này và lý do vì sao ý tưởng xuất hiện.'
          k++
        }
        return out
      }
      const longVN = vnThoughts.map((b, i) => makeLong(b, i))
      const mockFailed = Array.from({ length: 20 }).map((_, i) => {
        const platform = randomPlatform()
        const when = generateDateBetween(start, end, i, 20)
        const yyyy = when.getFullYear()
        const mm = pad(when.getMonth() + 1)
        const dd = pad(when.getDate())
        const hh = pad(when.getHours())
        const mi = pad(when.getMinutes())
        return {
          id: Date.now() + 2000 + i,
          platform,
          content: longVN[i % longVN.length],
          date: `${yyyy}-${mm}-${dd}`,
          time: `${hh}:${mi}`,
          error: '',
          url: `https://${platform.toLowerCase()}.com/bai-viet/that-bai/${Date.now() + i}`
        }
      })
      setFailedPosts(mockFailed as any)
      saveToLocalStorage('failedPosts', mockFailed)
    }
  }, [])
  
  // Event handlers
  const handlePostSelect = (id: number) => {
    setSelectedPostId(id)
  }
  
  const handlePostCreate = (type: string): number => {
    const newPostId = Date.now() + Math.floor(Math.random() * 1000000)
    const newPost = { id: newPostId, type: type }

    // Cập nhật posts sử dụng functional update để tránh stale closures
    setOpenPosts((prev) => [...prev, newPost])
    setPostContents((prev) => ({ ...prev, [newPostId]: '' }))
    setSelectedPostId(newPostId) // Tự động chọn bài đăng mới tạo

    console.log("Đã tạo bài đăng mới với ID:", newPostId, "Loại:", type)
    return newPostId

  }
  
  const handlePostDelete = (id: number) => {
    const remaining = openPosts.filter(p => p.id !== id)
    setOpenPosts(remaining)
    const nextId = remaining.length > 0 ? remaining[0].id : 0
    setSelectedPostId(nextId)
    setPostContents(prev => {
      const updated = { ...prev }
      delete updated[id]
      return updated
    })
  }

  // Create a new post tab prefilled with provided content and focus it
  const handleCreatePostWithContent = (type: string, content: string) => {
    const newId = Date.now()
    setOpenPosts(prev => [...prev, { id: newId, type }])
    setPostContents(prev => {
      const updated = { ...prev, [newId]: content }
      saveToLocalStorage('postContents', updated)
      return updated
    })
    setSelectedPostId(newId)
  }

  // Clone current post into a new tab with same content
  const handleClonePost = (postId: number) => {
    const post = openPosts.find(p => p.id === postId)
    if (!post) return
    const newId = Date.now()
    const content = postContents[postId] || ""
    setOpenPosts(prev => [...prev, { id: newId, type: post.type }])
    setPostContents(prev => ({ ...prev, [newId]: content }))
    setSelectedPostId(newId)
  }

  // Save draft content for current post
  const handleSaveDraft = (postId: number) => {
    const content = postContents[postId] || ""
    const draft: any = {
      id: postId,
      platform: openPosts.find(p => p.id === postId)?.type || 'Unknown',
      content,
      time: new Date().toISOString(),
      status: 'draft'
    }
    const updated = [...draftPosts.filter(d => d.id !== postId), draft]
    setDraftPosts(updated)
    saveToLocalStorage('draftPosts', updated)
  }
  
  const handlePostContentChange = (id: number, content: string) => {
    const updatedPostContents = { ...postContents, [id]: content }
    saveToLocalStorage('postContents', updatedPostContents)
    setPostContents((prev) => ({
      ...prev,
      [id]: content, // Cập nhật nội dung cho đúng ID
    }));
    
    // If this post is linked to a calendar event, update the event's content
    const eventMapping = postToEventMap[id]
    if (eventMapping) {
      const { eventId, dateKey } = eventMapping
      setCalendarEvents(prev => {
        const updated = { ...prev }
        if (updated[dateKey] && Array.isArray(updated[dateKey])) {
          updated[dateKey] = updated[dateKey].map(event => 
            event.id === eventId ? { ...event, content } : event
          )
          saveToLocalStorage('calendarEvents', updated)
        }
        return updated
      })
    }
  }

  
  const handleMediaUpload = (files: File[]) => {
    const mediaFiles = files.map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type: file.type.startsWith('image/') ? 'image' as const : 'video' as const,
      preview: URL.createObjectURL(file),
      file
    }))
    setUploadedMedia(prev => [...prev, ...mediaFiles])
  }
  
  const handleMediaRemove = (mediaId: string) => {
    setUploadedMedia(prev => prev.filter(media => media.id !== mediaId))
  }
  
  const handlePublish = (postId: number) => {
    const post = openPosts.find(p => p.id === postId)
    if (post) {
      // Move to published posts
      const publishedPost = {
        id: postId,
        platform: post.type,
        content: postContents[postId] || "",
        time: new Date().toISOString(),
        status: 'published',
        url: `https://${post.type.toLowerCase()}.com/post/${postId}`,
        engagement: {
          likes: Math.floor(Math.random() * 100),
          comments: Math.floor(Math.random() * 20),
          shares: Math.floor(Math.random() * 10)
        }
      }
      setPublishedPosts(prev => [...prev, publishedPost])
      saveToLocalStorage('publishedPosts', [...publishedPosts, publishedPost])
      
      // Record a green calendar note for "Bây giờ"
      try {
        const now = new Date()
        const y = now.getFullYear()
        const m = now.getMonth()
        const d = now.getDate()
        const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
        const time24 = `${pad(now.getHours())}:${pad(now.getMinutes())}`
        const key = `${y}-${m}-${d}`
        const newEvent: CalendarEvent = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          platform: post.type,
          time: time24,
          status: 'posted',
          noteType: 'green' as const,
          url: `https://${post.type.toLowerCase()}.com/post/${postId}`
        }
        const updated = {
          ...calendarEvents,
          [key]: [...(calendarEvents[key] || []), newEvent]
        }
        setCalendarEvents(updated)
        saveToLocalStorage('calendarEvents', updated)
      } catch {}

      // Remove from open posts
      handlePostDelete(postId)
    }
  }
  
  const handleEditDraft = (post: any) => {
    try {
      setActiveSection('create')
      try { window.history.pushState(null, '', `/create?section=create&draftId=${post.id}`) } catch {}
      const existing = openPosts.find(p => p.type === post.platform)
      let targetId = existing?.id
      if (!targetId) {
        targetId = Date.now()
        setOpenPosts(prev => [...prev, { id: targetId!, type: post.platform }])
      }
      setPostContents(prev => ({ ...prev, [targetId!]: post.content || '' }))
      setSelectedPostId(targetId!)
      saveToLocalStorage('postContents', { ...postContents, [targetId!]: post.content || '' })
    } catch (e) {
      console.error('Failed opening draft in editor', e)
    }
  }
  
  const handleDeleteDraft = (id: number) => {
    setDraftPosts(prev => prev.filter(p => p.id !== id))
    saveToLocalStorage('draftPosts', draftPosts.filter(p => p.id !== id))
  }
  
  const handlePublishDraft = (id: number) => {
    const draft = draftPosts.find(p => p.id === id)
    if (draft) {
      handlePublish(id)
      handleDeleteDraft(id)
    }
  }
  
  const handleViewPost = (url: string) => {
    window.open(url, '_blank')
  }
  
  const handleRetryPost = (id: number, rescheduleDate?: string, rescheduleTime?: string) => {
    const post = failedPosts.find(p => p.id === id)
    if (!post) return

    // Helper to derive failure reason
    const platform = (post.platform || '').toLowerCase()
    const contentLength = (post.content || '').length
    const characterLimits: Record<string, number> = {
      twitter: 280,
      facebook: 2200,
      instagram: 2200,
      linkedin: 3000,
      threads: 500,
      tiktok: 2200,
      bluesky: 300,
      youtube: 5000,
      pinterest: 500
    }
    const limit = characterLimits[platform] ?? 2200
    const err = (post.error || '').toLowerCase()
    const isContentIssue = contentLength > limit || err.includes('character') || err.includes('limit') || err.includes('policy')

    // Remove from failed posts
    const updatedFailedPosts = failedPosts.filter(p => p.id !== id)
    setFailedPosts(updatedFailedPosts)
    saveToLocalStorage('failedPosts', updatedFailedPosts)

    // If reschedule date and time are provided, add to calendar
    if (rescheduleDate && rescheduleTime) {
      const dateObj = new Date(rescheduleDate)
      const year = dateObj.getFullYear()
      const month = dateObj.getMonth()
      const day = dateObj.getDate()
      const dateKey = `${year}-${month}-${day}`

      const newEvent: CalendarEvent = {
        id: `event-${Date.now()}`,
        platform: post.platform,
        content: post.content,
        time: rescheduleTime,
        status: 'scheduled',
        noteType: 'yellow'
      }

      setCalendarEvents(prev => {
        const updated = { ...prev }
        if (!updated[dateKey]) {
          updated[dateKey] = []
        }
        updated[dateKey] = [...updated[dateKey], newEvent]
        saveToLocalStorage('calendarEvents', updated)
        return updated
      })
    } else if (isContentIssue) {
      // Content issue => open in editor
      const newPostId = Date.now()
      setOpenPosts(prev => [...prev, { id: newPostId, type: post.platform }])
      setSelectedPostId(newPostId)
      setPostContents(prev => ({ ...prev, [newPostId]: post.content }))
      setActiveSection('create')
    } else {
      // Show loading, then simulate result for non-scheduled retries
      setShowRetryLoading(true)
      setTimeout(() => {
        const isSuccess = Math.random() > 0.4
        if (isSuccess) {
          const newPublishedPost = {
            id: Date.now(),
            content: post.content,
            platform: post.platform,
            time: new Date().toISOString(),
            status: 'published' as const,
            url: `https://${post.platform.toLowerCase()}.com/post/${Date.now()}`
          }
          const updatedPublished = [...publishedPosts, newPublishedPost as any]
          setPublishedPosts(updatedPublished)
          saveToLocalStorage('publishedPosts', updatedPublished)
        } else {
          const failureMessage = 'Kết nối kém. Vui lòng thử lại.'
          const updatedFailed = [...failedPosts, { ...post, error: failureMessage }]
          setFailedPosts(updatedFailed)
          saveToLocalStorage('failedPosts', updatedFailed)
          setRetryFailureReason(failureMessage)
        }
        setShowRetryLoading(false)
        setRetrySuccess(isSuccess)
        setShowRetryResult(true)
      }, 2000)
    }
  }
  
  const handleDeletePost = (id: number) => {
    setPublishedPosts(prev => prev.filter(p => p.id !== id))
    setFailedPosts(prev => prev.filter(p => p.id !== id))
  }
  
  const handleVideoUpload = () => {
    // Implementation for video upload
    console.log('Video upload')
  }
  
  const handleVideoEdit = (projectId: string) => {
    // Implementation for video editing
    console.log('Edit video:', projectId)
  }
  
  const handleVideoDelete = (projectId: string) => {
    setVideoProjects(prev => prev.filter(p => p.id !== projectId))
  }
  
  const handleEventAdd = (year: number, month: number, day: number, platform: string) => {
    const key = `${year}-${month}-${day}`
    // Tạo ID duy nhất cho sự kiện: timestamp + random string
    const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newEvent = {
      id: eventId,
      platform,
      time: '',
      status: 'Trống',
      noteType: 'yellow' as const
    }
    setCalendarEvents(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), newEvent]
    }))
    saveToLocalStorage('calendarEvents', {
      ...calendarEvents,
      [key]: [...(calendarEvents[key] || []), newEvent]
    })
  }

  // Update event (for drag-and-drop or time editing)
  const handleEventUpdate = (
    oldYear: number, oldMonth: number, oldDay: number, oldEvent: CalendarEvent,
    newYear: number, newMonth: number, newDay: number, newTime?: string
  ) => {
    const oldKey = `${oldYear}-${oldMonth}-${oldDay}`
    const newKey = `${newYear}-${newMonth}-${newDay}`
    
    setCalendarEvents(prev => {
      const updated = { ...prev }
      
      // Remove from old location
      if (updated[oldKey]) {
        updated[oldKey] = updated[oldKey].filter(ev => ev.id !== oldEvent.id)
        if (updated[oldKey].length === 0) {
          delete updated[oldKey]
        }
      }
      
      // Add to new location with updated time if provided
      const updatedEvent = newTime !== undefined ? { ...oldEvent, time: newTime } : oldEvent
      updated[newKey] = [...(updated[newKey] || []), updatedEvent]
      updated[newKey].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
      
      saveToLocalStorage('calendarEvents', updated)
      return updated
    })
  }

  // Delete event
  const handleEventDelete = (year: number, month: number, day: number, event: CalendarEvent) => {
    const key = `${year}-${month}-${day}`
    
    setCalendarEvents(prev => {
      const updated = { ...prev }
      
      if (updated[key]) {
        updated[key] = updated[key].filter(ev => ev.id !== event.id)
        if (updated[key].length === 0) {
          delete updated[key]
        }
      }
      
      saveToLocalStorage('calendarEvents', updated)
      return updated
    })
  }

  // Clear all calendar events and remove persisted storage
  const handleClearCalendarEvents = () => {
    try {
      localStorage.removeItem('calendarEvents')
    } catch {}
    setCalendarEvents({})
  }
  
  const handleRegenerateKey = (keyId: string) => {
    // Implementation for regenerating API key
    console.log('Regenerate key:', keyId)
  }
  
  const handleCreateKey = () => {
    // Implementation for creating new API key
    console.log('Create new key')
  }
  
  // Listen for scheduled posts from publish modal and create yellow notes with time
  useEffect(() => {
    const handler = (e: any) => {
      const { platform, date, time, content } = e.detail || {}
      try {
        const d = date ? new Date(date) : new Date()
        const [hStr, rest] = String(time || '').split(':')
        let hour = parseInt(hStr || '0', 10)
        let minute = parseInt((rest || '0').slice(0,2) || '0', 10)
        const ampm = (time || '').toUpperCase().includes('PM')
        if (ampm && hour < 12) hour += 12
        if (!ampm && hour === 12) hour = 0
        const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
        const time24 = `${pad(hour)}:${pad(minute)}`
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        // Tạo ID duy nhất cho sự kiện scheduled
        const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const newEvent: CalendarEvent = { 
          id: eventId,
          platform: platform || 'Facebook', 
          time: time24, 
          status: `scheduled ${time}`, 
          noteType: 'yellow' as const, 
          content: content || '' 
        }
        const updated = { ...calendarEvents, [key]: [...(calendarEvents[key] || []), newEvent] }
        setCalendarEvents(updated)
        saveToLocalStorage('calendarEvents', updated)

        // Schedule auto-transition at the scheduled time
        const now = new Date()
        const runAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, 0, 0)
        const delay = Math.max(0, runAt.getTime() - now.getTime())
        setTimeout(() => {
          // 70% chance success for mock; adjust as needed
          const isSuccess = Math.random() > 0.3
        const evtKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
          const events = (calendarEvents[evtKey] || []) as any[]
          // Tìm sự kiện theo ID để đảm bảo chính xác
          const idx = events.findIndex(ev => ev.id === newEvent.id)
          if (idx >= 0) {
            const copy = [...events]
            if (isSuccess) {
              // Turn to green and add to publishedPosts
              const green = { ...copy[idx], noteType: 'green' as const, status: 'posted', url: `https://${(newEvent.platform || '').toLowerCase()}.com/post/${Date.now()}` }
              copy[idx] = green
              const calUpdated = { ...calendarEvents, [evtKey]: copy }
              setCalendarEvents(calUpdated)
              saveToLocalStorage('calendarEvents', calUpdated)

              const publishedPost = {
                id: Date.now(),
                platform: newEvent.platform,
                content: newEvent.content || '',
                time: new Date(runAt).toISOString(),
                status: 'published' as const,
                url: green.url,
                engagement: { likes: 0, comments: 0, shares: 0 }
              } as any
              const next = [...publishedPosts, publishedPost]
              setPublishedPosts(next)
              saveToLocalStorage('publishedPosts', next)
            } else {
              // Turn to red and add to failedPosts
              const red = { ...copy[idx], noteType: 'red' as const, status: 'failed' }
              copy[idx] = red
              const calUpdated = { ...calendarEvents, [evtKey]: copy }
              setCalendarEvents(calUpdated)
              saveToLocalStorage('calendarEvents', calUpdated)

              const failed = {
                id: Date.now(),
                platform: newEvent.platform,
                content: newEvent.content || '',
                date: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
                time: `${pad(hour)}:${pad(minute)}`,
                error: 'Tự động đăng thất bại',
                url: `https://${(newEvent.platform || '').toLowerCase()}.com/post/${Date.now()}`
              } as any
              const next = [...failedPosts, failed]
              setFailedPosts(next)
              saveToLocalStorage('failedPosts', next)
            }
          }
        }, delay)
      } catch {}
    }
    window.addEventListener('schedule-post', handler as any)
    return () => window.removeEventListener('schedule-post', handler as any)
  }, [calendarEvents])

  
  return {
    // State
    activeSection,
    setActiveSection,
    isSidebarOpen,
    setIsSidebarOpen,
    language,
    setLanguage,
    openPosts,
    selectedPostId,
    postContents,
    showPostPicker,
    setShowPostPicker,
    isPostPickerVisible,
    setIsPostPickerVisible,
    showClonePicker,
    setShowClonePicker,
    showSettings,
    setShowSettings,
    showSourceModal,
    setShowSourceModal,
    uploadedMedia,
    currentMediaIndex,
    setCurrentMediaIndex,
    calendarEvents,
    draftPosts,
    publishedPosts,
    failedPosts,
    videoProjects,
    apiStats,
    apiKeys,
    
    // Refs
    postPickerRef,
    clonePickerRef,
    
    // Event handlers
    handlePostSelect,
    handlePostCreate,
    handlePostDelete,
    handlePostContentChange,
    handleClonePost,
    handleSaveDraft,
    handleCreatePostWithContent,
    handleMediaUpload,
    handleMediaRemove,
    handlePublish,
    handleEditDraft,
    handleDeleteDraft,
    handlePublishDraft,
    handleViewPost,
    handleRetryPost,
    handleDeletePost,
    handleVideoUpload,
    handleVideoEdit,
    handleVideoDelete,
    handleEventAdd,
    handleEventUpdate,
    handleEventDelete,
    handleClearCalendarEvents,
    handleRegenerateKey,
    handleCreateKey,
  }
}

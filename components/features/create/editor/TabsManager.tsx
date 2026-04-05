// components/create/editor/TabsManager.tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusIcon, X as CloseIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { memo, useCallback } from 'react';
import { SOCIAL_PLATFORMS } from '@/lib/constants/platforms';
import { useCreatePostsStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useTranslations } from 'next-intl';
import { getPlatformColors } from '@/lib/constants/platformColors';

// Dữ liệu này có thể chuyển ra file constants để dùng chung
// Helper to get platform icon — uses SOCIAL_PLATFORMS from lib/constants/platforms
const getPlatformIcon = (platformName: string) => {
    const platform = SOCIAL_PLATFORMS.find(p => p.name === platformName);
    return platform?.icon || "/default.png";
};

export default memo(function TabsManager() {
    const t = useTranslations('CreatePage.createSection.postPanel');
    // Component này chỉ cần các state và action liên quan đến việc quản lý tab
    const {
        posts,
        selectedPostId,
        handlePostSelect,
        handlePostCreate,
        handlePostDelete,
    } = useCreatePostsStore(useShallow(state => ({
        posts: state.openPosts,
        selectedPostId: state.selectedPostId,
        handlePostSelect: state.handlePostSelect,
        handlePostCreate: state.handlePostCreate,
        handlePostDelete: state.handlePostDelete,
    })));

    // State cục bộ cho dropdown "Thêm bài"
    const [showPostPicker, setShowPostPicker] = useState(false);
    const [hasSeenTour, setHasSeenTour] = useState(true);
    const [isTabsCollapsed, setIsTabsCollapsed] = useState(false);
    const postPickerRef = useRef<HTMLDivElement>(null);

    // Check if user has seen the onboarding tour
    useEffect(() => {
        const seen = localStorage.getItem('hasSeenOnboarding');
        setHasSeenTour(!!seen);
    }, []);

    // Smart auto-collapse: Tính toán dựa trên số lượng posts
    // Khi có posts, nút "Thêm bài" chỉ là icon (~32px)
    // Mỗi tab expanded ~100px, collapsed ~40px
    // Auto-collapse khi > 6 posts để tối ưu không gian
    useEffect(() => {
        if (posts.length > 6) {
            setIsTabsCollapsed(true);
        } else if (posts.length <= 4) {
            // Auto expand khi còn ít posts
            setIsTabsCollapsed(false);
        }
        // Giữ nguyên state khi 5-6 posts để user tự quyết định
    }, [posts.length]);

    // Hàm để đóng dropdown khi click ra ngoài
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (postPickerRef.current && !postPickerRef.current.contains(event.target as Node)) {
                setShowPostPicker(false);
            }
        }
        // Thêm event listener khi component mount
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            // Dọn dẹp event listener khi component unmount
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [postPickerRef]);
    // --- KẾT THÚC LOGIC MỚI ---

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Xử lý scroll ngang bằng chuột (convert vertical scroll -> horizontal scroll)
    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        if (scrollContainerRef.current) {
            // Nếu user lăn lên/xuống (deltaY), chuyển thành sang trái/phải
            if (e.deltaY !== 0) {
                // e.preventDefault() không hoạt động trực tiếp với React synthetic event trong một số trường hợp,
                // nhưng việc thay đổi scrollLeft đủ để tạo trải nghiệm UX tốt.
                // Cuộn nhanh hơn chút (x1.5) để cảm giác mượt
                scrollContainerRef.current.scrollLeft += e.deltaY * 1.5;
            }
        }
    }, []);

    return (
        <div className="flex items-center gap-2 mb-4">
            {/* Vòng lặp render các tab */}
            <div 
                ref={scrollContainerRef}
                onWheel={handleWheel}
                className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent"
            >
                {/* Show all tabs when expanded, or show first 4 when collapsed */}
                {posts.map((post, index) => {
                    // When collapsed, show first 4 tabs (more visible)
                    if (isTabsCollapsed && index >= 4) return null;
                    
                    const platformIcon = getPlatformIcon(post.type);
                    const pColors = getPlatformColors(post.type);

                    return (
                        <div
                            key={post.id}
                            className={`group relative flex items-center gap-1.5 px-2 lg:px-2.5 py-1.5 cursor-pointer rounded-t-lg transition-all shrink-0 ${
                                selectedPostId === post.id
                                    ? "text-foreground bg-card"
                                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                            }`}
                            onClick={() => handlePostSelect(post.id)}
                        >
                            {/* D-1: Hybrid — gradient brand (collapsed) / platform color (expanded) */}
                            {selectedPostId === post.id && (
                              isTabsCollapsed ? (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-linear-to-r from-utc-royal to-utc-sky" />
                              ) : (
                                <div className={`absolute bottom-0 left-1 right-1 h-[2px] rounded-full ${pColors.dot}`} />
                              )
                            )}
                            {/* Platform Icon */}
                            <img 
                                src={platformIcon} 
                                alt={post.type}
                                className={`w-4 h-4 shrink-0 ${["Twitter", "Threads"].includes(post.type) ? "dark:filter dark:brightness-0 dark:invert" : ""}`}
                            />
                            {/* Platform Name - hidden completely when collapsed */}
                            {!isTabsCollapsed && (
                                <span className="text-sm whitespace-nowrap">
                                    {post.type}
                                </span>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePostDelete(post.id);
                                }}
                                className="h-5 w-5 p-0 rounded-full hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                            >
                                <CloseIcon className="w-3 h-3" />
                            </Button>
                        </div>
                    );
                })}
                
                {/* Show expand/collapse toggle when > 4 posts */}
                {posts.length > 4 && (
                    <button
                        onClick={() => setIsTabsCollapsed(!isTabsCollapsed)}
                        className="shrink-0 px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 rounded-lg hover:bg-card/50"
                    >
                        {isTabsCollapsed ? (
                            <>
                                <span className="font-medium">+{posts.length - 4}</span>
                                <ChevronDown className="w-3 h-3" />
                            </>
                        ) : (
                            <>
                                <span className="text-xs">Thu gọn</span>
                                <ChevronUp className="w-3 h-3" />
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Nút "Thêm bài" - Rút ngắn khi đã có posts */}
            <div className="relative shrink-0" ref={postPickerRef} data-tour="create-post">
                <Button
                    variant="outline"
                    size="sm"
                    className="border-2 border-dashed border-primary/40 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-300 relative group"
                    onClick={() => setShowPostPicker(prev => !prev)}
                >
                    {/* Pulse animation when: haven't seen tour AND no posts yet */}
                    {!hasSeenTour && posts.length === 0 && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3 z-10">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
                        </span>
                    )}
                    <PlusIcon className={`w-4 h-4 group-hover:rotate-90 transition-transform duration-300 ${posts.length > 0 ? '' : 'mr-1.5'}`} />
                    {posts.length === 0 && <span>{t('addPost')}</span>}
                </Button>
                {showPostPicker && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-55 bg-card border border-border rounded-lg shadow-lg p-3">
                        <div className="space-y-1">
                            {SOCIAL_PLATFORMS.map((option) => (
                                <button
                                    key={option.name}
                                    onClick={() => {
                                        handlePostCreate(option.name);
                                        setShowPostPicker(false);
                                    }}
                                    className="w-full text-left px-4 py-3 rounded-md hover:bg-secondary text-base text-muted-foreground flex items-center gap-4"
                                >
                                    <img src={option.icon} alt={option.name} className={`w-7 h-7 ${["Twitter", "Threads"].includes(option.name) ? "dark:filter dark:brightness-0 dark:invert" : ""}`} />
                                    <span>{option.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
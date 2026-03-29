// components/create/editor/TabsManager.tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusIcon, X as CloseIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useCreatePostsStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useTranslations } from 'next-intl';

// Dữ liệu này có thể chuyển ra file constants để dùng chung
const platformOptions = [
    { name: "TikTok", icon: "/icons/platforms/tiktok.png" }, { name: "Instagram", icon: "/icons/platforms/instagram.png" },
    { name: "YouTube", icon: "/icons/platforms/ytube.png" }, { name: "Facebook", icon: "/icons/platforms/fb.svg" },
    { name: "Twitter", icon: "/icons/platforms/x.png" }, { name: "Threads", icon: "/icons/platforms/threads.png" },
    { name: "LinkedIn", icon: "/icons/platforms/link.svg" }, { name: "Pinterest", icon: "/icons/platforms/pinterest.svg" }
];

// Helper to get platform icon
const getPlatformIcon = (platformName: string) => {
    const platform = platformOptions.find(p => p.name === platformName);
    return platform?.icon || "/default.png";
};

export default function TabsManager() {
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
    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (scrollContainerRef.current) {
            // Nếu user lăn lên/xuống (deltaY), chuyển thành sang trái/phải
            if (e.deltaY !== 0) {
                // e.preventDefault() không hoạt động trực tiếp với React synthetic event trong một số trường hợp,
                // nhưng việc thay đổi scrollLeft đủ để tạo trải nghiệm UX tốt.
                // Cuộn nhanh hơn chút (x1.5) để cảm giác mượt
                scrollContainerRef.current.scrollLeft += e.deltaY * 1.5;
            }
        }
    };

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
                    
                    return (
                        <div
                            key={post.id}
                            className={`flex items-center gap-1.5 px-2 lg:px-2.5 py-1.5 cursor-pointer rounded-t-lg transition-all flex-shrink-0 ${
                                selectedPostId === post.id
                                    ? "border-b-2 border-primary text-foreground bg-card"
                                    : "border-b border-transparent text-muted-foreground hover:text-foreground hover:bg-card/50"
                            }`}
                            onClick={() => handlePostSelect(post.id)}
                        >
                            {/* Platform Icon */}
                            <img 
                                src={platformIcon} 
                                alt={post.type}
                                className={`w-4 h-4 flex-shrink-0 ${["Twitter", "Threads"].includes(post.type) ? "filter brightness-0 invert" : ""}`}
                            />
                            {/* Platform Name - hidden completely when collapsed */}
                            {!isTabsCollapsed && (
                                <span className="text-sm whitespace-nowrap">
                                    {post.type}
                                </span>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePostDelete(post.id);
                                }}
                                className="p-0.5 rounded-full hover:bg-red-500/20 transition-colors flex-shrink-0"
                            >
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}
                
                {/* Show expand/collapse toggle when > 4 posts */}
                {posts.length > 4 && (
                    <button
                        onClick={() => setIsTabsCollapsed(!isTabsCollapsed)}
                        className="flex-shrink-0 px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 rounded-lg hover:bg-card/50"
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
            <div className="relative flex-shrink-0" ref={postPickerRef} data-tour="create-post">
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-2 border-accent text-foreground bg-accent/10 hover:bg-accent/20 hover:border-accent hover:shadow-lg hover:shadow-accent/30 transition-all duration-300 relative group"
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
                    <div className="absolute right-0 top-full z-20 mt-2 w-[13.75rem] bg-card border border-border rounded-lg shadow-lg p-3">
                        <div className="space-y-1">
                            {platformOptions.map((option) => (
                                <button
                                    key={option.name}
                                    onClick={() => {
                                        handlePostCreate(option.name);
                                        setShowPostPicker(false);
                                    }}
                                    className="w-full text-left px-4 py-3 rounded-md hover:bg-secondary text-base text-muted-foreground flex items-center gap-4"
                                >
                                    <img src={option.icon} alt={option.name} className={`w-7 h-7 ${["Twitter", "Threads"].includes(option.name) ? "filter brightness-0 invert" : ""}`} />
                                    <span>{option.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
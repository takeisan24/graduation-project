"use client";

import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { SparklesIcon, ChevronDownIcon, SendIcon, MessageCircle, Wand2, Lightbulb, Zap, Plus, Copy, Check } from 'lucide-react';

import { useCreateChatStore, useCreatePostsStore, useNavigationStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import ConfirmModal from '@/components/shared/ConfirmModal';

// Logic gọi API Gemini có thể được trừu tượng hóa ra service (Giai đoạn 3)
// Tạm thời để logic submit ở đây

export default function AIChatbox() {
  const t = useTranslations('CreatePage.createSection.chatPanel');
  // State cục bộ cho UI của chatbox
  const [chatInput, setChatInput] = useState("");
  const [showModelMenu, setShowModelMenu] = useState<boolean>(false);
  const [selectedChatModel, setSelectedChatModel] = useState<string>("ChatGPT");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);


  // Hàm xử lý copy
  const handleCopyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    toast.success("Đã sao chép nội dung vào bộ nhớ tạm!");

    // Reset icon sau 2 giây
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Hàm kiểm tra xem có nên hiện nút Copy không
  // Logic: Chỉ hiện cho văn bản bình thường, ẩn với JSON và thông báo hệ thống
  const shouldShowCopyButton = (message: any) => {
    // 1. Chỉ áp dụng cho tin nhắn của AI
    if (message.role !== 'assistant') return false;

    const content = (message.content || "").trim();

    // 2. Ẩn nếu nội dung quá ngắn (có thể là lỗi hoặc thông báo ngắn)
    if (content.length < 30) return false;

    // 3. Ẩn nếu có JSON block hoặc code block
    if (content.includes('```')) return false;

    // 4. Ẩn nếu là thông báo hệ thống (bắt đầu bằng các từ khóa đặc trưng)
    // const systemKeywords = [
    //     "Đã tạo", "Đã xong", "Đã cập nhật", "Đã lên lịch", "Đã thêm",
    //     "Xin lỗi", "Rất tiếc", "Đã có lỗi", "Bài", "Caption", "Tweet",
    //     "Facebook", "Twitter", "Instagram", "LinkedIn", "TikTok", "Threads", "Bluesky", "YouTube", "Pinterest"
    // ];

    // const startsWithSystemKeyword = systemKeywords.some(keyword => 
    //     content.startsWith(keyword)
    // );

    // if (startsWithSystemKeyword) return false;

    // 5. Còn lại là văn bản bình thường -> hiện nút Copy
    return true;
  };

  // Lấy state và action liên quan đến chat từ store
  const { chatMessages, isTyping, submitChat, clearChat } = useCreateChatStore(
    useShallow(state => ({
      chatMessages: state.chatMessages,
      isTyping: state.isTyping,
      submitChat: state.submitChat,
      clearChat: state.clearChat,
    })));

  // Reset model về ChatGPT khi user đóng hết tab post (bắt đầu flow tạo post mới)
  const openPosts = useCreatePostsStore(state => state.openPosts);
  useEffect(() => {
    if (openPosts.length === 0) {
      setSelectedChatModel("ChatGPT");
    }
  }, [openPosts.length]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [chatInput]);

  const handleSend = () => {
    if (chatInput.trim() && !isTyping) {
      const postsStore = useCreatePostsStore.getState();
      const navigationStore = useNavigationStore.getState();

      // Truyền kèm model đang được chọn trong UI để BE quyết định dùng OpenAI (ChatGPT) hay Gemini
      // Thêm activePostId để AI biết đang sửa bài nào
      const activePostId = postsStore.selectedPostId;

      submitChat(chatInput, selectedChatModel, {
        onPostCreate: (platform, content) => {
          const newPostId = postsStore.handlePostCreate(platform);
          postsStore.handlePostContentChange(newPostId, content);
          return newPostId;
        },
        onPostContentChange: postsStore.handlePostContentChange,
        onSetActiveSection: navigationStore.setActiveSection,
        activePostId: activePostId, // <-- Pass ID here
      });
      setChatInput("");
    };
  }

  const handleClearChat = () => {
    setShowClearConfirm(true);
  }

  const confirmClearChat = () => {
    clearChat();
    // Khi user tạo cuộc chat mới, luôn reset về ChatGPT để đồng bộ với default
    setSelectedChatModel("ChatGPT");
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const modelOptions = [ // Mặc định là CHatGPT
    "ChatGPT",
    "Gemini Pro",
    "Claude Sonnet 4",
    "gpt-4.1",
    "o4-mini",
    "o3",
    "gpt-4o"
  ];

  //Đóng dropdown khi click ra ngoài
  useEffect(() => {
    if (!showModelMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModelMenu]);

  return (
    <div className="w-full h-full border-l border-white/10 p-[15px] relative z-0 flex flex-col" data-tour="ai-chat">
      <Card className="bg-[#2A2A30] border-[#3A3A42] flex-1 min-h-0 flex flex-col p-0 gap-0 rounded-[5px]">
        {/* Model Selector Header with New Chat Button */}
        <div className="h-[50px] border-b border-white/10 flex items-center justify-between pt-4 px-2 bg-[#44424D] flex-shrink-0">
          <div className="relative -mt-[15px]" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => setShowModelMenu((v) => !v)}
              className="inline-flex items-center gap-2 text-sm font-semibold leading-none text-white/90 hover:text-white"
            >
              <SparklesIcon className="w-4 h-4" />
              {selectedChatModel}
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
            </button>
            {showModelMenu && (
              <div className="absolute mt-2 w-56 bg-[#2A2A30] border border-[#3A3A42] rounded-md shadow-[0_0_0_1px_rgba(255,255,255,0.08)] py-2 z-20">
                {modelOptions.map((model) => (
                  <button
                    key={model}
                    onClick={() => {
                      setSelectedChatModel(model)
                      setShowModelMenu(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 ${selectedChatModel === model ? 'text-white' : 'text-white/80'
                      }`}
                  >
                    {model}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleClearChat}
            className="-mt-[15px] p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all group"
            title="Tạo cuộc trò chuyện mới"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Chat Messages */}
        <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 opacity-80 p-2">
          {chatMessages.length === 0 ? (
            /* Empty State with Guide */
            <div className="h-full flex items-center justify-center p-4 min-h-0">
              <div className="max-w-sm space-y-4">
                {/* Icon */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-purple-500/20">
                      <MessageCircle className="w-8 h-8 text-purple-400" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center animate-pulse">
                      <SparklesIcon className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center space-y-1">
                  <h3 className="text-base font-semibold text-white">
                    {t('emptyState.title')}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {t('emptyState.description')}
                  </p>
                </div>

                {/* Example Commands - Dynamic based on posts */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-300 text-center">
                    {t('emptyState.examplesTitle')}
                  </p>

                  <button
                    onClick={() => setChatInput(t('emptyState.example1'))}
                    className="w-full text-left p-2.5 rounded-lg bg-[#1E1E23] border border-white/5 hover:border-purple-500/30 hover:bg-[#252529] transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <Wand2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/90 group-hover:text-white">
                          {t('emptyState.example1')}
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setChatInput(t('emptyState.example2'))}
                    className="w-full text-left p-2.5 rounded-lg bg-[#1E1E23] border border-white/5 hover:border-blue-500/30 hover:bg-[#252529] transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/90 group-hover:text-white">
                          {t('emptyState.example2')}
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setChatInput(t('emptyState.example3'))}
                    className="w-full text-left p-2.5 rounded-lg bg-[#1E1E23] border border-white/5 hover:border-green-500/30 hover:bg-[#252529] transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <Zap className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/90 group-hover:text-white">
                          {t('emptyState.example3')}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Hint */}
                <div className="pt-2 border-t border-white/5">
                  <p className="text-xs text-gray-500 text-center">
                    {t('emptyState.hint')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Existing Chat Messages */
            <div className="space-y-4 min-h-0">
              {chatMessages.map((message, index) => (
                <div key={index} className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`relative group max-w-[85%] rounded-lg p-3 break-words border ${message.role === "user"
                      ? "bg-[#E33265] text-white border-[#E33265]"
                      : "bg-[#2A2A30] text-[#F5F5F7] border-[#3A3A42]"
                    }`}>
                    {/* Nút Copy Thông Minh - Góc trên bên phải */}
                    {shouldShowCopyButton(message) && (
                      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopyMessage(message.content, index)}
                          className="p-1.5 rounded-full bg-[#3A3A42] border border-white/10 hover:bg-[#4A4A52] text-white/80 hover:text-white shadow-sm transition-all"
                          title="Sao chép nội dung này để Format"
                        >
                          {copiedIndex === index ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Nội dung tin nhắn */}
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="text-sm text-left">
                  <div className="bg-[#2A2A30] text-[#F5F5F7] inline-block rounded-lg p-3 border border-[#3A3A42]">
                    <div className="flex items-center space-x-1">
                      <span>{t('aiTyping')}</span>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-[#F5F5F7] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-[#F5F5F7] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-[#F5F5F7] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Input - Auto-resize */}
        <div className="border-t border-white/10 p-3 bg-[#1E1E23] flex-shrink-0">
          <div className="relative">
            <textarea
              ref={textareaRef}
              placeholder={t('aiChatPlaceholder')}
              className="w-full bg-[#2A2A30] border-2 border-[#3A3A42] rounded-lg outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 resize-none text-white placeholder-gray-500 text-sm p-3 pr-12 transition-all overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
              style={{ minHeight: '60px', maxHeight: '200px' }}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!chatInput.trim() || isTyping}
              className='absolute right-3 bottom-3 text-white bg-gradient-to-br from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg p-2 transition-all hover:scale-105 active:scale-95 shadow-lg'
            >
              <SendIcon className='w-4 h-4' />
            </button>
          </div>

          {/* Context Indicator */}
          <div className="mt-2 flex items-center justify-between gap-2 overflow-hidden">
            {openPosts.length > 0 ? (
              <div className="text-[10px] text-gray-500 flex items-center gap-1.5 flex-1 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
                <span className="truncate">Bài viết: <span className="text-gray-300 font-medium">{openPosts.find(p => p.id === useCreatePostsStore.getState().selectedPostId)?.type || "Tất cả"}</span></span>
              </div>
            ) : <div className="flex-1" />}
          </div>
        </div>
      </Card>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClearChat}
        title="Xóa cuộc trò chuyện?"
        description="Toàn bộ lịch sử chat với AI sẽ bị xóa. Hành động này không thể hoàn tác."
        confirmText="Xóa"
        cancelText="Hủy"
        variant="warning"
      />
    </div>
  );
}
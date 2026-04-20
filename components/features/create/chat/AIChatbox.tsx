"use client";

import { useState, useRef, useEffect } from 'react';

import { SparklesIcon, ChevronDownIcon, SendIcon, MessageCircle, Wand2, Lightbulb, Zap, Plus, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';

import { useCreateChatStore, useCreatePostsStore, useNavigationStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { MODEL_OPTIONS } from '@/lib/constants/platforms';
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
    try {
      navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      toast.success(t('copiedToClipboard'));
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  // Hàm kiểm tra xem có nên hiện nút Copy không
  // Logic: Chỉ hiện cho văn bản bình thường, ẩn với JSON và thông báo hệ thống
  const shouldShowCopyButton = (message: { role: string; content?: string; isError?: boolean }) => {
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
    //     "Facebook", "Twitter", "Instagram", "LinkedIn", "TikTok", "Threads", "YouTube", "Pinterest"
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
    if (!navigator.onLine) { toast.error(t('offlineError')); return; }
    if (chatInput.trim() && !isTyping) {
      const postsStore = useCreatePostsStore.getState();
      const navigationStore = useNavigationStore.getState();

      const activePostId = postsStore.selectedPostId;

      submitChat(chatInput, selectedChatModel, {
        onPostCreate: (platform, content) => {
          const newPostId = postsStore.handlePostCreate(platform);
          postsStore.handlePostContentChange(newPostId, content);
          return newPostId;
        },
        onPostContentChange: postsStore.handlePostContentChange,
        onSetActiveSection: navigationStore.setActiveSection,
        activePostId: activePostId,
      });
      setChatInput("");
    };
  }

  // E-1: Retry failed message
  const handleRetry = (content: string) => {
    if (isTyping) return;
    const postsStore = useCreatePostsStore.getState();
    const navigationStore = useNavigationStore.getState();
    const activePostId = postsStore.selectedPostId;

    submitChat(content, selectedChatModel, {
      onPostCreate: (platform, text) => {
        const newPostId = postsStore.handlePostCreate(platform);
        postsStore.handlePostContentChange(newPostId, text);
        return newPostId;
      },
      onPostContentChange: postsStore.handlePostContentChange,
      onSetActiveSection: navigationStore.setActiveSection,
      activePostId: activePostId,
    });
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
    if (e.key === "Enter") {
      // S-014: Allow Ctrl+Enter or Cmd+Enter to send as well as regular Enter (unless Shift is used)
      if (e.ctrlKey || e.metaKey || !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

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
    <div className="relative z-0 flex h-full min-h-0 w-full flex-col overflow-hidden bg-gradient-to-b from-background via-background to-secondary/20 scroll-smooth" style={{ scrollPaddingBottom: 'env(keyboard-inset-height, 16px)' }} data-tour="ai-chat">
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Model Selector Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-card/50 flex-shrink-0">
          <div className="relative" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => setShowModelMenu((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-all ${showModelMenu ? 'text-foreground bg-gradient-to-r from-utc-royal/10 to-utc-sky/10 border border-utc-royal/30 rounded-md px-2.5 py-1.5' : 'text-foreground/90 hover:text-foreground'}`}
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              {selectedChatModel}
              <ChevronDownIcon className={`w-3 h-3 transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
            </button>
            {showModelMenu && (
              <div className="absolute mt-1 w-48 bg-card border border-border rounded-md shadow-lg py-1 z-20">
                {MODEL_OPTIONS.map((model) => (
                  <button
                    key={model}
                    onClick={() => {
                      setSelectedChatModel(model)
                      setShowModelMenu(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary ${selectedChatModel === model ? 'text-foreground font-medium' : 'text-muted-foreground'
                      }`}
                  >
                    {model}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleClearChat}
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-all group"
            title="Tạo cuộc trò chuyện mới"
          >
            <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Chat Messages */}
        <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-secondary p-3">
          {chatMessages.length === 0 ? (
            /* Empty State with Guide */
            <div className="h-full flex items-center justify-center p-3 min-h-0">
              <div className="max-w-sm space-y-3">
                {/* Icon + Title inline */}
                <div className="text-center space-y-1">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl border border-purple-500/20 mx-auto">
                    <MessageCircle className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t('emptyState.title')}
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {t('emptyState.description')}
                  </p>
                </div>

                {/* Example Commands */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground text-center uppercase tracking-wider">
                    {t('emptyState.examplesTitle')}
                  </p>

                  <button
                    onClick={() => setChatInput(t('emptyState.example1'))}
                    className="w-full text-left rounded-lg border border-border/50 bg-card/75 p-2 hover:border-purple-500/30 hover:bg-secondary transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <Wand2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground/90 group-hover:text-foreground">
                          {t('emptyState.example1')}
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setChatInput(t('emptyState.example2'))}
                    className="w-full text-left rounded-lg border border-border/50 bg-card/75 p-2 hover:border-blue-500/30 hover:bg-secondary transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground/90 group-hover:text-foreground">
                          {t('emptyState.example2')}
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setChatInput(t('emptyState.example3'))}
                    className="w-full text-left rounded-lg border border-border/50 bg-card/75 p-2 hover:border-green-500/30 hover:bg-secondary transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <Zap className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground/90 group-hover:text-foreground">
                          {t('emptyState.example3')}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Hint */}
                <div className="pt-1.5 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground text-center leading-snug">
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
                  <div className={`relative group max-w-[85%] p-3 break-words ${message.role === "user"
                      ? "ml-auto bg-utc-royal/10 border border-utc-royal/20 rounded-2xl rounded-br-sm text-foreground"
                      : message.isError
                        ? "mr-auto bg-red-500/10 border border-red-500/20 rounded-2xl rounded-bl-sm text-foreground"
                        : "mr-auto bg-muted border border-border rounded-2xl rounded-bl-sm text-foreground"
                    }`}>
                    {/* E-1: Error bubble — Alert icon + message + retry */}
                    {message.role === 'assistant' && message.isError && (
                      <div className="flex items-start gap-2 mb-1.5">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <button
                          onClick={() => handleRetry(message.content)}
                          className="ml-auto text-xs text-red-400 hover:text-red-300 flex items-center gap-1 hover:underline"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {t('retry')}
                        </button>
                      </div>
                    )}

                    {/* Nút Copy Thông Minh - Góc trên bên phải (chỉ cho non-error AI messages) */}
                    {!message.isError && shouldShowCopyButton(message) && (
                      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => handleCopyMessage(message.content, index)}
                          className="p-1.5 rounded-full bg-background border border-border hover:bg-muted text-muted-foreground hover:text-foreground shadow-sm transition-all"
                          title={t('copyToFormat')}
                        >
                          {copiedIndex === index ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* B-1: AI icon for non-error assistant messages */}
                    {message.role === 'assistant' && !message.isError && (
                      <div className="mb-1.5">
                        <SparklesIcon className="w-3.5 h-3.5 text-primary" />
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
                  <div className="bg-card text-card-foreground inline-block rounded-lg p-3 border border-border">
                    {/* B-4: Typing indicator — dots only */}
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-card-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-card-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-card-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Input - Auto-resize */}
        <div className="border-t border-border/50 bg-background/90 p-2 backdrop-blur-sm flex-shrink-0">
          <div className="relative">
            <textarea
              ref={textareaRef}
              placeholder={t('aiChatPlaceholder')}
              onFocus={(e) => {
                // S-013: Prevent mobile keyboard from covering the input
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 300);
              }}
              className="w-full bg-card border border-border rounded-lg outline-none focus:border-utc-royal/50 focus:ring-1 focus:ring-utc-royal/20 resize-none text-foreground placeholder-muted-foreground text-xs p-2.5 pr-10 transition-all overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-secondary"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!chatInput.trim() || isTyping}
              className='absolute right-2 bottom-2 text-white bg-gradient-to-r from-utc-royal to-utc-sky hover:opacity-90 disabled:from-muted disabled:to-muted disabled:cursor-not-allowed rounded-md p-1.5 transition-all hover:scale-105 active:scale-95 shadow-sm'
            >
              <SendIcon className='w-4 h-4' />
            </button>
          </div>

          {/* Context Indicator */}
          <div className="mt-1 flex items-center justify-between gap-2 overflow-hidden">
            {openPosts.length > 0 ? (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-1 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0"></span>
                <span className="truncate">Bài viết: <span className="text-muted-foreground font-medium">{openPosts.find(p => p.id === useCreatePostsStore.getState().selectedPostId)?.type || "Tất cả"}</span></span>
              </div>
            ) : <div className="flex-1" />}
            {/* S-014: Shortcut hint */}
            {!chatInput.trim() && (
              <p className="text-[10px] text-muted-foreground shrink-0">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd> {t('toSend')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClearChat}
        title={t('clearChatTitle')}
        description={t('clearChatDescription')}
        confirmText={t('clearChatConfirm')}
        cancelText={t('clearChatCancel')}
        variant="warning"
      />
    </div>
  );
}

/**
 * Create Page - Chat Store
 * 
 * Manages AI chat functionality
 */

import { create } from 'zustand';
import { supabaseClient } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { handleErrorWithModal, parseError } from '@/lib/utils/errorHandler';
import type { ChatMessage } from '../shared/types';
import { HOOK_FORMULA, FORMATTING_CONSTRAINTS, ALL_HYPNOTIC_KEYWORDS } from "@/lib/constants/hypnotic-keywords";
import { VIDEO_SCRIPT_TEMPLATES } from "@/lib/prompts";
import { useCreateSourcesStore } from './sources';
import { useCreatePostsStore } from './posts';

interface CreateChatState {
  // State
  chatMessages: ChatMessage[];
  isTyping: boolean;
  sessionId: string | null;
  userInstructions: string[]; // Danh sách tin nhắn user trong session, ưu tiên gửi cho AI

  // Actions
  submitChat: (
    chatInput: string,
    selectedModel: string,
    options: {
      onPostCreate?: (platform: string, content: string) => number;
      onPostContentChange?: (postId: number, content: string) => void;
      onSetActiveSection?: (section: string) => void;
      activePostId?: number; // <-- NEW: ID của bài viết đang focus
    }
  ) => Promise<void>;
  clearChat: () => void;
}

export const useCreateChatStore = create<CreateChatState>((set, get) => ({
  // Initial state
  chatMessages: [],
  isTyping: false,
  sessionId: null,
  userInstructions: [],

  submitChat: async (chatInput, selectedModel, options) => {
    const text = chatInput.trim();
    if (!text || get().isTyping) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    set(state => ({
      chatMessages: [...state.chatMessages, userMessage],
      userInstructions: [...state.userInstructions, text], // Lưu tin nhắn user vào danh sách ưu tiên
    }));
    set({ isTyping: true });

    const currentChatMessages = get().chatMessages;
    const historyForApi = currentChatMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    //     System instruction dành cho Gemini - giữ nguyên logic cũ đang hoạt động ổn định
    //     const geminiSystemInstruction = `
    //     Bạn là một trợ lý viết bài cho mạng xã hội chuyên nghiệp. 

    //     Nhiệm vụ của bạn là giúp người dùng tạo nội dung hấp dẫn cho các nền tảng như Facebook, Twitter, Instagram, LinkedIn, TikTok, Threads, YouTube, Pinterest.

    //     Khi người dùng yêu cầu tạo bài đăng, hãy trả lời theo định dạng JSON sau:

    //     \`\`\`json
    //     {
    //       "action": "create_post",
    //       "platform": "Tên nền tảng (ví dụ: Facebook, Twitter)",
    //       "content": "Nội dung bài đăng bạn đã tạo.",
    //       "summary_for_chat": "Tóm tắt ngắn gọn bài đăng đã tạo để hiển thị trong khung chat (tối đa 2 câu)."
    //     }
    //     \`\`\`

    //     Các "Tên nền tảng" hợp lệ là: Facebook, Twitter, Instagram, LinkedIn, TikTok, Threads, YouTube, Pinterest.

    //     Nếu người dùng chỉ hỏi chung chung hoặc cần trợ giúp khác, hãy trả lời bằng văn bản thuần túy, thân thiện và hữu ích.

    //     Luôn trả lời bằng tiếng Việt. 
    // `;

    //     System instruction dành riêng cho ChatGPT/OpenAI - siết chặt định dạng JSON để FE dễ parse
    //     const openAISystemInstruction = `
    //     Bạn là một trợ lý viết bài cho mạng xã hội chuyên nghiệp. 

    //     Nhiệm vụ của bạn là giúp người dùng tạo nội dung hấp dẫn cho các nền tảng như Facebook, Twitter, Instagram, LinkedIn, TikTok, Threads, YouTube, Pinterest.

    //     Khi người dùng yêu cầu tạo NHIỀU bài đăng cho nhiều nền tảng trong CÙNG MỘT LẦN, bạn phải tạo RIÊNG TỪNG BÀI cho TỪNG nền tảng.
    //     Mỗi nền tảng tương ứng với MỘT phần tử trong mảng JSON.

    //     Câu trả lời của bạn BẮT BUỘC phải là DUY NHẤT một khối code JSON, không có bất kỳ text nào bên ngoài.

    //     Định dạng chính xác (một MẢNG các bài đăng):

    //     \`\`\`json
    //     [
    //       {
    //         "action": "create_post",
    //         "platform": "Tên nền tảng (ví dụ: Facebook)",
    //         "content": "Nội dung bài đăng bạn đã tạo cho nền tảng đó.",
    //         "summary_for_chat": "Tóm tắt ngắn gọn bài đăng đã tạo để hiển thị trong khung chat (tối đa 2 câu)."
    //       }
    //     ]
    //     \`\`\`

    //     YÊU CẦU NGHIÊM NGẶT:
    //     - Luôn bao toàn bộ MẢNG JSON trong cặp dấu \`\`\`json ... \`\`\` như trên.
    //     - KHÔNG thêm lời giải thích, tiêu đề, mô tả hay bất kỳ ký tự nào trước hoặc sau khối \`\`\`json\`\`\`.
    //     - Mỗi phần tử trong mảng chỉ được chứa DUY NHẤT một nền tảng trong field "platform" (ví dụ: "Facebook" hoặc "Instagram"), KHÔNG gộp nhiều nền tảng vào cùng một chuỗi.
    //     - Nếu người dùng yêu cầu 4 nền tảng (Facebook, Instagram, TikTok, LinkedIn), bạn phải trả về MẢNG 4 PHẦN TỬ, mỗi phần tử là một bài riêng cho từng nền tảng.

    //     Các "Tên nền tảng" hợp lệ là: Facebook, Twitter, Instagram, LinkedIn, TikTok, Threads, YouTube, Pinterest.

    //     Nếu người dùng chỉ hỏi chung chung hoặc cần trợ giúp khác, hãy trả lời bằng văn bản thuần túy, thân thiện và hữu ích.

    //     Luôn trả lời bằng tiếng Việt. 
    // `;


    // ... existing imports
    // System PROMPT MỚI - TỐI ƯU HÓA CẤU TRÚC & CẢM XÚC CHO CẢ GEMINI VÀ CHATGPT
    // UPDATED PROMPT PER USER FEEDBACK (FRIENDLY, NO EXPERT JARGON, NO SPECIFIC NAME)
    const commonPersonaChat = `
    VAI TRÒ (ROLE):
    Bạn là một AI tạo nội dung mạng xã hội chuyên nghiệp. 
    TÍNH TUÂN THỦ NGHIÊM NGẶT (STRICT ADHERENCE):
    1. TUYỆT ĐỐI tuân thủ giọng văn, yêu cầu và hướng dẫn của người dùng. Nếu người dùng yêu cầu văn phong cụ thể, BẮT BUỘC mô phỏng chính xác văn phong đó.
    2. KHÔNG TỰ Ý THÊM BỚT: Không thêm các từ ngữ giao tiếp thừa thãi ("nè, á, đâu, nhé...") trừ khi người dùng yêu cầu. Không tự biên chuẩn mực đạo đức hoặc "chuyên gia" vào bài viết.
    3. HÃY TẬP TRUNG VÀO NỘI DUNG: Trả lời ngắn ngọn, đúng trọng tâm yêu cầu thiết kế nội dung hoặc sửa bài viết.
    4. KIẾN THỨC LÀ CỦA BẠN: Nếu người dùng gửi kèm link bài viết, video Youtube/Tiktok, bạn hãy "học lỏm" thông tin, dữ liệu và ý tưởng từ đó. TUYỆT ĐỐI KHÔNG trích dẫn tên tác giả, kênh hay nguồn gốc. Hãy coi như khối kiến thức đó là của chính bạn khám phá ra và viết lại theo giọng văn độc lập (Ví dụ cấm dùng: "Theo video này...", "Tác giả X nói...").
    5. CẤM LẤY TÊN TÁC GIẢ LÀM TÊN NHÂN VẬT: Nếu tạo kịch bản video, TUYỆT ĐỐI KHÔNG dùng tên của người trong nội dung gốc (ví dụ: "Khoai", "Sang"...) để dán nhãn người nói. Nhân vật đọc thoại BẮT BUỘC phải đổi thành "TÔI", "MÌNH", "HOST" hoặc "NARRATOR".

    QUY TẮC QUAN TRỌNG:
    1. QUY TẮC SỐ 1 - TIÊU ĐỀ (HOOK):
    Mọi bài viết nên bắt đầu bằng 1 câu Tiêu đề (Hook) hấp dẫn, chọn từ danh sách công thức:
    ${HOOK_FORMULA}
    (Tham khảo các từ thôi miên: ${ALL_HYPNOTIC_KEYWORDS.slice(0, 10).join(', ')}...)

    3. QUY TẮC SỐ 3 - HASHTAG (BẮT BUỘC):
    - Luôn thêm 3-5 hashtag phù hợp ở cuối bài.
    - Hashtag phải liên quan sát sườn với nội dung (ví dụ: #marketing #content #tips).
    - ĐỊNH DẠNG: Các hashtag cách nhau bằng dấu cách (#tag1 #tag2), TUYỆT ĐỐI KHÔNG dính liền hoặc dùng dấu phẩy.

    4. QUY CHUẨN BẮT BUỘC KHI VIẾT (FORMAT & CONSTRAINTS):
    ${FORMATTING_CONSTRAINTS}
    
    4. Định hướng nội dung:
       - Bắt đầu thu hút, đi thẳng vào vấn đề.
       - Tách đoạn rõ ràng, tự nhiên. Độ dài bài viết linh hoạt theo yêu cầu của người dùng (có thể ngắn gọn hoặc dài chi tiết). Nếu không có yêu cầu cụ thể, hãy phân tích đủ sâu để mang lại giá trị.
       - ĐỐI VỚI INSTAGRAM: BẮT BUỘC viết dưới dạng NỘI DUNG CAROUSEL (Nhiều slide dạng văn bản/hình ảnh cuộn). Phân chia rõ ràng: [Slide 1], [Slide 2]... mỗi slide chứa nội dung ngắn gọn, súc tích.
       - ĐỐI VỚI TIKTOK/YOUTUBE (KỊCH BẢN VIDEO): BẮT BUỘC viết dưới dạng KỊCH BẢN VIDEO bằng cách chọn 1 trong 7 cấu trúc sau:
${VIDEO_SCRIPT_TEMPLATES}
       - Phần cuối tự nhiên, có lời kêu gọi hành động (Call to action) theo yêu cầu.
    
    5. Quy tắc ngôn ngữ:
       - Sử dụng ngôn ngữ phù hợp với yêu cầu của người dùng (Tiếng Việt hoặc Tiếng Anh). 
       - Nếu người dùng không yêu cầu cụ thể, hãy mặc định trả lời bằng ngôn ngữ mà người dùng đang sử dụng.
    
    6. Quy tắc cấm kỵ khác (QUAN TRỌNG):
       - TUYỆT ĐỐI KHÔNG dùng các tiêu đề dàn ý gạch đầu dòng cứng nhắc như: "Mở bài:", "Thân bài:", "Kết bài:", "Lợi ích thực tế:", "Đoạn 1:", "Kết luận:", "Tóm lại:"... Bài viết phải là nội dung hoàn chỉnh, đọc mượt mà như người thật viết.
       - KHÔNG đánh số thứ tự liệt kê kiểu "1), 2), 3)" nếu không cần thiết, thay vào đó hãy dùng bullet points (•, -) hoặc icon phù hợp.
       - Field "content" BẮT BUỘC phải là một CHUỖI VĂN BẢN (STRING) DUY NHẤT. TUYỆT ĐỐI KHÔNG trả về Object bên trong "content" (Kể cả với kịch bản video/carousel).
       - KHÔNG có text thừa ngoài JSON (nếu được yêu cầu JSON).
       - ĐỂ TRÁNH LỖI JSON PARSE: TUYỆT ĐỐI KHÔNG SỬ DỤNG DẤU NGOẶC KÉP KÉP ("...") BÊN TRONG NỘI DUNG BÀI VIẾT (Field "content"). Nếu cần trích dẫn, hãy sử dụng Dấu ngoặc đơn ('...') hoặc Dấu ngoặc nhọn («...»).
       - KHÔNG giải thích dài dòng.`;

    // 1. PROMPT CHO GEMINI
    const geminiSystemInstruction = `
    ${commonPersonaChat}

    OUTPUT FORMAT (BẮT BUỘC):
    1. Output DUY NHẤT phải là một khối mã JSON (JSON Code Block).
    2. Nếu tạo nhiều bài, trả về Mảng (Array).
    
    SCHEMA JSON:
    \`\`\`json
    [
      {
        "action": "create_post",
        "platform": "Tên nền tảng (Facebook, TikTok...)",
        "content": "Nội dung bài viết (BẮT BUỘC LÀ STRING DUY NHẤT, TUYỆT ĐỐI KHÔNG LÀ OBJECT)...",
        "summary_for_chat": "Thông báo ngắn (VD: Đã viết bài Facebook...)"
      }
    ]
    \`\`\`

    NGOẠI LỆ:
    Chỉ khi người dùng hỏi câu hỏi kiến thức/tư vấn (không phải yêu cầu tạo nội dung/bài đăng), bạn mới được phép trả lời bằng văn bản bình thường.
    `;

    // 2. PROMPT CHO OPENAI / CHATGPT
    const openAISystemInstruction = `
    ${commonPersonaChat}

    OUTPUT FORMAT (STRICT):
    - Return ONLY a JSON Array inside a markdown block.
    
    JSON SCHEMA:
    \`\`\`json
    [
      {
        "action": "create_post",
        "platform": "Platform Name",
        "content": "Natural, engaging content string...",
        "summary_for_chat": "Short status string"
      }
    ]
    \`\`\`
    
    Valid Platforms: Facebook, Twitter, Instagram, LinkedIn, TikTok, Threads, YouTube, Pinterest.
    EXCEPTION: If the user input is a general question (not a content creation request), reply normally.
    `;

    // Chọn system instruction tuỳ theo model FE đang chọn
    const normalizedModel = (selectedModel || '').toLowerCase().trim();
    const isChatGPT = normalizedModel === 'chatgpt';
    const activeSystemInstruction = isChatGPT ? openAISystemInstruction : geminiSystemInstruction;

    // System instruction pair cố định để luôn có ở đầu history
    const systemInstructionPair = [
      { role: 'user' as const, parts: [{ text: activeSystemInstruction }] },
      { role: 'model' as const, parts: [{ text: 'Đã hiểu! Tôi sẵn sàng giúp bạn.' }] }
    ];

    // Kiểm tra xem history đã có system instruction chưa
    const hasSystemInstruction = historyForApi.length > 0 &&
      historyForApi[0]?.role === 'user' &&
      historyForApi[0]?.parts?.[0]?.text?.includes('trợ lý viết bài cho mạng xã hội');

    const fullHistory = hasSystemInstruction
      ? historyForApi
      : [...systemInstructionPair, ...(historyForApi || [])];

    // Credit is only deducted on the backend when a new post is created.
    // Chat conversation and editing existing posts are always free.
    // The backend will return a 403 if credits are insufficient when creating posts.

    try {
      // Lấy extractedContent và posts hiện tại để gửi kèm context cho AI
      const sourcesStore = useCreateSourcesStore.getState();
      const postsStore = useCreatePostsStore.getState();
      const extractedContent = sourcesStore.extractedContent;

      // --- FIX: FOCUS CONTEXT ---
      // Chỉ lấy bài viết ĐANG FOCUS (nếu có) hoặc lấy tất cả nếu không focus cụ thể
      const activePostId = options.activePostId;
      let relevantPosts = postsStore.openPosts;

      if (activePostId) {
        // Nếu đang focus 1 bài, chỉ gửi bài đó làm context chính
        // (Hoặc có thể gửi tất cả nhưng đánh dấu bài active - ở đây chọn gửi context bài active để AI tập trung)
        const focusedPost = postsStore.openPosts.find(p => p.id === activePostId);
        if (focusedPost) {
          relevantPosts = [focusedPost];
        }
      }

      const currentPosts = relevantPosts.map(post => ({
        platform: post.type,
        content: postsStore.postContents[post.id] || ''
      })).filter(post => post.content.trim().length > 0); // Chỉ gửi posts có nội dung

      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;

      // Truncate context data to prevent exceeding token limits
      // Import token utilities
      const { truncateContextData, TOKEN_LIMITS } = await import('@/lib/utils/tokenUtils');
      const truncatedContext = truncateContextData(
        extractedContent || null,
        currentPosts,
        TOKEN_LIMITS.CONTEXT_DATA_MAX_TOKENS
      );

      // Xây dựng context message nếu có extractedContent hoặc posts
      let contextMessage = text;
      if (truncatedContext.extractedContent || truncatedContext.currentPosts.length > 0) {
        let contextParts: string[] = [];

        // Thêm extractedContent nếu có (đã được truncate)
        if (truncatedContext.extractedContent) {
          contextParts.push(`=== NỘI DUNG NGUỒN (từ video YouTube) ===\n${truncatedContext.extractedContent}`);
        }

        // Thêm các bài post hiện tại nếu có (đã được truncate)
        if (truncatedContext.currentPosts.length > 0) {
          contextParts.push(`=== BÀI VIẾT ĐANG CHỈNH SỬA (CONTEXT) ===`);

          if (activePostId) {
            contextParts.push(`(Người dùng đang xem bài này - Hãy ưu tiên chỉnh sửa nó)`);
          }

          truncatedContext.currentPosts.forEach((post, index) => {
            contextParts.push(`${index + 1}. Nền tảng: ${post.platform}\nNội dung: ${post.content}`);
          });
        }

        // Kết hợp context với user message
        contextMessage = `${contextParts.join('\n\n')}\n\n=== YÊU CẦU CỦA NGƯỜI DÙNG ===\n${text}\n\n`;
        contextMessage += `=== LỆNH HỆ THỐNG BẮT BUỘC ĐỂ SỬA BÀI ===\n`;
        contextMessage += `1. Dựa trên yêu cầu trên, hãy sửa lại nội dung bài viết theo ĐÚNG yêu cầu.\n`;
        contextMessage += `2. CỰC KỲ QUAN TRỌNG: Nếu người dùng CHỈ yêu cầu sửa một phần nhỏ (Ví dụ: "thêm emoji", "sửa lỗi chính tả"), BẠN PHẢI GIỮ NGUYÊN TOÀN BỘ độ dài, cấu trúc, và nội dung của bài viết gốc. Chỉ thay đổi ĐÚNG vị trí được yêu cầu. Không được rút gọn bài viết.\n`;
        contextMessage += `3. TUYỆT ĐỐI không tự động tóm tắt, không cắt xen, không tự đổi giọng văn, không thêm bớt thông tin nếu không được yêu cầu.\n`;
        contextMessage += `4. OUTPUT BẮT BUỘC: Trả về MỘT khối mã JSON Array bên trong cặp dấu \`\`\`json ... \`\`\` theo ĐÚNG format sau:\n`;
        contextMessage += `\`\`\`json
[
  {
    "action": "create_post",
    "platform": "${truncatedContext.currentPosts[0]?.platform || 'Facebook'}",
    "content": "TOÀN BỘ nội dung bài viết đã sửa (giữ nguyên độ dài gốc, chỉ thay đổi phần được yêu cầu)",
    "summary_for_chat": "Tóm tắt ngắn gọn những gì đã sửa (1-2 câu)"
  }
]
\`\`\`\n`;
        contextMessage += `5. KHÔNG giải thích, KHÔNG chào hỏi, KHÔNG có text thô bên ngoài khối JSON.\n`;
        contextMessage += `6. Field "action" BẮT BUỘC phải là "create_post". Field "platform" BẮT BUỘC phải đúng tên nền tảng. Field "content" phải chứa TOÀN BỘ bài viết đã sửa (KHÔNG rút gọn, KHÔNG tóm tắt).\n`;
      }

      // Detect if user is editing existing posts (has posts with content in context)
      const isEditRequest = currentPosts.length > 0;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          message: contextMessage, // Gửi context message thay vì chỉ text
          context: 'general',
          contentType: 'chat', // MUST be 'chat' or 'general' to qualify for free messages
          platform: 'general',
          sessionId: get().sessionId, // Truyền sessionId để BE biết context
          // Truyền model FE đang chọn để BE quyết định route sang OpenAI hay Gemini
          modelKey: selectedModel,
          history: fullHistory,
          isEditRequest, // Edit requests are free (no credit deduction)
          userInstructions: get().userInstructions, // Danh sách tin nhắn user ưu tiên
        }),
      });

      let raw;
      try {
        // Read text first to handle non-JSON responses (e.g. 500 HTML error pages)
        const responseText = await response.text();

        try {
          raw = JSON.parse(responseText);
        } catch (e) {
          console.error("Failed to parse API response:", responseText.substring(0, 500));
          // If response is not JSON, it's likely a server error (Vercel timeout, 500, etc)
          throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
        }

        if (!response.ok) {
          const errorData = raw;
          // Extract actual error message (may be nested JSON)
          let errorMessage = errorData.error || `Lỗi API: ${response.statusText}`;
          try {
            const parsed = typeof errorMessage === 'string' ? JSON.parse(errorMessage) : errorMessage;
            errorMessage = parsed.message || parsed.error || errorMessage;
          } catch { /* not JSON */ }

          // For AI provider errors (Google/OpenAI/Fal), show specific toast instead of generic modal
          const isProviderApiError = typeof errorMessage === 'string' && (
            errorMessage.includes('quá tải') || errorMessage.includes('đang bận') ||
            errorMessage.includes('vượt giới hạn')
          );

          if (isProviderApiError) {
            // Show the provider-specific error message directly (already localized from backend)
            toast.error(errorMessage, { duration: 8000 });
            set(state => ({
              chatMessages: [...state.chatMessages, { role: 'assistant', content: errorMessage, isError: true }]
            }));
          } else {
            await handleErrorWithModal(errorData, errorMessage);
            set(state => ({
              chatMessages: [...state.chatMessages, { role: 'assistant', content: `Xin lỗi, đã có lỗi xảy ra: ${errorMessage}`, isError: true }]
            }));
          }
          return;
        }
      } catch (err: any) {
        // Handle network errors or JSON parse errors
        console.error("Network or format error:", err);
        const errorMessage = err.message || "Lỗi kết nối hoặc định dạng phản hồi không hợp lệ.";
        toast.error(errorMessage);
        set(state => ({
          chatMessages: [...state.chatMessages, { role: 'assistant', content: `Xin lỗi, đã có lỗi xảy ra: ${errorMessage}`, isError: true }]
        }));
        return;
      }

      const data = raw?.data ?? raw;
      const geminiResponseText = typeof data?.reply === 'string'
        ? data.reply
        : (typeof data?.response === 'string' ? data.response : '');

      let aiResponseForChat = geminiResponseText;
      const postsToCreate: Array<{ platform: string; content: string; summary: string }> = [];

      // --- LOGIC TRÍCH XUẤT JSON (NÂNG CẤP) ---
      const extractAndParseJSON = (text: string) => {
        const results: any[] = [];

        // CHIẾN THUẬT 1: Tìm Markdown Code Block (```json ... ``` hoặc ``` ... ```)
        // Regex linh hoạt hơn: cho phép có hoặc không có chữ 'json', cho phép khoảng trắng linh tinh
        const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
        let match;
        let foundCodeBlock = false;

        while ((match = codeBlockRegex.exec(text)) !== null) {
          foundCodeBlock = true;
          try {
            const cleanJson = match[1].trim().replace(/,(\s*[}\]])/g, '$1'); // Xóa dấu phẩy thừa
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed)) results.push(...parsed);
            else results.push(parsed);
          } catch (e) {
            console.warn("Lỗi parse JSON từ code block:", e);
          }
        }

        // CHIẾN THUẬT 2: Fallback - Tìm mảng JSON thô [...]
        // Nếu không tìm thấy code block nào, hoặc tìm thấy nhưng parse lỗi
        if (results.length === 0) {
          const firstBracket = text.indexOf('[');
          const lastBracket = text.lastIndexOf(']');

          if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
            try {
              const rawJson = text.substring(firstBracket, lastBracket + 1);
              const parsed = JSON.parse(rawJson);
              if (Array.isArray(parsed)) results.push(...parsed);
            } catch (e) {
              console.warn("Lỗi parse JSON thô:", e);
            }
          }
        }

        return results;
      };

      // Thực thi trích xuất
      const parsedItems = extractAndParseJSON(geminiResponseText);

      // Xử lý dữ liệu đã parse
      if (parsedItems.length > 0) {
        const summaries: string[] = [];

        parsedItems.forEach((item: any) => {
          // Validate cấu trúc item
          if (item && item.action === "create_post" && item.platform && item.content) {
            postsToCreate.push({
              platform: item.platform,
              content: item.content,
              summary: item.summary_for_chat || `Đã tạo bài đăng trên ${item.platform}.`
            });
            if (item.summary_for_chat) {
              summaries.push(item.summary_for_chat);
            }
          }
        });

        // Nếu trích xuất thành công, cập nhật nội dung hiển thị chatbox bằng summary
        if (summaries.length > 0) {
          aiResponseForChat = summaries.join('\n\n');
        } else if (postsToCreate.length > 0) {
          aiResponseForChat = `Đã tạo ${postsToCreate.length} bài đăng.`;
        }
      }
      // -----------------------------------------------------

      // --- LOGIC MỚI: TÌM/TẠO TAB, ĐẨY NỘI DUNG & CHUYỂN FOCUS ---
      if (postsToCreate.length > 0) {
        const postsStore = useCreatePostsStore.getState(); // Lấy PostStore
        let firstNewPostId: number | null = null;

        for (const aiPost of postsToCreate) {
          // --- FIX: ƯU TIÊN TAB ĐANG FOCUS ---
          // Nếu AI trả về platform trùng với bài đang focus, update bài đó
          // Nếu không, mới tìm theo tên platform

          let targetPostId: number | undefined;

          // 1. Check if matches active post
          const activePost = postsStore.openPosts.find(p => p.id === options.activePostId);
          if (activePost && activePost.type.toLowerCase() === aiPost.platform.toLowerCase()) {
            targetPostId = activePost.id;
          }

          // 2. If not, find by platform name
          if (!targetPostId) {
            const existingTab = postsStore.openPosts.find(
              (tab) => tab.type.toLowerCase() === aiPost.platform.toLowerCase()
            );
            if (existingTab) targetPostId = existingTab.id;
          }

          if (targetPostId) {
            // Nếu tab đã tồn tại, thêm version mới
            postsStore.addPostVersion(targetPostId, aiPost.content);
            postsStore.handlePostContentChange(targetPostId, aiPost.content);
          } else {
            // Nếu không, tạo một tab post mới
            targetPostId = postsStore.handlePostCreate(aiPost.platform);
            postsStore.addPostVersion(targetPostId, aiPost.content);
            postsStore.handlePostContentChange(targetPostId, aiPost.content);
          }

          if (!firstNewPostId) {
            firstNewPostId = targetPostId; // Lưu ID của bài đầu tiên để chuyển focus
          }
        }

        // 2. Chuyển focus sang Tab bài đăng đầu tiên vừa được cập nhật/tạo
        if (firstNewPostId) {
          postsStore.handlePostSelect(firstNewPostId); // Chuyển focus UI
          // Đảm bảo section 'create' đang active
          if (options.onSetActiveSection) {
            options.onSetActiveSection('create');
          }
        }

        // 3. Cập nhật câu trả lời của AI trong chatbox
        aiResponseForChat = postsToCreate.map(p => p.summary).join('\n\n');
      }
      // --- HẾT LOGIC MỚI ---

      // Thêm phản hồi của AI vào chat
      set(state => ({
        chatMessages: [...state.chatMessages, { role: 'assistant', content: aiResponseForChat }]
      }));

      // Lưu trữ sessionId mới nhận được từ API vào state để các tin nhắn sau gửi kèm
      if (data?.sessionId) {
        set({ sessionId: data.sessionId });
      }

    } catch (error: any) {
      const parsed = parseError(error);
      const finalMessage = parsed.message || "Lỗi không xác định.";

      // Show specific toast for AI provider errors (Google/OpenAI/Fal)
      const isProviderApiError = typeof finalMessage === 'string' && (
        finalMessage.includes('quá tải') || finalMessage.includes('đang bận') ||
        finalMessage.includes('vượt giới hạn')
      );

      if (isProviderApiError) {
        // Show the provider-specific error message directly (already localized from backend)
        toast.error(finalMessage, { duration: 8000 });
        set(state => ({
          chatMessages: [...state.chatMessages, { role: 'assistant', content: finalMessage }]
        }));
      } else {
        await handleErrorWithModal(error, finalMessage);
        set(state => ({
          chatMessages: [...state.chatMessages, { role: 'assistant', content: `Xin lỗi, đã có lỗi xảy ra: ${finalMessage}`, isError: true }]
        }));
      }
    } finally {
      set({ isTyping: false });
    }
  },

  clearChat: () => {
    set({ chatMessages: [], sessionId: null, userInstructions: [] });
    // Clear extractedContent khi clear chat để tránh dùng content cũ
    useCreateSourcesStore.getState().setExtractedContent(null);
  },
}));


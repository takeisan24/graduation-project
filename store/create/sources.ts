/**
 * Create Page - Sources Store
 * 
 * Manages saved sources and create from source functionality
 */

import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/utils/storage';
import { supabaseClient } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { useCreditsStore } from '../shared/credits';
import { useLimitExceededModalStore } from '../shared/limitExceededModal';
import { CREDIT_COSTS } from '@/lib/usage';
import { handleErrorWithModal } from '@/lib/utils/errorHandler';
import { CREDIT_ERRORS, SOURCE_ERRORS, GENERIC_ERRORS } from '@/lib/messages/errors';
import type { SavedSource, SourceToGenerate, ChatMessage } from '../shared/types';
import { HOOK_FORMULA, FORMATTING_CONSTRAINTS, ALL_HYPNOTIC_KEYWORDS } from "@/lib/constants/hypnotic-keywords";
import { VIDEO_SCRIPT_TEMPLATES } from "@/lib/prompts";

interface CreateSourcesState {
  // State
  savedSources: SavedSource[];
  isSourceModalOpen: boolean;
  isCreateFromSourceModalOpen: boolean;
  sourceToGenerate: SourceToGenerate;
  extractedContent: string | null; // Lưu extracted content từ YouTube để dùng cho chat AI

  // Actions
  setIsSourceModalOpen: (isOpen: boolean) => void;
  addSavedSource: (source: Omit<SavedSource, 'id'>) => SavedSource;
  deleteSavedSource: (sourceId: string) => void;
  openCreateFromSourceModal: (source: SourceToGenerate) => void;
  closeCreateFromSourceModal: () => void;
  setExtractedContent: (content: string | null) => void;
  generatePostsFromSource: (
    selectedPlatforms: { platform: string; count: number }[],
    selectedModel: string,
    options: {
      onPostCreate?: (platform: string, content: string) => number;
      onPostContentChange?: (postId: number, content: string) => void;
      onAddChatMessage?: (message: ChatMessage) => void;
      onSetTyping?: (isTyping: boolean) => void;
    }
  ) => Promise<boolean>;
}

// Thêm đoạn này vào đầu file, sau các import
const parseSourceValue = (value: string) => {
  const separator = '\n\n[Attached Link/Resource]:';
  const parts = value.split(separator);
  return {
    idea: parts[0].trim(),
    resourceUrl: parts[1]?.trim() || '' // Link sạch (Youtube/TikTok/File)
  };
};

export const useCreateSourcesStore = create<CreateSourcesState>((set, get) => ({
  // Initial state - load from localStorage
  savedSources: loadFromLocalStorage<SavedSource[]>('savedSources', []),
  isSourceModalOpen: false,
  isCreateFromSourceModalOpen: false,
  sourceToGenerate: null,
  extractedContent: null,

  setIsSourceModalOpen: (isOpen) => set({ isSourceModalOpen: isOpen }),

  addSavedSource: (source) => {
    const newSource = { ...source, id: Date.now().toString() };
    set(state => {
      const updatedSources = [...state.savedSources, newSource];
      saveToLocalStorage('savedSources', updatedSources);
      return { savedSources: updatedSources };
    });
    return newSource;
  },

  deleteSavedSource: (sourceId) => {
    set(state => {
      const updatedSources = state.savedSources.filter(s => s.id !== sourceId);
      saveToLocalStorage('savedSources', updatedSources);
      return { savedSources: updatedSources };
    });
  },

  openCreateFromSourceModal: (source) => set({ sourceToGenerate: source, isCreateFromSourceModalOpen: true }),

  closeCreateFromSourceModal: () => set({ isCreateFromSourceModalOpen: false, sourceToGenerate: null }),

  setExtractedContent: (content) => set({ extractedContent: content }),

  generatePostsFromSource: async (selectedPlatforms, selectedModel, options) => {
    const { sourceToGenerate } = get();
    if (!sourceToGenerate) return false;

    const { idea, resourceUrl } = parseSourceValue(sourceToGenerate.value);
    const sourceType = sourceToGenerate.type;
    // FE Validation: Check credits before generating posts from source
    const creditsStore = useCreditsStore.getState();
    await creditsStore.refreshCredits(true); // Force refresh to get latest credits
    const creditsRemaining = useCreditsStore.getState().creditsRemaining;
    const totalPosts = selectedPlatforms.reduce((acc, p) => acc + p.count, 0);
    const creditsRequired = CREDIT_COSTS.TEXT_ONLY * totalPosts; // 1 credit per post/platform

    if (creditsRemaining < creditsRequired) {
      // Show limit exceeded modal
      const errorMessage = CREDIT_ERRORS.INSUFFICIENT_CREDITS_CONTENT(totalPosts, creditsRequired, creditsRemaining);
      useLimitExceededModalStore.getState().openModal('insufficient_credits', errorMessage, {
        profileUsage: useCreditsStore.getState().profileLimits,
        postUsage: useCreditsStore.getState().postLimits,
        creditsRemaining: creditsRemaining,
        currentPlan: useCreditsStore.getState().currentPlan,
      });
      // Show error toast (only here, not duplicate in handleErrorWithModal)
      toast.error(errorMessage);
      return false;
    }

    // Cập nhật UI để báo cho người dùng biết quá trình bắt đầu
    if (options.onSetTyping) options.onSetTyping(true);
    set({ isCreateFromSourceModalOpen: false });

    const chatMessageContent = `Đang tạo ${selectedPlatforms.reduce((acc, p) => acc + p.count, 0)} bài viết từ nguồn ${sourceToGenerate.type}...`;
    if (options.onAddChatMessage) {
      options.onAddChatMessage({ role: 'assistant', content: chatMessageContent });
    }

    // 1. Xây dựng phần chỉ dẫn bằng text cho AI
    //    - Giữ nguyên hướng dẫn cũ cho Gemini (đang hoạt động ổn định)
    //    - Tạo thêm phiên bản siết chặt định dạng cho ChatGPT/OpenAI để FE dễ parse
    const normalizedModel = (selectedModel || '').toLowerCase().trim();
    const isChatGPT = normalizedModel === 'chatgpt';

    const commonPersona = `
YÊU CẦU VỀ GIỌNG VĂN VÀ KIẾN THỨC (PERSONA):
- Bạn đóng vai là một CHUYÊN GIA đang chia sẻ kiến thức, tư duy của ĐÍCH THÂN BẠN. Bạn viết như đang tâm tình với một người bạn.
- Xưng hô: "tôi" hoặc "mình" và gọi người đọc là "bạn" hoặc "mọi người".
- Tuyệt đối TRÁNH các từ sáo rỗng như: "chuyên gia", "mẹo chuyên gia", "bậc thầy", "hàng đầu", "trong kỷ nguyên số"...
- KIẾN THỨC TỪ NGUỒN: Bạn hãy "học lỏm" tư duy, số liệu, chuyên môn và yếu tố viral từ nguồn (source) được cung cấp để tự viết lại bài. Kiến thức này giờ ĐÃ LÀ CỦA BẠN.
- TUYỆT ĐỐI KHÔNG TRÍCH DẪN: Không được nhắc đến tên tác giả gốc, tên kênh YouTube/TikTok, tên bài báo, hay bất kỳ bên thứ ba nào. KHÔNG sử dụng các cụm từ như "Theo video này", "Trong bài báo này", "Diễn giả X chia sẻ"...
- CẤM LẤY TÊN TÁC GIẢ LÀM TÊN NHÂN VẬT: Nếu kịch bản yêu cầu có nhân vật (như Audio/Lời thoại), TUYỆT ĐỐI KHÔNG dùng tên của người trong video/nội dung gốc (ví dụ: cấm dùng tên "Khoai", "Sang", "Giang"... để dán nhãn người nói). Nhân vật đọc thoại BẮT BUỘC phải đổi thành "TÔI", "MÌNH", "HOST" hoặc "NARRATOR".
- Ngôn ngữ: Sử dụng ngôn ngữ phù hợp với yêu cầu của người dùng (Tiếng Việt hoặc Tiếng Anh). Mặc định trả lời bằng ngôn ngữ người dùng đang sử dụng.
- Facebook: Độ dài bài viết linh hoạt theo yêu cầu. Nếu không quy định độ dài, hãy phân tích đủ sâu và chi tiết để mang lại giá trị nhất cho người đọc.

QUY TẮC SỐ 1 - TIÊU ĐỀ (HOOK):
Mọi bài viết BẮT BUỘC phải bắt đầu bằng 1 câu Tiêu đề (Hook) duy nhất, chọn từ danh sách công thức:
${HOOK_FORMULA}
Gợi ý từ thôi miên: ${ALL_HYPNOTIC_KEYWORDS.slice(0, 10).join(', ')}...

QUY CHUẨN BẮT BUỘC KHI VIẾT (FORMAT & CONSTRAINTS):
${FORMATTING_CONSTRAINTS}

QUY TẮC CẤM KỴ (QUAN TRỌNG):
- TUYỆT ĐỐI KHÔNG dùng các tiêu đề dàn ý gạch đầu dòng cứng nhắc như: "Mở bài:", "Thân bài:", "Kết bài:", "Lợi ích thực tế:", "Kết luận:", "Tóm lại:"... Bài viết phải là nội dung hoàn chỉnh, đọc mượt mà như người thật viết.
- KHÔNG đánh số thứ tự liệt kê kiểu "1), 2), 3)", thay vào đó hãy dùng bullet points (•, -) hoặc icon phù hợp.
- Field "content" trả về BẮT BUỘC phải là một CHUỖI VĂN BẢN (STRING) DUY NHẤT. TUYỆT ĐỐI KHÔNG trả về Object bên trong "content" (kể cả với Kịch bản Video, hãy gộp tất cả thành 1 string ngắt dòng bằng \\n).
- ĐỂ TRÁNH LỖI JSON PARSE: TUYỆT ĐỐI KHÔNG SỬ DỤNG DẤU NGOẶC KÉP KÉP ("...") BÊN TRONG NỘI DUNG BÀI VIẾT (Field "content"). Nếu cần trích dẫn, hãy sử dụng Dấu ngoặc đơn ('...') hoặc Dấu ngoặc nhọn («...»).`;

    const geminiInstructions = `Dựa trên nội dung của file/video/văn bản được cung cấp, hãy tạo các bài đăng theo yêu cầu sau:\n${selectedPlatforms.map(p => `- Tạo ${p.count} bài đăng cho nền tảng ${p.platform}.`).join('\n')}\n\nHãy sáng tạo, đừng chỉ tóm tắt. Phân tích sâu nội dung để đưa ra các góc nhìn thú vị.\n
${commonPersona}

YÊU CẦU NGÔN NGỮ:
- Sử dụng ngôn ngữ phù hợp với yêu cầu của người dùng (Tiếng Việt hoặc Tiếng Anh). 
- Mặc định trả lời bằng ngôn ngữ người dùng đang sử dụng.

HƯỚNG DẪN THEO NỀN TẢNG (ÁP DỤNG KHI THUỘC NỀN TẢNG TƯƠNG ỨNG):
- LinkedIn: giọng văn chuyên nghiệp nhưng vẫn gần gũi, tập trung insight & giá trị. Thêm 3-5 hashtag phù hợp ở cuối. HOOK gợi ý: Dùng nhóm "Gây tò mò / Bí mật" hoặc "Lời khuyên / Truyền cảm hứng".
- Facebook: Độ dài linh hoạt theo nhu cầu của người dùng. Phân tích chi tiết tận gốc vấn đề nếu bài dài. Dùng emoji sinh động, bắt trend, dễ hiểu. BẮT BUỘC thêm 3-5 hashtag ở cuối bài. HOOK gợi ý: Dùng nhóm "Chứng minh / Trải nghiệm" hoặc "Lời khuyên / Truyền cảm hứng".
- Instagram: BẮT BUỘC viết dưới dạng NỘI DUNG CAROUSEL (Nhiều slide dạng văn bản/hình ảnh cuộn). Phân chia rõ ràng: [Slide 1], [Slide 2]... Mỗi slide chứa nội dung ngắn gọn, súc tích. BẮT BUỘC thêm 3-5 hashtag phù hợp ở cuối bài. HOOK gợi ý: Dùng nhóm "Gây tò mò / Bí mật" hoặc "Sai lầm / Cảnh báo".
- TikTok, YouTube (KỊCH BẢN VIDEO): KHÔNG viết bài đăng thông thường. BẮT BUỘC viết dưới dạng KỊCH BẢN VIDEO bằng cách chọn 1 trong 8 cấu trúc sau (hook phù hợp đã được gợi ý trong từng template):
${VIDEO_SCRIPT_TEMPLATES}
- Twitter (X): ngắn gọn, súc tích (dưới 280 ký tự nếu có thể), ưu tiên 1–2 câu chính. Thêm 2-3 hashtag. HOOK gợi ý: Dùng nhóm "Sai lầm / Cảnh báo" hoặc "Gây tò mò / Bí mật".

Định dạng phản hồi của bạn BẮT BUỘC là một mảng JSON như sau:
\`\`\`json
[
  {
    "action": "create_post",
    "platform": "Tên nền tảng",
    "content": "BẮT BUỘC LÀ CHUỖI VĂN BẢN (STRING) DUY NHẤT. KHÔNG DÙNG OBJECT/JSON.",
    "summary_for_chat": "Tóm tắt ngắn gọn để hiển thị trong chatbox."
  }
]
\`\`\``;

    const openAIInstructions = `Dựa trên nội dung của file/video/văn bản được cung cấp, hãy tạo các bài đăng theo yêu cầu sau:\n${selectedPlatforms.map(p => `- Tạo ${p.count} bài đăng cho nền tảng ${p.platform}.`).join('\n')}\n\nHãy sáng tạo, đừng chỉ tóm tắt. Phân tích sâu nội dung để đưa ra các góc nhìn thú vị.\n
${commonPersona}

YÊU CẦU NGÔN NGỮ:
- Sử dụng ngôn ngữ phù hợp với yêu cầu của người dùng (Tiếng Việt hoặc Tiếng Anh). 
- Mặc định trả lời bằng ngôn ngữ người dùng đang sử dụng.

HƯỚNG DẪN THEO NỀN TẢNG (ÁP DỤNG KHI THUỘC NỀN TẢNG TƯƠNG ỨNG):
- LinkedIn: giọng văn chuyên nghiệp nhưng vẫn gần gũi, tập trung insight & giá trị. Thêm 3-5 hashtag phù hợp ở cuối (định dạng: #tag1 #tag2 #tag3). HOOK gợi ý: Dùng nhóm "Gây tò mò / Bí mật" hoặc "Lời khuyên / Truyền cảm hứng".
- Facebook: Độ dài linh hoạt theo nhu cầu của người dùng. Phân tích chi tiết tận gốc vấn đề nếu bài dài. Dùng emoji sinh động, bắt trend, dễ hiểu. BẮT BUỘC thêm 3-5 hashtag ở cuối bài (định dạng chuẩn: #tag1 #tag2 #tag3, ngăn cách bằng dấu cách). HOOK gợi ý: Dùng nhóm "Chứng minh / Trải nghiệm" hoặc "Lời khuyên / Truyền cảm hứng".
- Instagram: dùng emoji sinh động, bắt trend, dễ hiểu. BẮT BUỘC thêm 3-5 hashtag phù hợp ở cuối bài. HOOK gợi ý: Dùng nhóm "Gây tò mò / Bí mật" hoặc "Sai lầm / Cảnh báo".
- TikTok: KHÔNG viết bài đăng thông thường. BẮT BUỘC viết dưới dạng KỊCH BẢN VIDEO ngắn. Cấu trúc rõ ràng theo phân cảnh: Thời gian, Hình ảnh (Visual), Lời thoại/Âm thanh (Audio). Trình bày rõ ràng.
- YouTube: KHÔNG viết bài đăng thông thường. BẮT BUỘC viết dưới dạng KỊCH BẢN VIDEO chi tiết (gồm Hook, Intro, Body, Outro), phân chia rõ Hình ảnh (Visual) và Lời thoại (Audio). Trình bày rõ ràng.
- Twitter (X): ngắn gọn, súc tích (dưới 280 ký tự), ưu tiên 1–2 câu chính. Thêm 2-3 hashtag. HOOK gợi ý: Dùng nhóm "Sai lầm / Cảnh báo" hoặc "Gây tò mò / Bí mật".

ĐỊNH DẠNG PHẢN HỒI (BẮT BUỘC):
- Chỉ được trả về DUY NHẤT một khối code JSON, không có bất kỳ text nào trước hoặc sau.
- Nội dung trong khối code phải là một MẢNG JSON, mỗi phần tử là một object có cấu trúc sau:

\`\`\`json
[
  {
    "action": "create_post",
    "platform": "Tên nền tảng",
    "content": "Nội dung bài đăng đã tạo.",
    "summary_for_chat": "Tóm tắt ngắn gọn để hiển thị trong chatbox."
  }
]
\`\`\`

YÊU CẦU NGHIÊM NGẶT:
- Luôn bao toàn bộ mảng JSON trong cặp dấu \`\`\`json ... \`\`\` đúng như trên.
- KHÔNG thêm lời giải thích, tiêu đề, mô tả hay bất kỳ ký tự nào bên ngoài khối \`\`\`json\`\`\`.
- Luôn trả về MẢNG (kể cả chỉ có 1 phần tử).`;

    let instructions = isChatGPT ? openAIInstructions : geminiInstructions;

    // 2. Chuẩn bị 'promptParts'
    let promptParts: any[];
    try {
      if (sourceType === 'pdf') {
        promptParts = [
          instructions,
          { fileData: { mimeType: 'application/pdf', fileUri: resourceUrl } }
        ];
      } else if (sourceType === 'youtube') {
        // YouTube links: Pass URL as fileData for service layer to handle
        // Service layer will:
        // - If ChatGPT: Step 1 extract with Gemini Flash, Step 2 gen with OpenAI
        // - If Gemini: Gen directly with Gemini Flash
        // Reference: https://ai.google.dev/gemini-api/docs/video-understanding#javascript
        // Format: fileData: { fileUri: 'https://www.youtube.com/watch?v=...', mimeType: 'video/*' }
        promptParts = [
          idea + "\n" + instructions,
          {
            fileData: {
              fileUri: resourceUrl, // YouTube URL
              mimeType: 'video/*' // Gemini will recognize YouTube URLs
            }
          }
        ];

        console.log('[YouTube] Passing YouTube URL to service layer for processing:', resourceUrl);
      } else if (sourceType === 'tiktok') {
        promptParts = [
          `${idea}\n${instructions}\n\nNguồn video (TikTok): ${resourceUrl}\nHãy truy cập và trích xuất ý chính rồi tạo bài theo định dạng JSON yêu cầu.`,
        ];
      } else {
        const simplePrompt = `${idea}\nDựa trên nguồn sau đây: "${resourceUrl}", ${instructions}`;
        promptParts = [simplePrompt];
      }

      // 3. Extract platforms array from selectedPlatforms for credit calculation
      const platforms = selectedPlatforms.flatMap(p =>
        Array(p.count).fill(p.platform.toLowerCase())
      );

      // 4. Gọi API generate-from-source
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch('/api/ai/generate-from-source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          promptParts,
          // Gửi model FE đang chọn để BE quyết định dùng ChatGPT (OpenAI) hay Gemini
          modelPreference: selectedModel,
          platforms: platforms
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        // Handle error with modal (will show both toast and modal if it's a limit/credits error)
        const errorMessage = err.error || SOURCE_ERRORS.GENERATE_FROM_SOURCE_FAILED('');
        await handleErrorWithModal(err, errorMessage);
        // Error already handled (toast + modal shown), no need to throw
        // Add error message to chat and return
        if (options.onAddChatMessage) {
          options.onAddChatMessage({
            role: 'assistant',
            content: SOURCE_ERRORS.GENERATE_POSTS_FROM_SOURCE_FAILED(errorMessage),
          });
        }
        if (options.onSetTyping) options.onSetTyping(false);
        set({ sourceToGenerate: null });
        return false;
      }

      const raw = await response.json();
      const data = (raw && typeof raw === 'object' && 'data' in raw) ? (raw as any).data : raw;
      const geminiResponseText: string = typeof data?.response === 'string' ? data.response : '';

      // Update credits from API response if available
      if (data?.creditsRemaining !== undefined) {
        useCreditsStore.getState().updateCredits(data.creditsRemaining);
      }

      // Lưu extractedContent từ API response (nếu có) để dùng cho chat AI
      // Chỉ lưu nếu sourceType là YouTube (extractedContent chỉ có khi gen từ YouTube)
      if (data?.extractedContent && sourceType === 'youtube') {
        set({ extractedContent: data.extractedContent });
        console.log('[Sources] Saved extracted content for chat AI:', data.extractedContent.substring(0, 100) + '...');
      } else if (sourceType !== 'youtube') {
        // Clear extractedContent nếu gen từ nguồn khác (không phải YouTube)
        // để tránh dùng content cũ từ lần gen trước
        set({ extractedContent: null });
      }

      // 5. Phân tích phản hồi JSON (có fallback khi parse lỗi)
      const jsonMatch = geminiResponseText.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch || !jsonMatch[1]) {
        // Không tìm thấy JSON: fallback báo lỗi nhẹ, không throw để tránh văng parse
        const preview = geminiResponseText.slice(0, 200) + (geminiResponseText.length > 200 ? '...' : '');
        console.warn("AI response missing JSON block. Preview:", preview);
        if (options.onAddChatMessage) {
          options.onAddChatMessage({
            role: 'assistant',
            content: SOURCE_ERRORS.AI_RESPONSE_NO_JSON,
          });
        }
        return false;
      }

      // Làm sạch JSON trước khi parse để tránh lỗi thường gặp từ model (dấu phẩy thừa, xuống dòng, ...)
      let rawJson = jsonMatch[1].trim();
      // Loại bỏ dấu phẩy thừa trước } hoặc ]
      rawJson = rawJson.replace(/,(\s*[}\]])/g, '$1');

      let parsedResponses: any;
      try {
        parsedResponses = JSON.parse(rawJson);
      } catch (e) {
        // Log chi tiết cho debug nhưng không throw, tránh văng lỗi JSON.parse
        console.error("Lỗi parse JSON từ AI generate-from-source:", {
          error: e instanceof Error ? e.message : e,
          jsonPreview: rawJson.substring(0, 300) + (rawJson.length > 300 ? '...' : ''),
        });
        if (options.onAddChatMessage) {
          options.onAddChatMessage({
            role: 'assistant',
            content: SOURCE_ERRORS.AI_RESPONSE_NO_JSON,
          });
        }
        return false;
      }
      if (!Array.isArray(parsedResponses)) {
        if (options.onAddChatMessage) {
          options.onAddChatMessage({
            role: 'assistant',
            content: SOURCE_ERRORS.AI_RESPONSE_NOT_ARRAY,
          });
        }
        return false;
      }

      let overallSummary = `Đã tạo thành công các bài viết từ nguồn:\n`;
      for (const postData of parsedResponses) {
        if (postData.action === 'create_post' && postData.platform && postData.content) {
          if (options.onPostCreate && options.onPostContentChange) {
            const newPostId = options.onPostCreate(postData.platform, postData.content);
            if (newPostId) {
              options.onPostContentChange(newPostId, postData.content);
            }
          }
          overallSummary += `- ${postData.summary_for_chat || `Một bài đăng cho ${postData.platform}`}\n`;
        }
      }

      if (options.onAddChatMessage) {
        options.onAddChatMessage({ role: 'assistant', content: overallSummary.trim() });
      }

      return true; // Success

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : GENERIC_ERRORS.UNKNOWN_ERROR_WITH_DETAILS;

      // Parse thông điệp lỗi thân thiện cho user (ví dụ lỗi OpenAI trả về JSON string)
      let userFriendlyMessage = errorMessage;
      const extractInnerMessage = (raw: string): string => {
        // Thử bắt message bên trong chuỗi JSON OpenAI: ..."message": "...."...
        const innerMatch = raw.match(/"message"\s*:\s*"([^"]+)"/);
        if (innerMatch && innerMatch[1]) {
          return innerMatch[1];
        }
        return raw;
      };

      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed && typeof parsed.message === 'string') {
          // parsed.message thường chứa chuỗi OpenAI API error: 429 { "error": { "message": "..." } }
          userFriendlyMessage = extractInnerMessage(parsed.message);
        }
      } catch {
        // Không phải JSON wrapper, thử extract trực tiếp từ errorMessage
        userFriendlyMessage = extractInnerMessage(errorMessage);
      }

      console.error("Lỗi khi tạo bài viết từ nguồn:", errorMessage);
      // Handle error với modal/toast: vẫn truyền full errorMessage để debug đầy đủ
      await handleErrorWithModal(error, errorMessage);

      // Khi hiển thị trong khung chat, chỉ hiển thị phần message ngắn gọn cho user
      if (options.onAddChatMessage) {
        options.onAddChatMessage({
          role: 'assistant',
          content: SOURCE_ERRORS.GENERATE_POSTS_FROM_SOURCE_FAILED(userFriendlyMessage),
        });
      }
      return false; // Failed
    } finally {
      if (options.onSetTyping) options.onSetTyping(false);
      set({ sourceToGenerate: null });
    }
  },
}));
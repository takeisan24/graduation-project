/**
 * Centralized AI Prompts Manager
 * 
 * All AI prompts used throughout the application are defined here.
 * This makes it easy to update, maintain, and version control prompts.
 */

/**
 * Master system prompts
 */
import { HOOK_FORMULA, FORMATTING_CONSTRAINTS, ALL_HYPNOTIC_KEYWORDS } from "@/lib/constants/hypnotic-keywords";

export const MASTER_SYSTEM_PROMPT = `Bạn là một chuyên gia content marketing người Việt, có khả năng viết với giọng văn tự nhiên, gần gũi, và đầy cảm xúc như người thật. TUYỆT ĐỐI KHÔNG viết theo văn phong AI rập khuôn, dịch thuật, hay giáo điều.

  QUY TẮC SỐ 1 - TIÊU ĐỀ (HOOK):
  Mọi bài viết BẮT BUỘC phải bắt đầu bằng 1 câu Tiêu đề (Hook) duy nhất, chọn từ danh sách công thức phù hợp.
  Danh sách công thức hook:
  ${HOOK_FORMULA}
  (Hãy sử dụng một trong các từ thôi miên sau: ${ALL_HYPNOTIC_KEYWORDS.slice(0, 10).join(', ')}...)

  QUY CHUẨN BẮT BUỘC KHI VIẾT (FORMAT & CONSTRAINTS):
  ${FORMATTING_CONSTRAINTS}

  QUY TẮC CẤM KỴ (QUAN TRỌNG):
  - TUYỆT ĐỐI KHÔNG dùng các tiêu đề dàn ý gạch đầu dòng cứng nhắc như: "Mở bài:", "Thân bài:", "Kết bài:", "Lợi ích thực tế:", "Kết luận:", "Tóm lại:"... Bài viết phải là nội dung hoàn chỉnh, đọc mượt mà như người thật viết.
  - KHÔNG đánh số thứ tự liệt kê kiểu "1), 2), 3)", thay vào đó hãy dùng bullet points (•, -) hoặc icon phù hợp.

  QUY TẮC SỐ 2 - GIAO TIẾP VỚI NGƯỜI DÙNG:
  - Nếu người dùng chào hỏi (ví dụ: "hello", "chào bạn", "hi") hoặc hỏi chuyện xã giao: HÃY TRẢ LỜI NHƯ NGƯỜI BÌNH THƯỜNG (conversationally).
  - KHÔNG được tạo bài đăng (JSON post) trong trường hợp này.
  - Chỉ tạo bài đăng khi người dùng yêu cầu cụ thể về nội dung (ví dụ: "viết bài về...", "tạo caption cho...").
  - Luôn thân thiện, nhiệt tình và sẵn sàng hỗ trợ.

  YÊU CẦU KHÁC:
  1. Ngữ pháp & Trình bày:
  Viết thành đoạn văn hoàn chỉnh, không chia dòng ngắn như thơ.
  Sử dụng dấu câu đúng nhịp điệu nói của người Việt.

  2. Từ ngữ & Giọng văn:
  Dùng từ ngữ đời thường, tránh các cụm từ sáo rỗng như "trong thời đại số hóa", "không thể phủ nhận rằng".
  Xưng hô tự nhiên (mình - bạn, tôi - bạn).
  Viết như đang kể chuyện hoặc chia sẻ, không giảng dạy.
  
  3. Cảm xúc & Tính cụ thể:
  Luôn lồng ghép ví dụ, tình huống, hoặc chi tiết thực tế.
  Thể hiện cảm xúc (vui, bất ngờ, đồng cảm...).
  Kết bài bằng lời kêu gọi hành động (CTA) mềm mại, tự nhiên, không thúc ép.
`;
/**
 * System prompts for different content types
 */
export const SYSTEM_PROMPTS = {
  text: "You are an expert social media content writer and editor. You help improve captions, posts, and text content for various social media platforms. Provide helpful suggestions, rewrites, and optimizations.",
  image: "You are an expert visual content strategist. You help create compelling image descriptions, captions, and visual content ideas for social media. Focus on visual storytelling and engagement.",
  video: "You are an expert video content creator and strategist. You help create engaging video scripts, descriptions, and content ideas for social media platforms. Focus on video storytelling and viral potential."
} as const;

/**
 * Platform-specific context instructions
 */
export const PLATFORM_CONTEXTS = {
  tiktok: "TikTok: Focus on viral potential, trending elements, short-form content, and youth appeal.",
  instagram: "Instagram: Focus on visual appeal, hashtags, emojis, and community engagement.",
  youtube: "YouTube: Focus on SEO optimization, detailed descriptions, and audience retention strategies.",
  facebook: "Facebook: Focus on community building, shareable content, and diverse audience appeal.",
  x: "X: Focus on concise messaging, current events, and thought leadership.",
  threads: "Threads: Focus on conversational tone, personal connection, and Instagram-inspired engagement.",
  linkedin: "LinkedIn: Focus on professional value, industry insights, and business networking.",
  pinterest: "Pinterest: Focus on keyword-rich descriptions, lifestyle inspiration, and visual discovery."
} as const;

/**
 * Context-specific instructions
 */
export const CONTEXT_INSTRUCTIONS = {
  general: "You are a helpful AI assistant for content creation and social media management. You can help with content ideas, writing, editing, and strategy.",
  project: "You are helping with a specific content project. Focus on the project's goals, target audience, and content strategy.",
  draft: "You are helping to refine a specific content draft. Focus on improving the existing content while maintaining its core message.",
  workspace: "You are working within a content creation workspace. Help with brainstorming, planning, and organizing content ideas."
} as const;

/**
 * Suggestion type prompts
 */
export const SUGGESTION_PROMPTS = {
  improve: (platform: string) => `Analyze this content and provide specific suggestions to improve it for ${platform}:`,
  optimize: (platform: string) => `Optimize this content for maximum engagement on ${platform}:`,
  expand: (platform: string) => `Expand this content with additional details and context for ${platform}:`,
  shorten: (platform: string) => `Make this content more concise and impactful for ${platform}:`,
  viralize: (platform: string) => `Make this content more viral-worthy and shareable for ${platform}:`,
  translate: (platform: string, targetLanguage?: string) => `Dịch văn bản sau sang ${targetLanguage || 'ngôn ngữ khác'} (nếu đang là ngôn ngữ đó thì giữ nguyên, hoặc tối ưu lại sao cho tự nhiên). NGUYÊN TẮC: 1. Giữ nguyên ý nghĩa gốc và giọng văn. 2. Bắt buộc giữ nguyên các biểu tượng cảm xúc (emoji) và định dạng. 3. TUYỆT ĐỐI KHÔNG TỰ Ý THÊM BỚT THÔNG TIN, KHÔNG in ra dòng giải thích nào, CHỈ trả về đoạn văn đã dịch. Nội dung gốc:`,
  //TODO: Vietnamese version to format content
  format: (platform: string) => {
    const isProfessional = ['LinkedIn', 'Email'].includes(platform);
    const isShortForm = ['Twitter', 'X', 'Threads'].includes(platform);

    return `Bạn là chuyên gia biên tập nội dung cho ${platform}. Hãy định dạng lại văn bản sau:
    
    NGUYÊN TẮC:
    1. Chia đoạn ngắn gọn, dễ đọc.
    2. Giữ nguyên ý nghĩa gốc, không tự ý bịa thêm thông tin.
    3. Nếu có khối mã (code block), hãy GIỮ NGUYÊN, không chỉnh sửa bên trong nó.
    
    PHONG CÁCH ${platform.toUpperCase()}:
    ${isProfessional
        ? "- Dùng icon tối giản (như ✅, 🔹, 📌). Tránh dùng icon sặc sỡ (như 🔥, 🚀, 😍) trừ khi thật cần thiết.\n- Giọng văn trang trọng, chuyên nghiệp."
        : "- Dùng emoji sinh động phù hợp cảm xúc.\n- Giọng văn tự nhiên, thu hút."}
    
    HASHTAG:
    - Kiểm tra hashtag đã có sẵn trong bài.
    - Chỉ bổ sung thêm nếu thấy thiếu (tối đa 3-5 hashtag tổng cộng).
    - ${isShortForm ? "Đặt hashtag rải rác hoặc cuối bài." : "Đặt hashtag ở cuối bài."}
    
    Nội dung gốc:`;
  }
} as const;

/**
 * Content extraction prompts
 */
export const EXTRACTION_PROMPTS = {
  url: (url: string) => `Extract the title and create a concise summary (2-3 sentences) from this URL: ${url}\nIf unable to access, respond with 'UNABLE_TO_FETCH'.`,
  file: (fileUrl: string) => `Extract the title and create a concise summary (2-3 sentences) from this file: ${fileUrl}\nIf unable to access, respond with 'UNABLE_TO_FETCH'.`,
  prompt: (text: string) => `Extract the title and create a concise summary (2-3 sentences) from this text: ${text}`
} as const;

/**
 * Image generation prompts
 */
export const IMAGE_GENERATION_PROMPTS = {
  default: (description: string, n: number, aspectRatio: string) =>
    `Create ${n} image(s). Ratio: ${aspectRatio}.
    
    STYLE: Follow description (e.g., infographic, flat, 3D). NO enforced photorealism.
    TEXT: Render any text/titles EXACTLY as written (preserve Vietnamese diacritics).
    
    REQ: ${description}`,

  platform: {
    instagram: (description: string) => `Create an Instagram-worthy image: ${description}. Style: modern, vibrant, engaging.`,
    facebook: (description: string) => `Create a Facebook post image: ${description}. Style: clear, shareable, professional.`,
    linkedin: (description: string) => `Create a LinkedIn post image: ${description}. Style: professional, clean, business-focused.`,
    twitter: (description: string) => `Create an X post image: ${description}. Style: bold, attention-grabbing, concise.`
  }
} as const;

/**
 * Video generation prompts
 */
export const VIDEO_GENERATION_PROMPTS = {
  default: (description: string) => `Create a high-quality video based on: ${description}. Style: engaging, modern, professional.`,

  platform: {
    tiktok: (description: string) => `Create a TikTok-style video: ${description}. Style: trendy, fast-paced, engaging.`,
    youtube: (description: string) => `Create a YouTube video: ${description}. Style: professional, informative, well-structured.`,
    instagram: (description: string) => `Create an Instagram Reel: ${description}. Style: vibrant, short-form, engaging.`
  }
} as const;

/**
 * Text generation prompts for platforms
 */
export const TEXT_GENERATION_PROMPTS = {
  platform: {
    instagram: (extracted: { title: string; summary: string }) =>
      `Create an engaging Instagram caption based on: ${extracted.title}. Summary: ${extracted.summary}. Include relevant hashtags and emojis.`,

    tiktok: (extracted: { title: string; summary: string }) =>
      `Create a viral TikTok caption based on: ${extracted.title}. Summary: ${extracted.summary}. Make it catchy and trending.`,

    x: (extracted: { title: string; summary: string }) =>
      `Create a concise X post based on: ${extracted.title}. Summary: ${extracted.summary}. Keep it under 280 characters.`,

    linkedin: (extracted: { title: string; summary: string }) =>
      `Create a professional LinkedIn post based on: ${extracted.title}. Summary: ${extracted.summary}. Focus on value and insights.`,

    facebook: (extracted: { title: string; summary: string }) =>
      `Create an engaging Facebook post based on: ${extracted.title}. Summary: ${extracted.summary}. Make it shareable. Post length should be flexible depending on the user's implicit or explicit needs.`,

    threads: (extracted: { title: string; summary: string }) =>
      `Create a Threads post based on: ${extracted.title}. Summary: ${extracted.summary}. Keep it conversational and engaging.`,

    youtube: (extracted: { title: string; summary: string }) =>
      `Create a YouTube description based on: ${extracted.title}. Summary: ${extracted.summary}. Include SEO keywords and timestamps.`,

    pinterest: (extracted: { title: string; summary: string }) =>
      `Create a Pinterest description based on: ${extracted.title}. Summary: ${extracted.summary}. Include keywords and lifestyle appeal.`
  }
} as const;

/**
 * Hashtag generation prompts
 */
export const HASHTAG_PROMPTS = {
  default: (content: string, platform: string, count: number) =>
    `Generate ${count} relevant hashtags for this ${platform} content: ${content}. Return only hashtags separated by spaces, no explanations.`,

  platform: {
    instagram: (content: string, count: number) =>
      `Generate ${count} Instagram hashtags (mix of popular and niche): ${content}`,

    tiktok: (content: string, count: number) =>
      `Generate ${count} trending TikTok hashtags: ${content}`,

    twitter: (content: string, count: number) =>
      `Generate ${count} X hashtags (trending topics): ${content}`
  }
} as const;

/**
 * Get system prompt for assistant
 */
export function getSystemPrompt(
  contentType: 'text' | 'image' | 'video',
  platform: string = 'general',
  context: 'general' | 'project' | 'draft' | 'workspace' = 'general',
  draftText?: string
): string {
  const systemPrompt = SYSTEM_PROMPTS[contentType];
  const platformContext = PLATFORM_CONTEXTS[platform as keyof typeof PLATFORM_CONTEXTS] || PLATFORM_CONTEXTS.instagram;
  const contextInstruction = CONTEXT_INSTRUCTIONS[context];

  let prompt = `${systemPrompt}\n\n${platformContext}\n\n${contextInstruction}`;

  if (draftText) {
    prompt += `\n\nCurrent content: ${draftText}`;
  }

  return prompt;
}

/**
 * Get suggestion prompt
 */
export function getSuggestionPrompt(
  suggestionType: 'improve' | 'optimize' | 'expand' | 'shorten' | 'viralize' | 'translate',
  platform: string,
  content: string,
  targetLanguage?: string
): string {
  const promptFn = SUGGESTION_PROMPTS[suggestionType] as any;
  if (suggestionType === 'translate' && targetLanguage) {
    return `${promptFn(platform, targetLanguage)} ${content}`;
  }
  return `${promptFn(platform)} ${content}`;
}

/**
 * Get extraction prompt
 */
export function getExtractionPrompt(
  sourceType: 'url' | 'file' | 'prompt',
  sourceContent: string
): string {
  const promptFn = EXTRACTION_PROMPTS[sourceType];
  return promptFn(sourceContent);
}

/**
 * Get image generation prompt
 */
export function getImagePrompt(
  description: string,
  platform?: string,
  n: number = 1,
  aspectRatio: string = '1:1'
): string {
  if (platform && IMAGE_GENERATION_PROMPTS.platform[platform as keyof typeof IMAGE_GENERATION_PROMPTS.platform]) {
    return IMAGE_GENERATION_PROMPTS.platform[platform as keyof typeof IMAGE_GENERATION_PROMPTS.platform](description);
  }
  return IMAGE_GENERATION_PROMPTS.default(description, n, aspectRatio);
}

/**
 * Get video generation prompt
 */
export function getVideoPrompt(
  description: string,
  platform?: string
): string {
  if (platform && VIDEO_GENERATION_PROMPTS.platform[platform as keyof typeof VIDEO_GENERATION_PROMPTS.platform]) {
    return VIDEO_GENERATION_PROMPTS.platform[platform as keyof typeof VIDEO_GENERATION_PROMPTS.platform](description);
  }
  return VIDEO_GENERATION_PROMPTS.default(description);
}

/**
 * Get text generation prompt for platform
 */
export function getTextPrompt(
  platform: string,
  extracted: { title: string; summary: string }
): string {
  const promptFn = TEXT_GENERATION_PROMPTS.platform[platform as keyof typeof TEXT_GENERATION_PROMPTS.platform];
  if (promptFn) {
    return promptFn(extracted);
  }
  // Default fallback
  return `Create a ${platform} post based on: ${extracted.title}. Summary: ${extracted.summary}.`;
}

/**
 * Get hashtag generation prompt
 */
export function getHashtagPrompt(
  content: string,
  platform: string,
  count: number = 10
): string {
  const promptFn = HASHTAG_PROMPTS.platform[platform as keyof typeof HASHTAG_PROMPTS.platform];
  if (promptFn) {
    return promptFn(content, count);
  }
  return HASHTAG_PROMPTS.default(content, platform, count);
}

/**
 * Các cấu trúc Kịch bản Video dành riêng cho TikTok, YouTube, Instagram
 */
export const VIDEO_SCRIPT_TEMPLATES = `Bạn BẮT BUỘC chọn 1 trong 8 cấu trúc Kịch bản Video sau đây sao cho phù hợp nhất với nội dung để viết:

1. KỊCH BẢN KỂ CHUYỆN (NHÂN VẬT)
👉 HOOK PHÙ HỢP: Dùng nhóm "Chứng minh / Trải nghiệm thực tế":
   Ví dụ: "Khoảnh khắc tôi nhận ra ___, mọi thứ đã thay đổi" / "Sai lầm lớn nhất tôi mắc phải khi bắt đầu ___"
- Hook: Có nhân vật cụ thể
- Bối cảnh: Mâu thuẫn / bối cảnh rõ ràng
- Cảm xúc: Mô tả cảm xúc thật (ít nhất 2 cảm xúc)
- Hành động: Cách xử lý hoặc hành động then chốt
- Bài học: Suy nghĩ / quan điểm rút ra
- Kết: Mở, không dạy đời. Giọng kể tự nhiên như kể chuyện đời thật, câu ngắn nói miệng.

2. KỊCH BẢN KỂ CHUYỆN (VƯỢT KHÓ)
👉 HOOK PHÙ HỢP: Dùng nhóm "Chứng minh / Trải nghiệm thực tế" hoặc "Lời khuyên / Truyền cảm hứng":
   Ví dụ: "Mọi người bảo tôi ___, nhưng tôi lại làm ___, và nó hiệu quả" / "Đây là điều cuối cùng khiến tôi vỡ lẽ sau nhiều tháng thất bại"
- [HOOK]: Cảm xúc / tò mò (VD: "Có 1 giai đoạn mình gần như bỏ cuộc vì...")
- [BỐI CẢNH]: Lúc đó mình..., kết quả thì...
- [ĐIỂM GÃY]: Cho tới khi mình nhận ra...
- [HÀNH ĐỘNG]: Mình bắt đầu...
- [KẾT QUẢ]: Sau..., kết quả là...
- [BÀI HỌC]: Nếu bạn đang..., thì nhớ điều này.

3. KỊCH BẢN REVIEW
👉 HOOK PHÙ HỢP: Dùng nhóm "Chứng minh / Trải nghiệm thực tế":
   Ví dụ: "Tôi đã thử ___ trong [X] ngày và đây là những gì đã xảy ra" / "Tôi đã tiêu [X]đ cho ___. Đây là suy nghĩ thật lòng"
- [HOOK]: Trải nghiệm thật (VD: "Cái này mà biết sớm hơn là mình đỡ... rồi.")
- [VẤN ĐỀ BAN ĐẦU]: Trước đây mình gặp vấn đề là...
- [TRẢI NGHIỆM]: Mình thử... và thấy...
- [ĐIỂM THÍCH]: Điểm mình thích nhất là...
- [AI NÊN/KHÔNG NÊN DÙNG]: Cái này hợp với..., còn... thì không cần.
- [KẾT]: Lời khuyên, trải nghiệm thực tế. Quan trọng là dùng đúng mục đích.

4. KỊCH BẢN SAI LẦM
👉 HOOK PHÙ HỢP: Dùng nhóm "Sai lầm / Cảnh báo":
   Ví dụ: "[Số] sai lầm mà bạn nên tránh khi [hành động]" / "Vẫn đang sử dụng [phương pháp lỗi thời]? Đây là lý do bạn nên dừng ngay"
- [HOOK]: Gây tò mò (VD: "90% người làm... đều sai chỗ này.")
- [LIỆT KÊ SAI LẦM]: Trình bày nhanh gọn Sai lầm 1, Sai lầm 2, Sai lầm 3...
- [HẬU QUẢ]: Nêu hậu quả của các lỗi đó.
- [CÁCH LÀM ĐÚNG]: Hướng dẫn cách đúng.
- [KẾT]: Nhấn mạnh (VD: "Biết sớm thì tiết kiệm được rất nhiều...")

5. KỊCH BẢN SO SÁNH A - B
👉 HOOK PHÙ HỢP: Dùng nhóm "Gây tò mò / Bí mật" hoặc "Sai lầm / Cảnh báo":
   Ví dụ: "Đừng sử dụng [cái này] - thay vào đó hãy dùng [cái kia]" / "Tại sao không ai nói về ___ trong [ngành]?"
- [HOOK]: Đặt vấn đề lựa chọn (VD: "Nên chọn A hay B khi...")
- [GIỚI THIỆU A]: Ưu điểm và nhược điểm của A.
- [GIỚI THIỆU B]: Điểm mạnh và điểm yếu của B.
- [SO SÁNH TRỰC DIỆN]: Nếu bạn... thì chọn A. Nếu bạn... thì chọn B.
- [KẾT]: Định hướng ("Không có cái nào tốt tuyệt đối, chỉ có cái phù hợp.").

6. KỊCH BẢN TRƯỚC - SAU (BEFORE/AFTER)
👉 HOOK PHÙ HỢP: Dùng nhóm "Lời khuyên / Truyền cảm hứng":
   Ví dụ: "Nếu tôi phải bắt đầu lại từ đầu, tôi sẽ..." / "Bạn có thể [đạt được điều phi thường] ngay cả khi [điều bình thường]"
- [HOOK]: Đối lập (VD: "Trước khi... và sau khi... thì...")
- [TRƯỚC]: Tình trạng và cảm giác trước đây.
- [ĐIỂM CHUYỂN]: Bước ngoặt thay đổi.
- [SAU]: Hành động sau đó và kết quả.
- [KẾT]: Nhấn mạnh điểm khác biệt thực sự nằm ở đâu.

7. KỊCH BẢN LỜI KHUYÊN / GÓC NHÌN NGƯỢC SỐ ĐÔNG
👉 HOOK PHÙ HỢP: Dùng nhóm "Lời khuyên / Truyền cảm hứng" hoặc "Gây tò mò / Bí mật":
   Ví dụ: "Đây là một lời nói dối mà [ngành] không bao giờ thừa nhận" / "Ngừng [thói quen cũ] - hãy bắt đầu [hành động mới]"
- [HOOK]: Ngược số đông (VD: "Nếu được làm lại từ đầu, mình sẽ không...")
- [NIỀM TIN SAI]: Chỉ ra điều mọi người lầm tưởng.
- [QUAN ĐIỂM ĐÚNG]: Đưa ra góc nhìn thực tế.
- [VÍ DỤ/TRẢI NGHIỆM]: Dẫn chứng câu chuyện thật.
- [KẾT]: Chốt lại chân lý đơn giản nhưng ít ai làm được.

8. KỊCH BẢN HƯỚNG DẪN (HOW-TO)
👉 HOOK PHÙ HỢP: Dùng nhóm "Làm thế nào (How-to)":
   Ví dụ: "Làm thế nào để [kết quả ấn tượng] chỉ trong [thời gian]?" / "Đây là cách lười biếng nhất để đạt được [kết quả mong muốn]"
- [HOOK]: Đánh trúng vấn đề (VD: "Nếu bạn đang... mà mãi không ra kết quả, xem cái này.")
- [ĐỊNH VỊ]: Nêu rõ video dành cho ai.
- [NỘI DUNG CHÍNH]: Chia thành 2-4 bước rõ ràng.
- [LỖI PHỔ BIẾN]: Lưu ý những chỗ hay sai.
- [KẾT]: Nhấn mạnh giá trị khi làm đúng.

LƯU Ý QUAN TRỌNG KHI VIẾT HOOK:
- Câu hook BẮT BUỘC phải viết theo đúng nhóm được gợi ý cho template bạn vừa chọn ở trên.
- Hook phải là câu mở đầu THỰC TẾ, không phải chỉ mô tả cấu trúc.
- Điền vào [nội dung] bằng nội dung thực của bài, không để placeholder.

LƯU Ý TRÌNH BÀY KỊCH BẢN:
1. Phân chia rõ rệt thành 2 phần (Ví dụ: **[HÌNH ẢNH]** - tả cảnh, **[ÂM THANH/THOẠI]** - lời nói).
2. TÊN NHÂN VẬT (BẮT BUỘC): Khi ghi tên người nói thoại, TUYỆT ĐỐI KHÔNG dùng tên thật của người trong video/nội dung gốc (Cấm mọi tên riêng như "Khoai", "Giang"...). Bạn BẮT BUỘC phải dùng đại từ "TÔI", "MÌNH", "HOST" hoặc "NARRATOR". (Ví dụ ĐÚNG: **TÔI (giọng hào hứng):** "Hôm nay mình sẽ chia sẻ...").
Kịch bản phải trình bày rõ ràng, dễ nhìn để người dùng có thể đem đi quay hoặc dựng video ngay lập tức.
`;

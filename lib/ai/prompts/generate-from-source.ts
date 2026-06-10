/**
 * AI Prompt Templates — Generate from Source
 *
 * Extracted from store/create/sources.ts (generatePostsFromSource)
 * Centralizes prompt engineering for AI post generation.
 */

import { HOOK_FORMULA, FORMATTING_CONSTRAINTS, ALL_HYPNOTIC_KEYWORDS } from '@/lib/constants/hypnotic-keywords';

export interface GenerateFromSourceContext {
  selectedPlatforms: { platform: string; count: number }[];
  sourceType: string;
  idea: string;
  resourceUrl: string;
}

/**
 * Build platform instruction lines from selected platforms
 */
function buildPlatformInstructions(ctx: GenerateFromSourceContext): string {
  return ctx.selectedPlatforms
    .map(p => `- Tạo ${p.count} bài đăng cho nền tảng ${p.platform}.`)
    .join('\n');
}

// ─────────────────────────────────────────────────────────────
// SHARED PERSONA (used by both Gemini and OpenAI prompts)
// ─────────────────────────────────────────────────────────────

const COMMON_PERSONA = `
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

/**
 * Build prompt parts array for API call based on source type
 */
export function buildPromptParts(ctx: GenerateFromSourceContext): any[] {
  const { sourceType, idea, resourceUrl } = ctx;
  const instructions = buildInstructions(ctx);

  if (sourceType === 'pdf') {
    return [
      instructions,
      { fileData: { mimeType: 'application/pdf', fileUri: resourceUrl } },
    ];
  } else if (sourceType === 'youtube') {
    return [
      idea + "\n" + instructions,
      { fileData: { fileUri: resourceUrl, mimeType: 'video/*' } },
    ];
  } else if (sourceType === 'tiktok') {
    return [
      `${idea}\n${instructions}\n\nNguồn video (TikTok): ${resourceUrl}\nHãy truy cập và trích xuất ý chính rồi tạo bài theo định dạng JSON yêu cầu.`,
    ];
  } else {
    return [`${idea}\nDựa trên nguồn sau đây: "${resourceUrl}", ${instructions}`];
  }
}

// ─────────────────────────────────────────────────────────────
// GEMINI PROMPT (for Gemini Pro model)
// ─────────────────────────────────────────────────────────────

function buildInstructions(ctx: GenerateFromSourceContext): string {
  const platformInstr = buildPlatformInstructions(ctx);
  const platformGuide = `
HƯỚNG DẪN THEO NỀN TẢNG (ÁP DỤNG KHI THUỘC NỀN TẢNG TƯƠNG ỨNG):
- LinkedIn: giọng văn chuyên nghiệp nhưng vẫn gần gũi, tập trung insight & giá trị. Thêm 3-5 hashtag phù hợp ở cuối. HOOK gợi ý: Dùng nhóm "Gây tò mò / Bí mật" hoặc "Lời khuyên / Truyền cảm hứng".
- Facebook: Độ dài linh hoạt theo nhu cầu của người dùng. Phân tích chi tiết tận gốc vấn đề nếu bài dài. Dùng emoji sinh động, bắt trend, dễ hiểu. BẮT BUỘC thêm 3-5 hashtag ở cuối bài. HOOK gợi ý: Dùng nhóm "Chứng minh / Trải nghiệm" hoặc "Lời khuyên / Truyền cảm hứng".
- Instagram: viết dưới dạng CAPTION HOÀN CHỈNH ĐĂNG ĐƯỢC NGAY (một đoạn caption tự nhiên: hook + nội dung giá trị + emoji). TUYỆT ĐỐI KHÔNG viết dạng kịch bản nhiều slide ([Slide 1], [Slide 2]...). 125 ký tự đầu là quan trọng nhất (hiển thị trước nút "xem thêm"). KHÔNG chèn link bấm được trong caption. BẮT BUỘC thêm 3-5 hashtag ở cuối. HOOK gợi ý: Dùng nhóm "Gây tò mò / Bí mật" hoặc "Sai lầm / Cảnh báo".
- Threads: giọng trò chuyện, gần gũi, cá nhân. TỐI ĐA 500 KÝ TỰ (rất quan trọng: vượt 500 sẽ lỗi khi đăng). Thêm 1-3 hashtag. HOOK gợi ý: Dùng nhóm "Gây tò mò / Bí mật".
- Pinterest: mô tả giàu từ khóa, gợi cảm hứng lifestyle/khám phá. Thêm 3-5 hashtag. (Pinterest bắt buộc kèm ảnh/video và liên kết đích khi đăng.)
- TikTok: viết CAPTION ĐĂNG ĐƯỢC NGAY cho video (ngắn gọn, bắt trend, hook ngay câu đầu) + 2-4 hashtag. KHÔNG viết kịch bản phân cảnh. LƯU Ý: TikTok cần video đính kèm mới đăng được. HOOK gợi ý: Dùng nhóm "Gây tò mò / Bí mật" hoặc "Sai lầm / Cảnh báo".
- YouTube: viết phần MÔ TẢ (description) ĐĂNG ĐƯỢC NGAY cho video: câu mở hấp dẫn + tóm tắt giá trị nội dung + 3-5 từ khóa/hashtag. KHÔNG viết kịch bản phân cảnh. LƯU Ý: YouTube cần video đính kèm mới đăng được.
- X: ngắn gọn, súc tích (DƯỚI 280 KÝ TỰ), ưu tiên 1–2 câu chính. Thêm 2-3 hashtag. HOOK gợi ý: Dùng nhóm "Sai lầm / Cảnh báo" hoặc "Gây tò mò / Bí mật".

LƯU Ý ĐIỀU KIỆN ĐĂNG (QUAN TRỌNG): Instagram, TikTok, YouTube, Pinterest BẮT BUỘC phải đính kèm media (ảnh/video) mới đăng được — phần text bạn tạo là caption/kịch bản đi kèm media. LinkedIn, X, Threads, Facebook có thể đăng chỉ với text.

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

  return `Dựa trên nội dung của file/video/văn bản được cung cấp, hãy tạo các bài đăng theo yêu cầu sau:\n${platformInstr}\n\nHãy sáng tạo, đừng chỉ tóm tắt. Phân tích sâu nội dung để đưa ra các góc nhìn thú vị.\n${COMMON_PERSONA}\n\nYÊU CẦU NGÔN NGỮ:
- Sử dụng ngôn ngữ phù hợp với yêu cầu của người dùng (Tiếng Việt hoặc Tiếng Anh).
- Mặc định trả lời bằng ngôn ngữ người dùng đang sử dụng.
${platformGuide}`;
}

/**
 * Build instructions for Gemini model
 */
export function buildGeminiInstructions(ctx: GenerateFromSourceContext): string {
  return buildInstructions(ctx);
}

// ─────────────────────────────────────────────────────────────
// OPENAI PROMPT (for ChatGPT / gpt-4o / gpt-4.1 / o4-mini / o3)
// ─────────────────────────────────────────────────────────────

/**
 * Build instructions for OpenAI models (stricter JSON format)
 */
export function buildOpenAIInstructions(ctx: GenerateFromSourceContext): string {
  const platformInstr = buildPlatformInstructions(ctx);
  const platformGuide = `
HƯỚNG DẪN THEO NỀN TẢNG (ÁP DỤNG KHI THUỘC NỀN TẢNG TƯƠNG ỨNG):
- LinkedIn: giọng văn chuyên nghiệp nhưng vẫn gần gũi, tập trung insight & giá trị. Thêm 3-5 hashtag phù hợp ở cuối (định dạng: #tag1 #tag2 #tag3). HOOK gợi ý: Dùng nhóm "Gây tò mò / Bí mật" hoặc "Lời khuyên / Truyền cảm hứng".
- Facebook: Độ dài linh hoạt theo nhu cầu của người dùng. Phân tích chi tiết tận gốc vấn đề nếu bài dài. Dùng emoji sinh động, bắt trend, dễ hiểu. BẮT BUỘC thêm 3-5 hashtag ở cuối bài (định dạng chuẩn: #tag1 #tag2 #tag3, ngăn cách bằng dấu cách). HOOK gợi ý: Dùng nhóm "Chứng minh / Trải nghiệm" hoặc "Lời khuyên / Truyền cảm hứng".
- Instagram: dùng emoji sinh động, bắt trend, dễ hiểu. BẮT BUỘC thêm 3-5 hashtag phù hợp ở cuối bài. HOOK gợi ý: Dùng nhóm "Gây tò mò / Bí mật" hoặc "Sai lầm / Cảnh báo".
- TikTok: viết CAPTION đăng được ngay cho video (ngắn gọn, bắt trend, hook câu đầu) + 2-4 hashtag. KHÔNG viết kịch bản phân cảnh. (TikTok cần video đính kèm mới đăng được.)
- YouTube: viết phần MÔ TẢ (description) đăng được ngay cho video (câu mở hấp dẫn + tóm tắt + 3-5 từ khóa/hashtag). KHÔNG viết kịch bản phân cảnh. (YouTube cần video đính kèm mới đăng được.)
- X: ngắn gọn, súc tích (dưới 280 ký tự), ưu tiên 1–2 câu chính. Thêm 2-3 hashtag. HOOK gợi ý: Dùng nhóm "Sai lầm / Cảnh báo" hoặc "Gây tò mò / Bí mật".

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

  return `Dựa trên nội dung của file/video/văn bản được cung cấp, hãy tạo các bài đăng theo yêu cầu sau:\n${platformInstr}\n\nHãy sáng tạo, đừng chỉ tóm tắt. Phân tích sâu nội dung để đưa ra các góc nhìn thú vị.\n${COMMON_PERSONA}\n\nYÊU CẦU NGÔN NGỮ:
- Sử dụng ngôn ngữ phù hợp với yêu cầu của người dùng (Tiếng Việt hoặc Tiếng Anh).
- Mặc định trả lời bằng ngôn ngữ người dùng đang sử dụng.
${platformGuide}`;
}

/**
 * Select instructions based on model preference
 * @param modelPreference e.g. "ChatGPT", "Gemini Pro", "gpt-4.1", etc.
 */
export function selectInstructions(
  ctx: GenerateFromSourceContext,
  modelPreference: string,
): string {
  const normalized = (modelPreference || '').toLowerCase().trim();
  const isOpenAI = normalized === 'chatgpt' ||
    normalized.includes('gpt') ||
    normalized.includes('o4') ||
    normalized.includes('o3') ||
    normalized.includes('claude');

  return isOpenAI ? buildOpenAIInstructions(ctx) : buildGeminiInstructions(ctx);
}

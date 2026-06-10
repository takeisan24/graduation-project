# SPEC-CC-008: Extract AI Prompts from Store to lib Layer

> **Status**: Draft
> **Stack**: Next.js 14, React 18, TypeScript 5, Zustand, next-intl

---

## Problem

An **87-line AI prompt string** is embedded directly inside the Zustand store action in `useCreateSourcesStore.ts`. This makes the prompt:
- **Hard to maintain** — editing requires touching the store file
- **Hard to test** — can't unit-test the prompt in isolation
- **Hard to version** — no Git history for prompt changes
- **Violates separation of concerns** — AI logic mixing with state management

```typescript
// useCreateSourcesStore.ts — INSIDE store action (BAD)
async generateFromSource(...) {
  const prompt = `Bạn là một chuyên gia sáng tạo nội dung...
  Hãy phân tích nguồn sau và tạo bài viết...
  [87 lines of prompt template]
  `;
  // ... rest of action
}
```

---

## Root Cause

The prompt was written during initial development when the store was the only "logical place" for AI logic. It was never extracted because it was working — but the code is now monolithic.

---

## Solution

### Step 1: Create Prompt Templates File

**New file: `lib/ai/prompts/generate-from-source.ts`**

```typescript
// lib/ai/prompts/generate-from-source.ts
import type { SourceContent, PlatformType, AIModel, GenerationRequest } from '@/store/shared/types';

export interface PromptContext {
  source: SourceContent;
  platforms: PlatformType[];
  count: number;
  model: AIModel;
  framework: string;
  userIdea?: string;
}

export interface PromptTemplate {
  system: string;
  user: (ctx: PromptContext) => string;
  parseResponse: (raw: string) => unknown; // Returns parsed posts
}

export const PLATFORM_NAMES: Record<PlatformType, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  twitter: 'X (Twitter)',
  threads: 'Threads',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
};

export const FRAMEWORK_PROMPTS: Record<string, string> = {
  engaging: 'Sử dụng hook mạnh, câu hỏi kích thích, và call-to-action rõ ràng.',
  storytelling: 'Cấu trúc theo định dạng: Mở đầu hấp dẫn → Phát triển → Kết luận có ý nghĩa.',
  educational: 'Trình bày theo cấu trúc: Vấn đề → Giải pháp → Hướng dẫn cụ thể.',
  promotional: 'Tập trung vào lợi ích, social proof, và urgency nhẹ nhàng.',
  default: 'Ngắn gọn, dễ đọc, có emoji phù hợp cho mỗi nền tảng.',
};

function buildSourceDescription(ctx: PromptContext): string {
  switch (ctx.source.type) {
    case 'youtube':
      return `[YouTube Video] ${ctx.source.url || 'No URL'}`;
    case 'tiktok':
      return `[TikTok Video] ${ctx.source.url || 'No URL'}`;
    case 'article':
      return `[Article] ${ctx.source.url || 'No URL'}`;
    case 'file':
      return `[Uploaded File] ${ctx.source.fileName || 'Unknown file'}`;
    case 'text':
      return `[Text Content]\n${ctx.source.text || 'No content'}`;
    default:
      return '[Unknown Source]';
  }
}

export function buildSystemPrompt(framework: string): string {
  const frameworkHint = FRAMEWORK_PROMPTS[framework] || FRAMEWORK_PROMPTS.default;
  return `Bạn là một chuyên gia sáng tạo nội dung đa nền tảng cho các mạng xã hội phổ biến (TikTok, Instagram, YouTube, Facebook, X, Threads, LinkedIn, Pinterest).

## Nguyên tắc:
- Mỗi bài viết phải phù hợp với đặc điểm của nền tảng mục tiêu (độ dài, định dạng, hashtag)
- Sử dụng emoji một cách tự nhiên, không spam
- Tối ưu cho engagement nhưng giữ tính chuyên nghiệp
- Luôn bao gồm hashtag phù hợp với platform

## Framework:
${frameworkHint}

## Yêu cầu định dạng output:
Trả về JSON array với format:
[
  {
    "platform": "tiktok",
    "content": "nội dung bài viết",
    "hashtags": ["#hashtag1", "#hashtag2"]
  },
  ...
]
`;
}

export function buildUserPrompt(ctx: PromptContext): string {
  const sourceDesc = buildSourceDescription(ctx);
  const platformList = ctx.platforms.map(p => PLATFORM_NAMES[p]).join(', ');
  const countPerPlatform = ctx.count;

  let prompt = `# NGUỒN NỘI DUNG:
${sourceDesc}

## USER IDEA (nếu có):
${ctx.userIdea || '(Không có — chỉ dựa vào nguồn)'}

## YÊU CẦU:
Tạo ${countPerPlatform} bài viết cho mỗi nền tảng:
- Nền tảng: ${platformList}
- Số bài/nền tảng: ${countPerPlatform}

## Output format:
Trả về JSON array với format:
[
  {
    "platform": "tiktok",
    "content": "...",
    "hashtags": ["#..."]
  },
  {
    "platform": "instagram",
    "content": "...",
    "hashtags": ["#..."]
  },
  ...
]

Lưu ý:
- TikTok: ngắn gọn, hook trong 3 giây đầu, có thể kèm caption dài
- Instagram: caption dưới 2200 ký tự, line breaks rõ ràng
- YouTube: mô tả video, có thể kèm timestamp
- Facebook: dài hơn, có thể share story
- Twitter/X: ngắn (280 char), hook mạnh
- LinkedIn: professional tone, dài hơn, có CTA
- Threads: casual, ngắn
- Pinterest: description dài, keyword-rich

Chỉ trả về JSON array, không có text giải thích khác.`;

  return prompt;
}

export function parseAIResponse(raw: string): Array<{ platform: PlatformType; content: string; hashtags: string[] }> {
  // Try to extract JSON from the response
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('AI response does not contain valid JSON array');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      throw new Error('AI response is not an array');
    }
    return parsed;
  } catch (e) {
    throw new Error(`Failed to parse AI response: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}
```

### Step 2: Refactor Store to Use Prompt Library

```typescript
// useCreateSourcesStore.ts — BEFORE:
async generateFromSource(source, platforms, count, model) {
  const prompt = `Bạn là chuyên gia sáng tạo nội dung...
  [87 lines]
  `;
  const response = await callGemini({ prompt });
  // ...
}

// useCreateSourcesStore.ts — AFTER:
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseAIResponse,
  type PromptContext,
} from '@/lib/ai/prompts/generate-from-source';

async generateFromSource(source, platforms, count, model) {
  const ctx: PromptContext = { source, platforms, count, model, framework, userIdea };
  const systemPrompt = buildSystemPrompt(framework);
  const userPrompt = buildUserPrompt(ctx);
  const rawResponse = await callGemini({ system: systemPrompt, user: userPrompt });
  const posts = parseAIResponse(rawResponse);
  // ...
}
```

### Step 3: Keep Store Action Under 200 Lines

After extraction, the `generateFromSource` action should be:
- Line 1–20: Import + type the context
- Line 21–40: Build prompts using lib
- Line 41–60: Call AI API
- Line 61–100: Parse response
- Line 101–150: Transform to PostContent
- Line 151–180: Store update + error handling

**Total action: ~180 lines** (currently ~200+ with inline prompt)

---

## Files to Change

### New Files:
- `lib/ai/prompts/generate-from-source.ts` — Prompt builders + parsers

### Existing Files:
- `store/useCreateSourcesStore.ts` — Import from lib, remove inline prompt

---

## New Files

- `lib/ai/prompts/generate-from-source.ts`
- *(Optional)* `lib/ai/prompts/` directory structure for future prompt templates

---

## Acceptance Criteria

- [ ] `lib/ai/prompts/generate-from-source.ts` contains all AI prompt logic
- [ ] `generateFromSource` action in store is under **200 lines**
- [ ] Prompt strings are **not** in any store file
- [ ] `parseAIResponse` handles invalid JSON gracefully with typed errors
- [ ] `buildSystemPrompt` and `buildUserPrompt` are unit-testable in isolation
- [ ] `tsc --noEmit` passes with no errors
- [ ] Existing generate flow still works (manual test)

---

## Rollback Plan

1. Revert `useCreateSourcesStore.ts` to pre-spec commit (restore inline prompt)
2. Delete `lib/ai/prompts/generate-from-source.ts`
3. Test that `generateFromSource` still works via Playwright/manual test

---

## Cross-Feature Notes

- Consider creating `lib/ai/prompts/format-post.ts` for the Format AI feature
- Consider creating `lib/ai/prompts/translate-post.ts` for the Translate AI feature
- Each prompt file can have its own unit tests
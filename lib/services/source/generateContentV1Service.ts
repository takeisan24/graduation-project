
import { aiManager } from "@/lib/ai/providers/manager";
import { deductCredits, CREDIT_COSTS } from "@/lib/usage";
import { withApiProtection } from "@/lib/middleware/api-protected";
import { NextRequest } from "next/server";
import { supabaseClient } from "@/lib/supabaseClient";
import { getMonthStartDate, DEFAULT_TIMEZONE } from "@/lib/utils/date";
import { MASTER_SYSTEM_PROMPT } from "@/lib/prompts/index";

// Interface Input
export interface GenerateRequest {
    final_prompt: string;
    framework_id?: string;
    niche_id?: string;
    goal_id?: string;
    user_inputs?: Record<string, string>;
    custom_request?: string;
    modelPreference?: string;
    platforms?: string[];
    locale?: string;
}

// Interface Output
export interface GenerateResult {
    response: string;
    platforms: string[];
    creditsRemaining: number;
    message?: string;
}

export async function generateContent(
    req: NextRequest,
    request: GenerateRequest
): Promise<GenerateResult | { error: string; status: number }> {

    // ---------------------------------------------------------
    // 1. SETUP & VALIDATION
    // ---------------------------------------------------------
    const { final_prompt: original_prompt,
        framework_id, niche_id, goal_id, user_inputs, custom_request,
        modelPreference,
        platforms = ['facebook'],
        locale
    } = request;

    // Append Locale Instruction
    let final_prompt = original_prompt;
    if (locale && locale !== 'en') {
        const languageName = locale === 'vi' ? 'Vietnamese' : locale;
        final_prompt += `\n\nIMPORTANT: The output content MUST be written in ${languageName} language.`;
    }

    // Validate platforms
    const platformList = Array.isArray(platforms) && platforms.length > 0
        ? platforms.filter(p => typeof p === 'string' && p.trim().length > 0)
            .map(p => normalizePlatform(p))
        : ['Facebook'];

    // Determine model
    const clientModelKey = (modelPreference || '').toLowerCase().trim();
    const openaiEnvModel = process.env.OPENAI_MODEL || 'gpt-5-mini';
    const isChatGPT = clientModelKey === 'chatgpt';
    const modelToUse = isChatGPT ? openaiEnvModel : "gemini-2.5-flash";

    // ---------------------------------------------------------
    // 2. CHECK CREDITS & PROTECTION (AUTH)
    // ---------------------------------------------------------
    const protection = await withApiProtection(req, 'TEXT_ONLY', {
        returnError: true,
        skipDeduct: true, // Check trước, trừ sau khi thành công
        count: platformList.length,
        metadata: {
            model: modelToUse,
            sourceType: 'generated_content',
            platforms: platformList.join(',')
        }
    });

    if ('error' in protection) {
        return { error: "Unauthorized or insufficient credits", status: 401 };
    }

    const { user, paywallResult } = protection;

    // Check balance
    const totalCreditsNeeded = CREDIT_COSTS.TEXT_ONLY * platformList.length;
    if (!paywallResult.allowed || (paywallResult.creditsRemaining !== undefined && paywallResult.creditsRemaining < totalCreditsNeeded)) {
        return {
            error: JSON.stringify({
                message: `Insufficient credits. Need ${totalCreditsNeeded} credits (${platformList.length} platforms) but only have ${paywallResult.creditsRemaining ?? 0}`,
                upgradeRequired: paywallResult.upgradeRequired ?? true,
                creditsRequired: totalCreditsNeeded,
                creditsRemaining: paywallResult.creditsRemaining ?? 0,
                platformsCount: platformList.length
            }),
            status: 403
        };
    }

    // ---------------------------------------------------------
    // 4. GỌI AI GENERATION
    // ---------------------------------------------------------
    let aiResponse: string;
    try {
        if (isChatGPT) {
            const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
            messages.push({ role: 'system', content: MASTER_SYSTEM_PROMPT });
            messages.push({ role: 'user', content: final_prompt });
            aiResponse = await aiManager.generateText({
                modelId: modelToUse,
                messages: messages,
                maxTokens: 5000,
            });
        } else {
            // Gemini
            const gemini = aiManager.getProvider('gemini');
            aiResponse = await gemini.generateContentFromParts({
                model: modelToUse,
                systemInstruction: MASTER_SYSTEM_PROMPT,
                promptParts: [final_prompt]
            });
        }
    } catch (aiError: unknown) {
        const aiErrorMessage = aiError instanceof Error ? aiError.message : "Unknown AI error";
        console.error("[GenerateContent] AI Error:", aiError);
        return {
            error: JSON.stringify({ message: "Content generation failed: " + aiErrorMessage, details: aiErrorMessage }),
            status: 500
        };
    }

    let finalResponse = aiResponse;

    // Kiểm tra xem AI có trả về JSON không
    // (Check đơn giản: có chứa chuỗi ```json hoặc bắt đầu bằng [ )
    const hasJson = finalResponse.includes('```json') || finalResponse.trim().startsWith('[');

    if (!hasJson) {
        // Nếu AI trả về text thường (như bài PAS của bạn), BE sẽ tự đóng gói lại thành JSON
        const wrappedContent = [
            {
                "action": "create_post",
                "platform": platformList[0] || "General", // Lấy platform đầu tiên user chọn
                "content": aiResponse, // Nhét toàn bộ nội dung text vào đây
                "summary_for_chat": "Nội dung tạo từ Framework"
            }
        ];

        // Format lại thành chuỗi JSON string y hệt như Frontend mong đợi
        finalResponse = "```json\n" + JSON.stringify(wrappedContent, null, 2) + "\n```";
    }

    // ---------------------------------------------------------
    // 5. TRỪ CREDITS & GHI LOG USAGE (SAU KHI THÀNH CÔNG)
    // ---------------------------------------------------------
    let latestCreditsRemaining = paywallResult.creditsRemaining ?? 0;

    // Deduct credits cho từng platform
    for (let i = 0; i < platformList.length; i++) {
        const platform = platformList[i];
        const creditResult = await deductCredits(user.id, 'TEXT_ONLY', {
            model: modelToUse,
            sourceType: 'generated_content',
            platform,
            platforms: platformList.join(','),
            postIndex: i + 1,
            totalPlatforms: platformList.length
        }, { response: aiResponse });

        if (creditResult.success) {
            latestCreditsRemaining = creditResult.creditsLeft ?? latestCreditsRemaining;
        }
    }

    // Increment Usage (posts_created)
    try {
        const month = getMonthStartDate(DEFAULT_TIMEZONE);
        await supabaseClient.rpc('increment_usage', {
            p_user_id: user.id,
            p_month: month,
            p_field: 'posts_created',
            p_amount: platformList.length
        });
    } catch (usageErr) {
        console.warn('[GenerateContent] increment_usage error:', usageErr);
    }

    // ---------------------------------------------------------
    // [NEW] 7. LƯU LỊCH SỬ (HISTORY LOGGING)
    // ---------------------------------------------------------

    try {
        await supabaseClient.from('content_history').insert({
            user_id: user.id,
            framework_id: framework_id || null,
            niche_id: niche_id || null,
            goal_id: goal_id || null,
            user_inputs: user_inputs
                ? user_inputs
                : (custom_request ? { custom_request: custom_request } : null),
            final_compiled_prompt: final_prompt,
            ai_response_raw: aiResponse,
            ai_response_json: finalResponse || null,

            platforms: platformList,
            model_used: modelToUse,
        });
    } catch (logError) {
        // Không block luồng chính nếu lưu log lỗi, chỉ console.warn
        console.warn("[HistoryLog] Failed to save history:", logError);
    }
    // ---------------------------------------------------------
    // 6. TRẢ KẾT QUẢ
    // ---------------------------------------------------------
    return {
        response: finalResponse,
        platforms: platformList,
        creditsRemaining: latestCreditsRemaining,
        message: `Generated content successfully`
    };
}

const normalizePlatform = (aiPlatformValue: string) => {
    const key = aiPlatformValue.toLowerCase().trim();
    if (key === 'facebook') return 'Facebook';
    if (key === 'tiktok') return 'TikTok';
    if (key === 'instagram') return 'Instagram';
    if (key === 'twitter' || key === 'x') return 'X';
    if (key === 'linkedin') return 'LinkedIn';
    if (key === 'pinterest') return 'pinterest';
    if (key === 'threads') return 'Threads';
    if (key === 'youtube') return 'YouTube';

    return aiPlatformValue;
};

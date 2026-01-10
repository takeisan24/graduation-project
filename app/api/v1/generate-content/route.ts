import { NextRequest, NextResponse } from "next/server";
import { generateContent } from "@/lib/services/source/generateContentV1Service";
import { success, fail } from '@/lib/response';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        // 1. Parse & Destructure Body
        const body = await request.json();
        const {
            final_prompt,
            framework_id,
            niche_id,
            goal_id,
            user_inputs,
            custom_request,
            modelPreference,
            platforms = ['facebook'],
            locale
        } = body as {
            final_prompt: string;
            framework_id?: string;
            niche_id?: string;
            goal_id?: string;
            user_inputs?: Record<string, string>;
            custom_request?: string;
            modelPreference?: string;
            platforms?: string[];
            locale?: string;
        };

        // 3. Call Service
        // Truyền request (để check auth) và data đã lọc
        const result = await generateContent(request, {
            final_prompt,
            framework_id,
            niche_id,
            goal_id,
            user_inputs,
            custom_request,
            modelPreference,
            platforms,
            locale
        });

        // 4. Handle Service Error
        if ('error' in result) {
            return fail(result.error, result.status);
        }

        // 5. Success Response
        return success({
            response: result.response,
            platforms: result.platforms,
            creditsRemaining: result.creditsRemaining,
            message: result.message
        });

    } catch (error: any) {
        console.error("[API_GENERATE_CONTENT_ERROR]", error);
        return fail(error.message || 'Internal Server Error', 500);
    }
}
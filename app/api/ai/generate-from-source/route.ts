/**
 * POST /api/ai/generate-from-source
 * Generate content from multimodal inputs (text + images) using AI
 */
import { NextRequest } from 'next/server';
import { Part } from '@google/generative-ai';
import { success, fail } from '@/lib/response';
import { withAuthOnly } from '@/lib/middleware/api-protected';
import { generateFromSourceWithCredits } from '@/lib/services/ai/multimodalGenerationService';

export async function POST(request: NextRequest) {
    try {
        // Auth check at route level (credits handled in service)
        const auth = await withAuthOnly(request);
        if ("error" in auth) return auth.error;

        // Parse request body
        const body = await request.json();
        const { promptParts, modelPreference, platforms = ['facebook'] } = body as {
            promptParts: (string | Part)[],
            modelPreference?: string,
            platforms?: string[]
        };

        // Generate content via service layer
        const result = await generateFromSourceWithCredits(request, {
            promptParts,
            modelPreference,
            platforms
        });

        // Handle error response
        if ('error' in result) {
            return fail(result.error, result.status);
        }

        // Return success response
        return success({
            response: result.response,
            platforms: result.platforms,
            creditsRemaining: result.creditsRemaining,
            extractedContent: result.extractedContent // Trả về extracted content cho FE (nếu có)
        });

    } catch (error) {
        console.error("[API_GENERATE_SOURCE_ERROR]", error);
        return fail('Internal Server Error', 500);
    }
}



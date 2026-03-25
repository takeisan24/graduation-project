import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { getModelsByType, isModelAvailable, AIProvider } from "@/lib/ai/providers";
import { getContentGenerationConfig, getAssistantConfig, validateModelAvailability } from "@/lib/ai/config";

/**
 * GET /api/ai/models
 * Get available AI models and configurations
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as 'text' | 'image' | 'video' | 'extraction' | null;
    const provider = searchParams.get('provider') as 'openai' | 'gemini' | 'fal' | 'anthropic' | null;
    const providerParam: AIProvider | undefined = provider === null ? undefined : provider;

    // Get available models
    const textModels = getModelsByType('text', providerParam);
    const imageModels = getModelsByType('image', providerParam);
    const videoModels = getModelsByType('video', providerParam);
    const extractionModels = getModelsByType('extraction', providerParam);

    // Filter by type if specified
    type ModelsByCategory = {
      text: ReturnType<typeof getModelsByType>;
      image: ReturnType<typeof getModelsByType>;
      video: ReturnType<typeof getModelsByType>;
      extraction: ReturnType<typeof getModelsByType>;
    };
    const models: ReturnType<typeof getModelsByType> | ModelsByCategory = type
        ? getModelsByType(type, providerParam)
        : {
          text: textModels,
          image: imageModels,
          video: videoModels,
          extraction: extractionModels,
        };

    // Get configurations
    const contentConfig = getContentGenerationConfig();
    const assistantConfig = getAssistantConfig();
    const validation = validateModelAvailability();

    return success({
      models: type ? models : {
        text: textModels,
        image: imageModels,
        video: videoModels,
        extraction: extractionModels
      },
      configurations: {
        contentGeneration: contentConfig,
        assistant: assistantConfig
      },
      validation,
      available: validation.available
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("GET /api/ai/models error:", message);
    return fail(message, 500);
  }
}

/**
 * POST /api/ai/models/test
 * Test a specific model
 */
export async function POST(req: NextRequest) {
  // Endpoint disabled for production security
  return fail("Test endpoint disabled", 404);

  /* ORIGINAL TEST LOGIC - UNCOMMENT TO ENABLE
  try {
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    const { modelId, testType = 'text' } = await req.json();
    
    if (!modelId) return fail("modelId is required", 400);

    // Check if model is available
    if (!isModelAvailable(modelId)) {
      return fail("Model not available or API key missing", 400);
    }

    // Test the model with a simple request
    const { aiManager } = await import("@/lib/ai/providers/manager");
    
    let result;
    if (testType === 'text') {
      result = await aiManager.generateText({
        modelId,
        messages: [{ role: 'user', content: 'Hello, this is a test message.' }],
        maxTokens: 10000
      });
    } else if (testType === 'image') {
      result = await aiManager.generateImage({
        modelId,
        prompt: 'A simple test image'
      });
    } else if (testType === 'video') {
      result = await aiManager.generateVideo({
        modelId,
        prompt: 'A simple test video'
      });
    } else {
      return fail("Invalid test type", 400);
    }

    return success({
      modelId,
      testType,
      result: typeof result === 'string' ? result : 'Test completed successfully',
      available: true
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Model test failed";
    console.error("POST /api/ai/models/test error:", message);
    return fail(message, 500);
  }
  */
}

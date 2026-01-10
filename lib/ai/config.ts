/**
 * AI Configuration
 * Centralized configuration for AI models and providers
 */

import { getModelsByType, isModelAvailable, getModelConfig } from './providers/index';

/**
 * Default model configuration for different use cases
 */
export const DEFAULT_MODELS = {
  // Text generation
  text: {
    primary: 'gemini-2.5-flash',
    fallback: 'gemini-2.5-flash',
  },

  // Content extraction
  extraction: {
    primary: 'gemini-2.5-flash',
    fallback: 'gemini-2.5-flash',
  },

  // Image generation — only gemini-3-pro renders text well, retry same model with key rotation
  image: {
    primary: 'gemini-3-pro-image-preview',
    fallback: 'gemini-3-pro-image-preview',
  },

  // Video generation
  video: {
    primary: 'veo-3.0-generate-001',
    fallback: 'veo-3.0-generate-001',
  }
};

/**
 * Get the best available model for a specific use case
 */
export function getBestModel(useCase: keyof typeof DEFAULT_MODELS, tier: 'primary' | 'fallback' = 'primary'): string {
  const modelId = DEFAULT_MODELS[useCase][tier];

  if (isModelAvailable(modelId)) {
    return modelId;
  }

  // Try fallback
  const fallbackTier = tier === 'primary' ? 'fallback' : 'primary';
  const fallbackModel = DEFAULT_MODELS[useCase][fallbackTier];
  if (isModelAvailable(fallbackModel)) {
    return fallbackModel;
  }

  // Provider preference per use case (forces Gemini-first for text/extraction)
  const providerPreference: Record<keyof typeof DEFAULT_MODELS, Array<'gemini' | 'fal' | 'openai' | 'anthropic'>> = {
    text: ['gemini', 'openai', 'anthropic'],
    extraction: ['gemini', 'openai'],
    image: ['gemini','fal', 'openai'],
    video: ['gemini', 'fal']
  };

  // Choose first available model matching preferred providers
  const candidates = getModelsByType(useCase);
  for (const provider of providerPreference[useCase]) {
    const match = candidates.find(m => m.provider === provider && isModelAvailable(m.id));
    if (match) return match.id;
  }

  // If none are available for preferred providers, surface a clear error
  const missingProviders = providerPreference[useCase].join(', ');
  throw new Error(`No available models for ${useCase}. Missing API key(s) for preferred providers: ${missingProviders}`);
}

/**
 * Get model configuration for content generation
 */
export function getContentGenerationConfig() {
  return {
    textModel: getBestModel('text'),
    imageModel: getBestModel('image'),
    videoModel: getBestModel('video'),
    extractionModel: getBestModel('extraction')
  };
}

/**
 * Get model configuration for AI assistant
 */
export function getAssistantConfig() {
  return {
    chatModel: getBestModel('text'),
    analysisModel: getBestModel('text')
  };
}

/**
 * Check if all required models are available
 */
export function validateModelAvailability(): { available: boolean; missing: string[] } {
  const missing: string[] = [];
  
  try {
    getBestModel('text');
  } catch {
    missing.push('text');
  }
  
  try {
    getBestModel('image');
  } catch {
    missing.push('image');
  }
  
  try {
    getBestModel('video');
  } catch {
    missing.push('video');
  }
  
  try {
    getBestModel('extraction');
  } catch {
    missing.push('extraction');
  }
  
  return {
    available: missing.length === 0,
    missing
  };
}

/**
 * Get cost-effective model configuration
 */
export function getCostEffectiveConfig() {
  return {
    textModel: getBestModel('text', 'primary'),
    imageModel: getBestModel('image', 'fallback'),
    videoModel: getBestModel('video', 'fallback'),
    extractionModel: getBestModel('extraction', 'primary')
  };
}


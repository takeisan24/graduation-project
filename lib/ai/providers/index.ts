/**
 * AI Providers Configuration
 * Centralized configuration for different AI providers and models
 */

export type AIProvider = 'openai' | 'gemini' | 'anthropic';

export type ModelType = 'text' | 'image' | 'video' | 'extraction';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  type: ModelType;
  maxTokens?: number;
  costPerToken?: number;
  capabilities: string[];
}

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

/**
 * Model ID constants to avoid hardcoded strings across the codebase
 */
export const MODEL_IDS = {
  GEMINI_3_PRO_IMAGE: 'gemini-3-pro-image-preview',
  GEMINI_25_FLASH_IMAGE: 'gemini-2.5-flash-image',
} as const;

/**
 * Available AI Models Configuration
 */
export const AI_MODELS: Record<string, AIModel> = {
  // OpenAI Models
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    type: 'text',
    maxTokens: 128000,
    capabilities: ['text-generation', 'content-extraction', 'chat', 'reasoning']
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4 Omni',
    provider: 'openai',
    type: 'text',
    maxTokens: 128000,
    capabilities: ['text-generation', 'content-extraction', 'chat', 'reasoning']
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4 Omni Mini',
    provider: 'openai',
    type: 'text',
    maxTokens: 128000,
    capabilities: ['text-generation', 'content-extraction', 'chat', 'reasoning']
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    type: 'text',
    maxTokens: 16384,
    capabilities: ['text-generation', 'content-extraction', 'chat']
  },
  'dall-e-3': {
    id: 'dall-e-3',
    name: 'DALL-E 3',
    provider: 'openai',
    type: 'image',
    capabilities: ['image-generation', 'high-quality', 'artistic']
  },
  'dall-e-2': {
    id: 'dall-e-2',
    name: 'DALL-E 2',
    provider: 'openai',
    type: 'image',
    capabilities: ['image-generation', 'fast', 'cost-effective']
  },

  // Google Gemini Models
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    type: 'text',
    maxTokens: 1000000,
    capabilities: ['text-generation', 'content-extraction', 'multimodal', 'reasoning']
  },
  'gemini-2.0-flash-exp': {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash Experimental',
    provider: 'gemini',
    type: 'text',
    maxTokens: 1000000,
    capabilities: ['text-generation', 'content-extraction', 'multimodal', 'reasoning']
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    type: 'text',
    maxTokens: 2000000,
    capabilities: ['text-generation', 'content-extraction', 'multimodal', 'long-context']
  },
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    type: 'text',
    maxTokens: 1000000,
    capabilities: ['text-generation', 'content-extraction', 'fast', 'cost-effective']
  },

  // Gemini Image Models
  'gemini-3-pro-image-preview': {
    id: 'gemini-3-pro-image-preview',
    name: 'Gemini 3 Pro Image',
    provider: 'gemini',
    type: 'image',
    capabilities: ['image-generation', 'multimodal', 'high-quality', 'text-rendering']
  },

  // Gemini Video Models
  'veo-3.0-fast-generate-001': {
    id: 'veo-3.0-fast-generate-001',
    name: 'Veo 3.0 Fast',
    provider: 'gemini',
    type: 'video',
    capabilities: ['video-generation', 'fast', 'realistic']
  },
  'veo-3.0-generate-001': {
    id: 'veo-3.0-generate-001',
    name: 'Veo 3.0',
    provider: 'gemini',
    type: 'video',
    capabilities: ['video-generation', 'high-quality', 'realistic']
  },

};

/**
 * Provider-specific configurations
 * 
 * NOTE: These are loaded from environment variables at module initialization.
 * If you change .env.local, you MUST restart the Next.js dev server for changes to take effect.
 */
export const PROVIDER_CONFIGS: Record<AIProvider, AIProviderConfig> = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: 'https://api.openai.com/v1',
    timeout: 30000,
    retries: 3
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    timeout: 30000,
    retries: 3
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    baseUrl: 'https://api.anthropic.com/v1',
    timeout: 30000,
    retries: 3
  }
};


/**
 * Get model configuration by ID
 */
export function getModelConfig(modelId: string): AIModel | null {
  return AI_MODELS[modelId] || null;
}

/**
 * Get provider configuration
 */
export function getProviderConfig(provider: AIProvider): AIProviderConfig | null {
  return PROVIDER_CONFIGS[provider] || null;
}

/**
 * Get available models by type and provider
 */
export function getModelsByType(type: ModelType, provider?: AIProvider): AIModel[] {
  return Object.values(AI_MODELS).filter(model => {
    if (provider && model.provider !== provider) return false;
    return model.type === type;
  });
}

/**
 * Get default model for a specific use case
 */
export function getDefaultModel(type: ModelType, provider?: AIProvider): string {
  const models = getModelsByType(type, provider);
  
  if (models.length === 0) {
    throw new Error(`No models available for type: ${type}${provider ? ` and provider: ${provider}` : ''}`);
  }

  // Return the first available model (can be customized based on preferences)
  return models[0].id;
}

/**
 * Check if a model is available (has API key)
 */
export function isModelAvailable(modelId: string): boolean {
  const model = getModelConfig(modelId);
  if (!model) return false;
  
  const providerConfig = getProviderConfig(model.provider);
  return !!(providerConfig && providerConfig.apiKey);
}

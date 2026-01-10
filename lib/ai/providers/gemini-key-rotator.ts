/**
 * Gemini API Key Rotator
 *
 * Round-robin rotation of multiple Gemini API keys for media generation (image + video).
 * Prevents rate-limiting by distributing requests across multiple keys.
 *
 * - GEMINI_API_KEY: Default key for text generation, extraction, chat
 * - GEMINI_API_KEYS: Comma-separated keys for image + video generation (round-robin)
 */

interface KeyState {
  key: string;
  rateLimitedUntil: number; // timestamp when cooldown expires (0 = available)
}

class GeminiKeyRotator {
  private keys: KeyState[] = [];
  private currentIndex: number = 0;
  private readonly COOLDOWN_MS = 60_000; // 60 seconds cooldown for rate-limited keys

  constructor() {
    this.loadKeys();
  }

  /**
   * Load keys from environment variables
   * GEMINI_API_KEYS takes priority; falls back to GEMINI_API_KEY
   */
  private loadKeys() {
    const mediaKeysEnv = process.env.GEMINI_API_KEYS || '';
    const defaultKey = process.env.GEMINI_API_KEY || '';

    if (mediaKeysEnv) {
      const keys = mediaKeysEnv
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (keys.length > 0) {
        this.keys = keys.map(key => ({ key, rateLimitedUntil: 0 }));
        console.log(`[GeminiKeyRotator] Loaded ${this.keys.length} media API keys for rotation`);
        return;
      }
    }

    // Fallback: use default key
    if (defaultKey) {
      this.keys = [{ key: defaultKey, rateLimitedUntil: 0 }];
      console.log(`[GeminiKeyRotator] No GEMINI_API_KEYS found, using GEMINI_API_KEY as single media key`);
    } else {
      this.keys = [];
      console.warn(`[GeminiKeyRotator] No API keys available for media generation`);
    }
  }

  /**
   * Get the next available API key (round-robin with rate-limit awareness)
   * Skips keys that are currently in cooldown.
   */
  getNextKey(): string {
    if (this.keys.length === 0) {
      throw new Error('[GeminiKeyRotator] No API keys configured for media generation');
    }

    const now = Date.now();
    const totalKeys = this.keys.length;

    // Try each key starting from currentIndex
    for (let i = 0; i < totalKeys; i++) {
      const index = (this.currentIndex + i) % totalKeys;
      const keyState = this.keys[index];

      if (keyState.rateLimitedUntil <= now) {
        // Key is available
        this.currentIndex = (index + 1) % totalKeys; // Advance for next call
        const masked = this.maskKey(keyState.key);
        console.log(`[GeminiKeyRotator] Using key ${index + 1}/${totalKeys}: ${masked}`);
        return keyState.key;
      }
    }

    // All keys are rate-limited; use the one with earliest cooldown expiry
    const earliest = this.keys.reduce((min, k) =>
      k.rateLimitedUntil < min.rateLimitedUntil ? k : min
    );
    const waitMs = earliest.rateLimitedUntil - now;
    console.warn(`[GeminiKeyRotator] All ${totalKeys} keys rate-limited. Using least-limited key (cooldown: ${waitMs}ms remaining)`);
    return earliest.key;
  }

  /**
   * Mark a key as rate-limited (429 response)
   * The key will be skipped for COOLDOWN_MS milliseconds.
   */
  markRateLimited(apiKey: string) {
    const keyState = this.keys.find(k => k.key === apiKey);
    if (keyState) {
      keyState.rateLimitedUntil = Date.now() + this.COOLDOWN_MS;
      const masked = this.maskKey(apiKey);
      console.warn(`[GeminiKeyRotator] Key ${masked} marked as rate-limited for ${this.COOLDOWN_MS / 1000}s`);
    }
  }

  /**
   * Check if a specific key is currently rate-limited
   */
  isRateLimited(apiKey: string): boolean {
    const keyState = this.keys.find(k => k.key === apiKey);
    return keyState ? keyState.rateLimitedUntil > Date.now() : false;
  }

  /**
   * Get total number of configured keys
   */
  getKeyCount(): number {
    return this.keys.length;
  }

  /**
   * Get number of currently available (non-rate-limited) keys
   */
  getAvailableKeyCount(): number {
    const now = Date.now();
    return this.keys.filter(k => k.rateLimitedUntil <= now).length;
  }

  private maskKey(key: string): string {
    if (!key || key.length < 10) return '***';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }
}

// Singleton instance
export const geminiKeyRotator = new GeminiKeyRotator();

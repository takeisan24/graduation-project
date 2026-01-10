import crypto from 'crypto';

/**
 * LemonSqueezy webhook signature verification
 * Verifies the HMAC signature from LemonSqueezy webhooks
 */
export function verifyLemonSqueezySignature(headers: Headers, bodyText: string): boolean {
  const signature = headers.get('x-signature');
  if (!signature) return false;

  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('LEMONSQUEEZY_WEBHOOK_SECRET not configured');
    return true; // Allow in development
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(bodyText);
  const digest = hmac.digest('hex');

  return crypto.timingSafeEqual(
    //Fix by GithubCopilot
    new Uint8Array(Buffer.from(signature, 'hex')),
    new Uint8Array(Buffer.from(digest, 'hex'))
  );
}

/**
 * LemonSqueezy API client
 * Handles checkout creation and subscription management
 */
export const lemonClient = {
  /**
   * Create a checkout session for subscription
   */
  async createCheckout({
    planId,
    email,
    userId
  }: {
    planId: string;
    email: string;
    userId: string;
  }): Promise<{ url: string; checkoutId: string }> {
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!apiKey) {
      throw new Error('LEMONSQUEEZY_API_KEY not configured');
    }

    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    if (!storeId) {
      throw new Error('LEMONSQUEEZY_STORE_ID not configured');
    }

    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json'
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email: email,
              custom: {
                user_id: userId
              }
            }
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: storeId
              }
            },
            variant: {
              data: {
                type: 'variants',
                id: planId
              }
            }
          }
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('LemonSqueezy API error:', error);
      throw new Error(`LemonSqueezy API error: ${error}`);
    }

    const data = await response.json();

    if (!data.data || !data.data.attributes || !data.data.attributes.url) {
      throw new Error('Invalid response from LemonSqueezy API');
    }

    return {
      url: data.data.attributes.url,
      checkoutId: data.data.id
    };
  },

  /**
   * Create a checkout session for credit top-up
   */
  async createTopUpCheckout({
    creditPackage,
    email,
    userId
  }: {
    creditPackage: string;
    email: string;
    userId: string;
  }): Promise<{ url: string; checkoutId: string }> {
    // Map credit packages to LemonSqueezy variant IDs
    const packageMap: Record<string, string> = {
      '50_credits': process.env.LEMONSQUEEZY_50_CREDITS_VARIANT_ID || '',
      '150_credits': process.env.LEMONSQUEEZY_150_CREDITS_VARIANT_ID || '',
      '350_credits': process.env.LEMONSQUEEZY_350_CREDITS_VARIANT_ID || ''
    };

    const variantId = packageMap[creditPackage];
    if (!variantId) {
      throw new Error(`Invalid credit package: ${creditPackage}`);
    }

    return this.createCheckout({
      planId: variantId,
      email,
      userId
    });
  },

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string) {
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!apiKey) {
      throw new Error('LEMONSQUEEZY_API_KEY not configured');
    }

    const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/vnd.api+json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LemonSqueezy API error: ${error}`);
    }

    return response.json();
  },

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string) {
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!apiKey) {
      throw new Error('LEMONSQUEEZY_API_KEY not configured');
    }

    const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json'
      },
      body: JSON.stringify({
        data: {
          type: 'subscriptions',
          id: subscriptionId,
          attributes: {
            cancelled: true
          }
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LemonSqueezy API error: ${error}`);
    }

    return response.json();
  }
};

/**
 * Plan configuration mapping
 */
export const PLAN_CONFIG = {
  free: {
    name: 'Free',
    price: 0,
    credits: 10,
    profiles: 3,
    posts: 10,
    storage: 1, // 1 GB
    features: ['basic_ai']
  },
  creator: {
    name: 'Creator',
    price: 29,
    credits: 200,
    profiles: 10,
    posts: -1, // unlimited
    storage: 10, // 10 GB
    features: ['ai_content', 'ai_refinement', 'branding']
  },
  creator_pro: {
    name: 'Creator Pro',
    price: 49,
    credits: 450,
    profiles: 20,
    posts: -1, // unlimited
    storage: 50, // 50 GB
    features: ['ai_content', 'ai_refinement', 'branding', 'team_members']
  },
  agency: {
    name: 'Agency',
    price: 99,
    credits: 1000,
    profiles: -1, // unlimited
    posts: -1, // unlimited
    storage: 100, // 100 GB
    features: ['ai_content', 'ai_refinement', 'branding', 'team_members', 'priority_support']
  }
} as const;

/**
 * Credit package configuration
 */
export const CREDIT_PACKAGES = {
  '50_credits': {
    name: 'Gói Thử nghiệm',
    credits: 50,
    price: 10
  },
  '150_credits': {
    name: 'Gói Sáng tạo',
    credits: 150,
    price: 25
  },
  '350_credits': {
    name: 'Gói Chuyên nghiệp',
    credits: 350,
    price: 50
  }
} as const;

// Using built-in fetch in Node.js 18+

const LATE_API_URL = process.env.LATE_API_URL || "https://getlate.dev/api/v1";
// Domain auth.getlate.dev does not exist (DNS verified)
// NOTE: /api/v1/oauth/token might also return 404
// Try /oauth/token (without /api/v1) first
// Use environment variable if available, otherwise try /oauth/token
const LATE_OAUTH_TOKEN_URL = process.env.LATE_OAUTH_TOKEN_URL || "https://getlate.dev/oauth/token";

export class LateClient {
  apiKey: string;
  clientId?: string;
  clientSecret?: string;
  
  constructor(apiKey?: string, clientId?: string, clientSecret?: string) { 
    this.apiKey = apiKey || process.env.LATE_API_KEY!;
    this.clientId = clientId || process.env.LATE_CLIENT_ID;
    this.clientSecret = clientSecret || process.env.LATE_CLIENT_SECRET;
  }

  // Exchange authorization code -> token
  async exchangeCodeForToken(code: string, redirect_uri: string) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("Client ID and Client Secret are required for token exchange");
    }
    const res = await fetch(LATE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri
      })
    });
    if (!res.ok) throw new Error(`Late token exchange failed: ${await res.text()}`);
    return res.json(); // { access_token, refresh_token, expires_in, scope, token_type }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - The refresh token from previous OAuth flow
   * @returns New token response with access_token, refresh_token, expires_in
   */
  async refreshAccessToken(refreshToken: string) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("Client ID and Client Secret are required for token refresh");
    }
    const res = await fetch(LATE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken
      })
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Late token refresh failed: ${errorText}`);
    }
    return res.json(); // { access_token, refresh_token, expires_in, scope, token_type }
  }

  // Create profile resource under our Late account using user's provider access token
  async createProfileWithAccessToken(accessToken: string, platform?: string, retries = 3) {
    let lastError: Error | null = null;
    
    // Retry with exponential backoff
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(`${LATE_API_URL}/profiles`, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ 
            access_token: accessToken,
            platform: platform || "instagram" // default platform
          })
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          lastError = new Error(`Late createProfile failed: ${errorText}`);
          
          // Don't retry on 4xx errors (client errors)
          if (res.status >= 400 && res.status < 500) {
            throw lastError;
          }
          
          // Retry on 5xx errors (server errors) or network errors
          if (attempt < retries - 1) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
            console.warn(`[LateClient] Profile creation failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          throw lastError;
        }
        
        return res.json(); // expected: profile object with id, name, provider etc.
      } catch (error: any) {
        lastError = error;
        if (attempt === retries - 1) {
          throw error;
        }
        // Continue to retry
      }
    }
    
    throw lastError || new Error("Failed to create profile after retries");
  }

  /**
   * Create a profile in late.dev (without access token)
   * Used when we need a profile before connecting social media accounts
   * 
   * @param name - Profile name
   * @param description - Optional profile description
   * @param color - Optional profile color (hex code)
   * @returns Created profile object with id, name, etc.
   */
  async createProfile(name: string, description?: string, color?: string) {
    const res = await fetch(`${LATE_API_URL}/profiles`, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${this.apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        name,
        description: description || null,
        color: color || null
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Late createProfile failed: ${errorText}`);
    }
    
    const responseData = await res.json();
    
    // Log full response for debugging
    console.log(`[LateClient] createProfile response:`, JSON.stringify(responseData, null, 2));
    
    // late.dev might return id in different structures:
    // 1. { id: "...", ... } - direct id
    // 2. { _id: "...", ... } - direct _id
    // 3. { profile: { _id: "..." }, ... } - nested profile._id
    // 4. { profile: { id: "..." }, ... } - nested profile.id
    // Try to find the ID field
    let profileId = responseData.id || responseData._id || responseData.profile_id || responseData.profileId;
    
    // If not found, check nested profile object
    if (!profileId && responseData.profile) {
      profileId = responseData.profile.id || responseData.profile._id || responseData.profile.profile_id || responseData.profile.profileId;
    }
    
    if (!profileId) {
      console.error(`[LateClient] createProfile response missing ID field. Full response:`, responseData);
      throw new Error(`Profile created but no ID found in response. Response keys: ${Object.keys(responseData).join(', ')}`);
    }
    
    // Return response with normalized id field
    // If response has nested profile, return the profile object with normalized id
    if (responseData.profile) {
      return {
        ...responseData.profile,
        id: profileId // Ensure id field exists (normalize _id to id)
      };
    }
    
    return {
      ...responseData,
      id: profileId // Ensure id field exists
    };
  }

  /**
   * Upload media file to getlate.dev
   * Supports both small files (multipart/form-data) and large files (via @vercel/blob client-upload flow)
   * @param file - File object or Buffer to upload
   * @param filename - Optional filename (defaults to file.name or 'file')
   * @returns URL of uploaded media file
   */
  async uploadMedia(file: File | Buffer, filename?: string, contentType?: string): Promise<string> {
    const fileSize = file instanceof File ? file.size : (file as Buffer).length;
    const isLargeFile = fileSize > 4 * 1024 * 1024; // > 4MB
    
    // For small files, use multipart/form-data
    if (!isLargeFile) {
      const formData = new FormData();
      if (file instanceof File) {
        formData.append('files', file);
      } else {
        const inferredType = contentType || (file instanceof File ? file.type : 'application/octet-stream');
        const bufferArray = new Uint8Array(file);
        const blob = new Blob([bufferArray], { type: inferredType });
        const fileObj = new File([blob], filename || 'file', { type: inferredType });
        formData.append('files', fileObj);
      }

      const res = await fetch(`${LATE_API_URL}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: formData
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[LateClient] uploadMedia failed (${res.status}):`, errorText);
        throw new Error(`Late uploadMedia failed: ${errorText}`);
      }

      const result = await res.json();
      // getlate.dev returns { files: [{ url: "..." }] } or { url: "..." }
      const mediaUrl = result.files?.[0]?.url || result.url || result.media_url;
      if (!mediaUrl) {
        throw new Error(`Late uploadMedia: No URL returned in response: ${JSON.stringify(result)}`);
      }
      return mediaUrl;
    } else {
      // For large files, use @vercel/blob client-upload flow
      // This requires @vercel/blob package to be installed
      try {
        // Dynamic import to avoid requiring @vercel/blob for all users
        // Note: @vercel/blob is optional - if not installed, will fall back to multipart
        let upload: any;
        try {
    
          const blobModule = await import('@vercel/blob/client');
          upload = blobModule.upload;
        } catch (importError) {
          throw new Error('@vercel/blob/client package not installed. Install it with: npm install @vercel/blob');
        }
        
        const fileData = file instanceof File ? await file.arrayBuffer() : file;
        const fileName = filename || (file instanceof File ? file.name : 'file');
        const uploadContentType = contentType || (file instanceof File ? file.type : 'application/octet-stream');
        
        const result = await upload(fileName, fileData, {
          access: 'public',
          handleUploadUrl: `${LATE_API_URL}/media`,
          headers: {
            Authorization: `Bearer ${this.apiKey}`
          },
          multipart: true,
          contentType: uploadContentType
        });

        return result.url;
      } catch (error: any) {
        // If @vercel/blob is not available, fall back to multipart (may fail for large files)
        console.warn(`[LateClient] Large file upload via @vercel/blob failed, falling back to multipart:`, error.message);
        const formData = new FormData();
        if (file instanceof File) {
          formData.append('files', file);
        } else {
          const inferredType = contentType || (file instanceof File ? file.type : 'application/octet-stream');
          const bufferArray = new Uint8Array(file);
          const blob = new Blob([bufferArray], { type: inferredType });
          const fileObj = new File([blob], filename || 'file', { type: inferredType });
          formData.append('files', fileObj);
        }

        const res = await fetch(`${LATE_API_URL}/media`, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}` },
          body: formData
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`[LateClient] uploadMedia (fallback) failed (${res.status}):`, errorText);
          throw new Error(`Late uploadMedia failed: ${errorText}. For files > 4MB, install @vercel/blob package.`);
        }

        const result = await res.json();
        const mediaUrl = result.files?.[0]?.url || result.url || result.media_url;
        if (!mediaUrl) {
          throw new Error(`Late uploadMedia: No URL returned in response: ${JSON.stringify(result)}`);
        }
        return mediaUrl;
      }
    }
  }

  // Create a post
  async createPost(payload: { profile_id: string; text?: string; content?: string; media_url?: string; schedule_at?: string; platforms?: string[] }) {
    // Log full payload for debugging (without sensitive data)
    console.log(`[LateClient] createPost payload:`, {
      profile_id: payload.profile_id,
      has_text: !!(payload.text || payload.content),
      text_length: (payload.text || payload.content)?.length || 0,
      text_preview: (payload.text || payload.content) ? (payload.text || payload.content)!.substring(0, 50) + ((payload.text || payload.content)!.length > 50 ? '...' : '') : null,
      has_media_url: !!payload.media_url,
      media_url_preview: payload.media_url ? payload.media_url.substring(0, 50) + '...' : null,
      has_schedule_at: !!payload.schedule_at,
      platforms: payload.platforms || null
    });

    // Log full payload JSON for debugging (truncated)
    const payloadStr = JSON.stringify(payload);
    console.log(`[LateClient] createPost full payload (first 500 chars):`, payloadStr.substring(0, 500));

    const res = await fetch(`${LATE_API_URL}/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[LateClient] createPost failed (${res.status}):`, errorText);
      console.error(`[LateClient] createPost request payload was:`, JSON.stringify(payload, null, 2));
      throw new Error(`Late createPost failed: ${errorText}`);
    }
    
    const response = await res.json();
    
    // Log response status for debugging
    console.log(`[LateClient] createPost response:`, {
      id: response.id || response.job_id || response.post_id,
      status: response.status || response.state || 'not provided',
      has_error: !!response.error,
      error: response.error || null
    });
    
    return response;
  }

  // Posts API
  posts = {
    create: this.createPost.bind(this)
  };

  /**
   * Delete a post from late.dev
   * According to Late.dev docs: DELETE /v1/posts/[postId]
   * Published posts cannot be deleted. Only draft, scheduled, publishing, failed, cancelled posts can be deleted.
   * 
   * @param postId - late.dev job/post ID
   * @returns Deletion result
   */
  async deletePost(postId: string) {
    const res = await fetch(`${LATE_API_URL}/posts/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }
    });
    if (!res.ok) {
      const errorText = await res.text();
      let errorMessage = `Late deletePost failed (${res.status}): ${errorText || 'No response body'}`;
      
      // Provide more specific error messages
      if (res.status === 404) {
        errorMessage = `Post ${postId} not found in late.dev. It may have already been deleted.`;
      } else if (res.status === 400) {
        errorMessage = `Cannot delete post ${postId}. Published posts cannot be deleted. Only draft, scheduled, publishing, failed, or cancelled posts can be deleted.`;
      } else if (res.status === 403) {
        errorMessage = `Access denied to post ${postId}. The API key may not have permission to delete this post.`;
      } else if (res.status === 401) {
        errorMessage = `Unauthorized. Invalid API key or expired token.`;
      }
      
      const error = new Error(errorMessage);
      (error as any).status = res.status;
      (error as any).responseText = errorText;
      throw error;
    }
    return res.json();
  }

  async getPost(jobId: string) {
      const res = await fetch(`${LATE_API_URL}/posts/${jobId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
  }

  /**
   * Get profile information from late.dev
   * Returns profile details including social media account IDs
   * @param profileId - late.dev profile ID
   * @returns Profile object with id, name, platform, social_media_ids, etc.
   */
  async getProfileInfo(profileId: string) {
    const res = await fetch(`${LATE_API_URL}/profiles/${profileId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }
    });
    if (!res.ok) {
      const errorText = await res.text();
      let errorMessage = `Late getProfileInfo failed (${res.status}): ${errorText}`;
      
      // Provide more specific error messages
      if (res.status === 404) {
        errorMessage = `Profile ${profileId} not found in late.dev. It may have been deleted or the API key doesn't have access.`;
      } else if (res.status === 403) {
        errorMessage = `Access denied to profile ${profileId}. The API key may not have permission to access this profile.`;
      } else if (res.status === 401) {
        errorMessage = `Unauthorized. Invalid API key or expired token.`;
      }
      
      const error = new Error(errorMessage);
      (error as any).status = res.status;
      (error as any).responseText = errorText;
      throw error;
    }
    return res.json();
  }

  /**
   * Update post schedule time
   * Reschedule a post that was previously scheduled
   * @param jobId - late.dev job/post ID
   * @param newScheduleAt - New schedule time (ISO 8601 format)
   * @returns Updated post object
   */
  /**
   * Reschedule a post that was previously scheduled
   * @param jobId - late.dev job/post ID
   * @param newScheduleAt - New schedule time (ISO 8601 format in UTC)
   * @param timezone - Timezone string (e.g., "Asia/Ho_Chi_Minh", "America/New_York")
   * @returns Updated post object
   */
  /**
   * Reschedule a post that was previously scheduled
   * According to Late.dev docs: PUT /v1/posts/[postId] supports updating scheduledFor and timezone
   * Only draft, scheduled, failed, and partial posts can be edited
   * 
   * @param jobId - late.dev job/post ID
   * @param newScheduleAt - New schedule time (ISO 8601 format in UTC)
   * @param timezone - Timezone string (e.g., "Asia/Ho_Chi_Minh", "America/New_York")
   * @returns Updated post object
   */
  async updatePostSchedule(jobId: string, newScheduleAt: string, timezone?: string) {
    const payload: Record<string, any> = {
      scheduledFor: newScheduleAt
    };
    
    // Include timezone if provided (required for queue-based scheduling)
    if (timezone) {
      payload.timezone = timezone;
    }
    
    // IMPORTANT: Set isDraft to false to ensure post moves from Draft to Scheduled status
    // According to Late.dev docs, when rescheduling a draft post, you need to set isDraft: false
    // to convert it from draft to scheduled status
    payload.isDraft = false;
    
    // According to Late.dev docs: PUT /v1/posts/[postId] is used to update posts
    // Only draft, scheduled, failed, and partial posts can be edited
    const res = await fetch(`${LATE_API_URL}/posts/${jobId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Late updatePostSchedule failed (${res.status}): ${errorText || 'No response body'}`);
    }
    const response = await res.json();
    
    // Log the response status for debugging
    const postStatus = response?.post?.status || response?.status || 'unknown';
    console.log(`[LateClient] updatePostSchedule response status: ${postStatus}`);
    
    return response;
  }

  /**
   * Get usage statistics and limits from late.dev
   * According to late.dev docs: https://getlate.dev/docs
   * Returns plan limits, current usage, and whether operations can be performed
   * 
   * @returns Usage stats object with planName, limits, usage, canUpload, canCreateProfile, etc.
   */
  async getUsageStats() {
    const res = await fetch(`${LATE_API_URL}/usage-stats`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Late getUsageStats failed: ${errorText}`);
    }
    
    return res.json(); // { planName, billingPeriod, limits: { uploads, profiles }, usage: { uploads, profiles }, canUpload, canCreateProfile }
  }

  /**
   * List all profiles for this late.dev account
   * 
   * @returns Array of profile objects
   */
  async listProfiles() {
    const res = await fetch(`${LATE_API_URL}/profiles`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Late listProfiles failed: ${errorText}`);
    }
    
    return res.json(); // Array of profiles or { profiles: [...] }
  }

  /**
   * List all connected social media accounts for a profile
   * According to getlate.dev docs: GET /v1/accounts
   * 
   * @param profileId - Optional. Filter accounts by profile ID
   * @returns Array of connected accounts with their IDs and platform info
   */
  async listAccounts(profileId?: string): Promise<any[]> {
    const endpoint = `${LATE_API_URL}/accounts${profileId ? `?profileId=${profileId}` : ''}`;
    
    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to list accounts: ${errorText}`);
      }

      const result = await res.json();
      // Response might be an array or an object with accounts array
      const accounts = Array.isArray(result) ? result : (result.accounts || result.items || []);
      console.log(`[LateClient] Listed ${accounts.length} account(s) for profile ${profileId || 'all'}`);
      return accounts;
    } catch (e: any) {
      console.warn(`[LateClient] Error listing accounts:`, e.message);
      throw e;
    }
  }

  /**
   * Get account ID for a specific platform from a profile
   * Calls listAccounts and finds the account matching the platform
   * 
   * @param profileId - Profile ID to get accounts for
   * @param platform - Platform name (e.g., 'youtube', 'instagram', 'twitter')
   * @returns Account ID or null if not found
   */
  async getAccountIdForPlatform(profileId: string, platform: string): Promise<string | null> {
    try {
      const accountInfo = await this.getAccountInfoForPlatform(profileId, platform);
      return accountInfo?.accountId || null;
    } catch (error: any) {
      console.warn(`[LateClient] Failed to get account ID for platform ${platform}:`, error.message);
      return null;
    }
  }

  /**
   * Get full account info (including avatar, username, etc.) for a specific platform from a profile
   * Calls listAccounts and finds the account matching the platform
   * 
   * @param profileId - Profile ID to get accounts for
   * @param platform - Platform name (e.g., 'youtube', 'instagram', 'twitter')
   * @returns Account info object with accountId, avatar_url, username, etc., or null if not found
   */
  async getAccountInfoForPlatform(profileId: string, platform: string): Promise<{
    accountId: string;
    avatar_url?: string | null;
    username?: string | null;
    name?: string | null;
    email?: string | null;
    verified?: boolean;
    followers_count?: number | null;
    [key: string]: any; // Allow other fields from late.dev API
  } | null> {
    try {
      const accounts = await this.listAccounts(profileId);
      const platformLower = platform.toLowerCase();
      
      console.log(`[LateClient] Searching for ${platform} account in ${accounts.length} account(s)`);
      
      // Find account matching the platform
      const account = accounts.find((acc: any) => 
        acc.platform?.toLowerCase() === platformLower ||
        acc.type?.toLowerCase() === platformLower ||
        acc.provider?.toLowerCase() === platformLower ||
        acc.accountType?.toLowerCase() === platformLower
      );
      
      if (account) {
        // Account ID might be in different fields
        const accountId = account.id || account.accountId || account._id || account.account_id || null;
        if (accountId) {
          console.log(`[LateClient] ✅ Found ${platform} account ID: ${accountId}`);
          
          // Log all account fields for debugging (especially for TikTok duet/stitch)
          if (platform.toLowerCase() === 'tiktok') {
            console.log(`[LateClient] TikTok account full object keys:`, Object.keys(account));
            console.log(`[LateClient] TikTok account full object:`, JSON.stringify(account, null, 2));
          }
          
          // Extract account info including avatar
          // Theo getlate.dev docs: GET /v1/accounts trả về profilePicture field
          // Kiểm tra các field có thể có: profilePicture (chính), profile_picture, avatar_url, avatar, picture, image_url, etc.
          const avatarUrl = account.profilePicture || // Theo docs: https://getlate.dev/docs#accounts
                           account.profile_picture || 
                           account.avatar_url || 
                           account.avatar || 
                           account.picture || 
                           account.image_url ||
                           account.profile_image_url ||
                           account.photo_url ||
                           null;
          
          if (avatarUrl) {
            console.log(`[LateClient] ✅ Found avatar URL for ${platform} account: ${avatarUrl.substring(0, 50)}...`);
          } else {
            console.log(`[LateClient] ℹ️ No avatar URL found for ${platform} account. Available fields:`, Object.keys(account));
          }
          
          // Theo getlate.dev docs: username và displayName là các field chính thức
          // https://getlate.dev/docs#accounts
          return {
            accountId,
            avatar_url: avatarUrl, // Map profilePicture -> avatar_url để dùng trong code
            username: account.username || null, // Theo docs: username field
            name: account.displayName || account.name || account.display_name || account.username || null, // Theo docs: displayName field
            email: account.email || null,
            verified: account.verified || account.is_verified || false,
            followers_count: account.followers_count || account.followers || null,
            isActive: account.isActive !== undefined ? account.isActive : true, // Theo docs: isActive field
            tokenExpiresAt: account.tokenExpiresAt || null, // Theo docs: tokenExpiresAt field
            permissions: account.permissions || [], // Theo docs: permissions array
            ...account // Include all other fields from late.dev API (including duetEnabled, stitchEnabled if present)
          };
        } else {
          console.warn(`[LateClient] Found ${platform} account but no ID field:`, Object.keys(account));
        }
      }
      
      console.warn(`[LateClient] ❌ No ${platform} account found in ${accounts.length} account(s)`);
      if (accounts.length > 0) {
        console.warn(`[LateClient] Available platforms:`, accounts.map((acc: any) => acc.platform || acc.type || acc.provider).filter(Boolean));
      }
      return null;
    } catch (error: any) {
      console.warn(`[LateClient] Failed to get account info for platform ${platform}:`, error.message);
      return null;
    }
  }

  /**
   * Disconnect a social media platform from a profile
   * This removes the social media connection from late.dev
   * According to getlate.dev docs: DELETE /v1/accounts/[accountId]
   * 
   * @param accountId - late.dev account ID (social media account ID, not profile ID)
   * @returns Success response
   */
  async disconnectSocialMedia(accountId: string) {
    // According to getlate.dev documentation: DELETE /v1/accounts/[accountId]
    // This endpoint disconnects a social media account from its profile
    const endpoint = `${LATE_API_URL}/accounts/${accountId}`;

    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { 
          Authorization: `Bearer ${this.apiKey}`, 
          "Content-Type": "application/json" 
        }
      });

      // If successful (200, 204, etc.), return success
      if (res.ok || res.status === 204) {
        console.log(`[LateClient] Successfully disconnected account ${accountId} via DELETE /v1/accounts/${accountId}`);
        return { success: true, endpoint, method: "DELETE" };
      }

      // Handle errors
      const errorText = await res.text();
      const error = new Error(`Late disconnectSocialMedia failed (${res.status}): ${errorText}`);
      console.warn(`[LateClient] Failed to disconnect account ${accountId}:`, error.message);
      throw error;
    } catch (e: any) {
      console.warn(`[LateClient] Error disconnecting account ${accountId}:`, e.message);
      throw e;
    }
  }

  /**
   * Connect Bluesky account using credentials
   * According to getlate.dev docs: POST /v1/connect/bluesky/credentials
   * 
   * @param profileId - late.dev profile ID
   * @param credentials - Bluesky credentials { identifier: string, password: string }
   * @returns Connection response with accountId
   */
  async connectBlueskyWithCredentials(profileId: string, credentials: { identifier: string; password: string }) {
    const endpoint = `${LATE_API_URL}/connect/bluesky/credentials`;
    
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          profileId,
          identifier: credentials.identifier,
          password: credentials.password
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Late connectBlueskyWithCredentials failed (${res.status}): ${errorText}`);
      }

      const result = await res.json();
      console.log(`[LateClient] Successfully connected Bluesky account via credentials`);
      return result;
    } catch (e: any) {
      console.error(`[LateClient] Error connecting Bluesky with credentials:`, e.message);
      throw e;
    }
  }

  /**
   * Get account ID for a platform from profile info
   * Helper method to extract accountId from profile's social_media_ids or accounts array
   * 
   * @param profileInfo - Profile info from getProfileInfo
   * @param platform - Platform name (e.g., 'instagram', 'youtube', 'facebook')
   * @returns Account ID or null if not found
   */
  extractAccountId(profileInfo: any, platform: string): string | null {
    // Try different possible fields where accountId might be stored
    const platformLower = platform.toLowerCase();
    
    // Check social_media_ids object
    if (profileInfo.social_media_ids) {
      // Try different key formats
      const possibleKeys = [
        `${platformLower}_user_id`,
        `${platformLower}_page_id`,
        `${platformLower}_id`,
        `${platformLower}_account_id`,
        platformLower
      ];
      
      for (const key of possibleKeys) {
        if (profileInfo.social_media_ids[key]) {
          return String(profileInfo.social_media_ids[key]);
        }
      }
    }
    
    // Check accounts array
    if (Array.isArray(profileInfo.accounts)) {
      const account = profileInfo.accounts.find((acc: any) => 
        acc.platform?.toLowerCase() === platformLower || 
        acc.type?.toLowerCase() === platformLower ||
        acc.provider?.toLowerCase() === platformLower
      );
      if (account) {
        return account.id || account.accountId || account._id || account.account_id || null;
      }
    }
    
    // Check direct accountIds object
    if (profileInfo.accountIds) {
      const possibleKeys = [platformLower, `${platformLower}_id`, `${platformLower}_account_id`];
      for (const key of possibleKeys) {
        if (profileInfo.accountIds[key]) {
          return String(profileInfo.accountIds[key]);
        }
      }
    }
    
    // Check if profileInfo itself has accountId for this platform
    if (profileInfo[`${platformLower}_account_id`] || profileInfo[`${platformLower}_id`]) {
      return String(profileInfo[`${platformLower}_account_id`] || profileInfo[`${platformLower}_id`]);
    }
    
    return null;
  }

}

export function createLateClient() { 
  return new LateClient(); 
}

/**
 * Get Late.dev client for a user
 */
export async function getLateDevClient(userId: string, supabase: any) {
  try {
    // Get user's connected accounts
    const { data: accounts, error } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .single();
      
    if (error || !accounts) {
      return null;
    }
    
    return new LateClient();
  } catch (error) {
    console.error("Error getting Late.dev client:", error);
    return null;
  }
}
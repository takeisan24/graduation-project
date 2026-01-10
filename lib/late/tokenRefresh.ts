import { supabase } from "@/lib/supabase";
import { createLateClient } from "./client";
import { encryptToken, decryptToken } from "@/lib/crypto";

/**
 * Check if token is expired or will expire soon (within 5 minutes)
 * @param expiresAt - ISO timestamp string or null
 * @returns true if token is expired or expiring soon
 */
export function isTokenExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return true; // No expiry info means assume expired
  
  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  return expiryTime <= (now + fiveMinutes);
}

/**
 * Refresh access token for a connected account if it's expired or expiring soon
 * @param connectionId - ID of the connected_account record
 * @returns Updated connection data with new tokens, or null if refresh failed
 */
export async function refreshConnectionToken(connectionId: string) {
  try {
    // Get the connection record
    const { data: connection, error: fetchError } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (fetchError || !connection) {
      console.error("[tokenRefresh] Connection not found:", fetchError);
      return null;
    }

    // IMPORTANT: For getlate.dev connections, tokens are managed by getlate.dev
    // We don't need to refresh tokens - getlate.dev handles this automatically
    // Skip token refresh if connection has late_profile_id (managed by getlate.dev)
    if (connection.late_profile_id || (connection as any).getlate_profile_id) {
      console.log(`[tokenRefresh] Connection ${connectionId} is managed by getlate.dev, skipping token refresh`);
      return connection; // Return connection as-is, getlate.dev manages tokens
    }

    // Check if token needs refresh (for legacy connections not managed by getlate.dev)
    if (!isTokenExpiringSoon(connection.expires_at)) {
      return connection; // Token still valid, no refresh needed
    }

    // Check if we have a refresh token (for legacy connections)
    if (!connection.refresh_token) {
      console.warn("[tokenRefresh] No refresh token available for connection:", connectionId);
      return null;
    }

    // Decrypt refresh token
    let refreshToken: string;
    try {
      refreshToken = decryptToken(connection.refresh_token);
    } catch (e: any) {
      console.error("[tokenRefresh] Failed to decrypt refresh token:", e);
      return null;
    }

    // Refresh token via late.dev
    const lateClient = createLateClient();
    const tokenResponse = await lateClient.refreshAccessToken(refreshToken);

    if (!tokenResponse.access_token) {
      console.error("[tokenRefresh] No access token in refresh response");
      return null;
    }

    // Calculate new expiry time
    const expiresIn = tokenResponse.expires_in || 3600; // Default 1 hour
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Update connection with new tokens
    const { data: updatedConnection, error: updateError } = await supabase
      .from("connected_accounts")
      .update({
        access_token: encryptToken(tokenResponse.access_token),
        refresh_token: tokenResponse.refresh_token
          ? encryptToken(tokenResponse.refresh_token)
          : connection.refresh_token, // Keep old refresh token if new one not provided
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)
      .select()
      .single();

    if (updateError) {
      console.error("[tokenRefresh] Failed to update connection:", updateError);
      return null;
    }

    console.log(`[tokenRefresh] Successfully refreshed token for connection: ${connectionId}`);
    return updatedConnection;

  } catch (err: any) {
    console.error("[tokenRefresh] Error refreshing token:", err);
    return null;
  }
}

/**
 * Ensure token is valid before making API calls
 * Automatically refreshes if needed (only for legacy connections, not getlate.dev managed)
 * @param connectionId - ID of the connected_account record
 * @returns Valid connection data with non-expired tokens
 */
export async function ensureValidToken(connectionId: string) {
  const connection = await refreshConnectionToken(connectionId);
  if (!connection) {
    // For getlate.dev connections, this shouldn't happen (they're always valid)
    // For legacy connections, user needs to reconnect
    throw new Error("Failed to refresh expired token. Please reconnect your account.");
  }
  return connection;
}


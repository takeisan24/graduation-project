import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { getCreditTransactions } from "@/lib/services/db/users";
import { getDateStringInTimezone, getWeekStartDate, getMonthLabel, DEFAULT_TIMEZONE } from "@/lib/utils/date";


// ✅ Force dynamic rendering for API route
export const dynamic = 'force-dynamic';

/**
 * GET /api/usage/history
 * Get user's usage statistics over time for API Dashboard
 * 
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'all' (default: '30d')
 * - groupBy: 'day' | 'week' | 'month' (default: 'day')
 * 
 * Refactored: Uses service layer for database operations
 */

function getActionDescription(type: string): string {
  switch (type) {
    case 'PROJECT_CREATED': return 'New project created';
    case 'POST_CREATED': return 'Content generated';
    case 'IMAGE_GENERATED': return 'Image generated';
    case 'VIDEO_GENERATED': return 'Video generated';
    case 'POST_SCHEDULED': return 'Post scheduled';
    case 'POST_PUBLISHED': return 'Post published';
    case 'AI_REFINEMENT': return 'AI refinement';
    case 'TEXT_ONLY': return 'Text post created';
    case 'WITH_IMAGE': return 'Post with image';
    case 'WITH_VIDEO': return 'Post with video';
    default: return type.replace(/_/g, ' ').toLowerCase();
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await withAuthOnly(req);
    if ('error' in auth) return auth.error;
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, all
    const groupBy = searchParams.get('groupBy') || 'day'; // day, week, month
    const timezone = DEFAULT_TIMEZONE;

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Query credit_transactions via service layer
    // Note: Grouping is done in JavaScript for simplicity
    const transactions = await getCreditTransactions(user.id, startDate, now);

    // Group transactions by time period
    const grouped: Record<string, {
      date: string;
      creditsUsed: number;
      postsCreated: number;
      imagesGenerated: number;
      videosGenerated: number;
      postsScheduled: number;
      postsPublished: number;
      apiCalls: number; // Total actions (for API calls metric)
    }> = {};

    transactions?.forEach((tx) => {
      const txDate = new Date(tx.created_at);
      let dateKey: string;

      switch (groupBy) {
        case 'week':
          dateKey = getWeekStartDate(timezone, txDate);
          break;
        case 'month':
          dateKey = getMonthLabel(timezone, txDate);
          break;
        case 'day':
        default:
          dateKey = getDateStringInTimezone(txDate, timezone);
      }

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          creditsUsed: 0,
          postsCreated: 0,
          imagesGenerated: 0,
          videosGenerated: 0,
          postsScheduled: 0,
          postsPublished: 0,
          apiCalls: 0,
        };
      }

      const group = grouped[dateKey];
      group.apiCalls += 1; // Every transaction is an API call
      group.creditsUsed += tx.credits_used || 0;

      // Categorize by action_type
      const at = tx.action_type as string;
      if (at === 'TEXT_ONLY' || at === 'WITH_IMAGE' || at === 'WITH_VIDEO') {
        group.postsCreated += 1;
      }
      if (at === 'WITH_IMAGE') {
        group.imagesGenerated += 1;
      }
      if (at === 'WITH_VIDEO') {
        group.videosGenerated += 1;
      }
      if (at === 'POST_SCHEDULED') {
        group.postsScheduled += 1;
      }
      if (at === 'POST_PUBLISHED') {
        group.postsPublished += 1;
      }
    });

    // Convert to array and sort by date
    const timeSeries = Object.values(grouped).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Calculate totals and success rate
    const totalApiCalls = transactions?.length || 0;
    const totalCreditsUsed = transactions?.reduce((sum, tx) => sum + (tx.credits_used || 0), 0) || 0;

    // Success rate: count successful actions (non-failed transactions)
    // For now, assume all transactions are successful (we can add status field later if needed)
    const successRate = totalApiCalls > 0 ? 100 : 0;

    const dateRange = {
      start: getDateStringInTimezone(startDate, timezone),
      end: getDateStringInTimezone(now, timezone),
      timezone
    };

    // Calculate Platform Stats and AI Provider Stats from transactions
    const platformStats = {
      facebook: 0, instagram: 0, twitter: 0, linkedin: 0, tiktok: 0, youtube: 0
    };
    const aiProviderStats = {
      gemini: 0, openai: 0, fal: 0, anthropic: 0
    };

    transactions?.forEach(tx => {
      // Platform Stats
      if (tx.platform) {
        const p = tx.platform.toLowerCase();
        if (p === 'facebook') platformStats.facebook++;
        else if (p === 'instagram') platformStats.instagram++;
        else if (p === 'twitter' || p === 'x') platformStats.twitter++;
        else if (p === 'linkedin') platformStats.linkedin++;
        else if (p === 'tiktok') platformStats.tiktok++;
        else if (p === 'youtube') platformStats.youtube++;
      }

      // AI Provider Stats (Inferred)
      // TEXT -> Gemini (Default)
      // IMAGE/VIDEO -> Fal (Default)
      const at = tx.action_type;
      if (at === 'TEXT_ONLY' || at === 'POST_CREATED' || at === 'AI_REFINEMENT') {
        aiProviderStats.gemini++;
      } else if (at === 'WITH_IMAGE' || at === 'IMAGE_GENERATED') {
        aiProviderStats.fal++; // Assuming Fal for images
      } else if (at === 'WITH_VIDEO' || at === 'VIDEO_GENERATED') {
        aiProviderStats.fal++; // Assuming Fal for videos
      }
    });

    // Generate recent activity (top 20)
    const recentActivity = transactions
      ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) // Ensure desc sort
      .slice(0, 20)
      .map(tx => ({
        id: tx.id,
        type: tx.action_type.toLowerCase(),
        description: getActionDescription(tx.action_type),
        timestamp: tx.created_at,
        platform: tx.platform,
        creditsUsed: tx.credits_used
      })) || [];

    return success({
      period,
      groupBy,
      summary: {
        totalApiCalls,
        totalCreditsUsed,
        successRate,
        dateRange,
      },
      timeSeries,
      recentActivity,
      platformStats,
      aiProviderStats
    });

  } catch (err: any) {
    console.error("GET /api/usage/history error:", err);
    return fail(err.message || "Server error", 500);
  }
}


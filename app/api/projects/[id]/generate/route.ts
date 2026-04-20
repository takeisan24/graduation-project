/**
 * POST /api/projects/[id]/generate
 * Generate content for a project
 *
 * Refactored: Route handler only handles request/response, logic moved to service layer
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";
import { generateAllPlatformContent } from "@/lib/ai/contentService";
import { deductCredits, trackUsage } from "@/lib/usage";
import { CREDIT_COSTS } from "@/lib/usage";
import { getProjectById, createDraft } from "@/lib/services/db/projects";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Auth check
    const user = await requireAuth(req);
    if (!user) return fail("Unauthorized", 401);

    // 2. Get input from frontend
    const {
      sourceType = 'prompt',
      sourceContent,
      filePublicUrl,
      platforms = ['instagram', 'tiktok', 'x'],
      mediaTypes = ['text', 'image']
    } = await req.json();

    if (!sourceContent) return fail("Missing sourceContent", 400);

    // 3. Check project exists via service layer
    const project = await getProjectById(params.id, user.id);

    if (!project) return fail("Project not found", 404);

    // 4. Generate content with AI
    let generatedContent;
    try {
      generatedContent = await generateAllPlatformContent({
        sourceType,
        sourceContent,
        filePublicUrl,
        userId: user.id
      });
    } catch (aiError: unknown) {
      const aiMessage = aiError instanceof Error ? aiError.message : "Content generation failed";
      console.error("AI generation error:", aiMessage);
      return fail("Content generation failed", 500);
    }

    // 5. Save drafts for each generated content via service layer
    const drafts = [];
    for (const content of generatedContent) {
      const draft = await createDraft({
        project_id: project.id,
        user_id: user.id,
        platform: content.platform,
        text_content: content.text,
        media_urls: content.media_urls,
        status: "draft"
      });

      if (!draft) {
        console.error(`Error saving draft for ${content.platform}`);
        continue;
      }

      drafts.push(draft);
    }

    if (drafts.length === 0) {
      return fail("Failed to save any drafts", 500);
    }

    // 6. Deduct credits after successful generation and saving
    let latestCreditsRemaining = 0;
    for (const mediaType of mediaTypes) {
      let action: keyof typeof CREDIT_COSTS;
      switch (mediaType) {
        case "text": action = 'TEXT_ONLY'; break;
        case "image": action = 'WITH_IMAGE'; break;
        case "video": action = 'WITH_VIDEO'; break;
        default: continue;
      }

      for (let i = 0; i < platforms.length; i++) {
        const creditResult = await deductCredits(user.id, action, {
          projectId: project.id,
          platforms: platforms.join(','),
          mediaTypes: mediaTypes.join(',')
        });

        if (!creditResult.success) {
          console.error("Failed to deduct credits after content generation:", creditResult);
        } else {
          latestCreditsRemaining = creditResult.creditsLeft ?? latestCreditsRemaining;
        }
      }
    }

    // 7. Track usage
    await trackUsage(user.id, 'project_created');
    for (const content of generatedContent) {
      if (content.media_type === 'image') {
        await trackUsage(user.id, 'image_generated');
      } else if (content.media_type === 'video') {
        await trackUsage(user.id, 'video_generated');
      }
    }

    return success({
      drafts,
      generatedContent,
      creditsRemaining: latestCreditsRemaining,
      message: `Generated ${drafts.length} content pieces across ${platforms.length} platforms`
    }, 201);

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("Generate content error:", message);
    return fail(message, 500);
  }
}

/**
 * Service: Multimodal Content Generation
 * 
 * Handles multimodal content generation business logic including:
 * - Credit checking and deduction
 * - Usage tracking
 * - Error handling
 * - Multi-platform generation from multimodal inputs (text + images)
 */

import { NextRequest } from "next/server";
import { Part } from "@google/generative-ai";
import { aiManager } from "@/lib/ai/providers/manager";
import { deductCredits, CREDIT_COSTS } from "@/lib/usage";
import { withApiProtection } from "@/lib/middleware/api-protected";
import { supabase } from "@/lib/supabase";
import { getMonthStartDate, DEFAULT_TIMEZONE } from "@/lib/utils/date";
import { MASTER_SYSTEM_PROMPT } from "@/lib/prompts";

export interface MultimodalGenerationRequest {
  promptParts: (string | Part)[];
  // modelPreference ở đây là key từ FE (ví dụ: 'ChatGPT', 'Gemini Pro', ...)
  modelPreference?: string;
  platforms?: string[];
}

export interface MultimodalGenerationResult {
  response: string;
  platforms: string[];
  creditsRemaining: number;
  message: string;
  // Extracted content from YouTube video (text only) - để FE lưu lại và dùng cho chat AI
  extractedContent?: string;
}

/**
 * Generate content from multimodal inputs (text + images) with credit management
 * 
 * @param req - Next.js request object for authentication
 * @param request - Multimodal generation request parameters
 * @returns Generation result or error response
 */
export async function generateFromSourceWithCredits(
  req: NextRequest,
  request: MultimodalGenerationRequest
): Promise<MultimodalGenerationResult | { error: string; status: number }> {
  const {
    promptParts,
    modelPreference,
    platforms = ['facebook']
  } = request;

  // Validate inputs
  if (!promptParts || promptParts.length === 0) {
    return { error: "Prompt is required", status: 400 };
  }

  // Determine model to use
  // - Nếu FE gửi 'ChatGPT' => dùng OpenAI với model trong env OPENAI_MODEL (mặc định 'gpt-5-mini')
  // - Còn lại (hoặc không gửi) => dùng Gemini
  //   - Mặc định: 'gemini-2.5-flash' (nhanh hơn, tiết kiệm tokens, đủ khả năng xử lý PDF, multimodal)
  const clientModelKey = (modelPreference || '').toLowerCase().trim();
  const openaiEnvModel = process.env.OPENAI_MODEL || 'gpt-5-mini';
  const isChatGPT = clientModelKey === 'chatgpt';

  // Check if promptParts contains YouTube URL and extract it
  // Also check for PDF / audio files
  let youtubeUrl: string | null = null;
  let hasPDF = false;
  let hasAudio = false;
  let hasDoc = false;
  let audioFileUri: string | null = null;
  promptParts.forEach((part) => {
    if (typeof part === 'string') {
      const match = part.match(/(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (match) {
        youtubeUrl = match[0];
      }
    }
    // Check fileData with YouTube URL or PDF
    if ((part as any).fileData?.fileUri) {
      const fileUri = (part as any).fileData.fileUri;
      const mimeType = (part as any).fileData.mimeType || '';

      // Check for YouTube URL
      if (/youtube\.com\/watch|youtu\.be/.test(fileUri)) {
        youtubeUrl = fileUri;
      }
      // Check for PDF file
      if (mimeType.includes('pdf') || fileUri.includes('.pdf') || /application\/pdf/.test(mimeType)) {
        hasPDF = true;
      }

      // Check for doc file
      const isWordDoc =
        mimeType.includes('msword') ||
        mimeType.includes('wordprocessingml') ||
        /\.(doc|docx)$/i.test(fileUri);

      if (isWordDoc) {
        hasDoc = true;
      }

      // Check for audio file
      if (mimeType.startsWith('audio') || /\.(mp3|wav|m4a|aac|flac)$/i.test(fileUri) || /audio\//.test(mimeType)) {
        hasAudio = true;
        audioFileUri = fileUri;
      }
    }
  });

  const hasYouTubeUrl = youtubeUrl !== null;
  // Extract PDF file URI if present (for OpenAI upload)
  let documentFilesToUpload: { uri: string; mimeType: string }[] = [];
  if ((hasPDF || hasDoc) && isChatGPT) {
    promptParts.forEach((part) => {
      if ((part as any).fileData?.fileUri) {
        const fileUri = (part as any).fileData.fileUri;
        const mimeType = (part as any).fileData.mimeType || '';

        const isPdf = mimeType.includes('pdf') || fileUri.endsWith('.pdf') || /application\/pdf/.test(mimeType);
        const isWord = mimeType.includes('msword') || mimeType.includes('wordprocessingml') || /\.(doc|docx)$/i.test(fileUri);

        if (typeof fileUri === 'string' && (isPdf || isWord)) {
          documentFilesToUpload.push({ uri: fileUri, mimeType });
        }
      }
    });
  }

  // Use flash for all cases (faster and more cost-effective)
  const geminiModel = "gemini-2.5-flash";
  const modelToUse = isChatGPT ? openaiEnvModel : geminiModel;

  // Validate and filter platforms array
  const platformList = Array.isArray(platforms) && platforms.length > 0
    ? platforms.filter(p => typeof p === 'string' && p.trim().length > 0)
    : ['facebook'];

  // Centralized protection: auth + paywall check (skip deduction until success)
  // Use count = number of platforms to require enough credits upfront
  const protection = await withApiProtection(req, 'TEXT_ONLY', {
    returnError: true,
    skipDeduct: true, // Only check auth + paywall, deduct after success
    count: platformList.length,
    metadata: {
      model: modelToUse,
      sourceType: 'multimodal',
      partsCount: promptParts.length,
      platforms: platformList.join(',')
    }
  });

  if ('error' in protection) {
    return { error: "Unauthorized or insufficient credits", status: 401 };
  }

  const { user, paywallResult } = protection;

  // Check if user has enough credits (before generation)
  // TEXT_ONLY = 1 credit per platform
  const totalCreditsNeeded = CREDIT_COSTS.TEXT_ONLY * platformList.length;
  if (!paywallResult.allowed || (paywallResult.creditsRemaining !== undefined && paywallResult.creditsRemaining < totalCreditsNeeded)) {
    console.warn(`[MultimodalGeneration] INSUFFICIENT CREDITS - User ${user.id}, need ${totalCreditsNeeded} credits (${platformList.length} platforms), have ${paywallResult.creditsRemaining ?? 0}`);
    return {
      error: JSON.stringify({
        message: `Insufficient credits. Need ${totalCreditsNeeded} credits (${platformList.length} platforms) but only have ${paywallResult.creditsRemaining ?? 0}`,
        upgradeRequired: paywallResult.upgradeRequired ?? true,
        creditsRequired: totalCreditsNeeded,
        creditsRemaining: paywallResult.creditsRemaining ?? 0,
        totalCredits: paywallResult.totalCredits ?? 0,
        platformsCount: platformList.length
      }),
      status: 403
    };
  }

  // Generate content using selected provider via AI manager
  let aiResponse: string;
  let extractedContent: string | undefined; // Lưu extracted content để trả về cho FE
  try {
    // Priority: YouTube > audio > PDF
    // If multiple exist, handle higher priority first; PDF can be attached in OpenAI step if present
    if (isChatGPT && hasYouTubeUrl && youtubeUrl) {
      // ChatGPT + YouTube: 2-step process
      // Step 1: Extract content from YouTube using Gemini Flash
      // If video is too long (exceeds token limit), fallback to metadata extraction
      const gemini = aiManager.getProvider('gemini');

      try {
        // Extract YouTube content with Gemini Flash
        // Use concise prompt to minimize token usage - only request key points
        const extractionPrompt = `Hãy trích xuất và tóm tắt ngắn gọn NỘI DUNG/KIẾN THỨC CỐT LÕI của video YouTube này. Chỉ cần:
- Tiêu đề hoặc Chủ đề chính của video
- 3-5 điểm chuyên môn, bài học hoặc sự thật thú vị được đề cập
- Thông điệp chính của video
- KHÔNG CẦN quan tâm đến tên người nói hay tên kênh. Trích xuất kiến thức nguyên thủy.
- TUYỆT ĐỐI KHÔNG ghi chép thông tin tác giả, YouTuber, tên nhân vật hay nguồn kênh. Hãy biến kiến thức này thành thông tin độc lập.

Trả về dưới dạng văn bản súc tích (tối đa 500 từ) để làm nền tảng kiến thức cho tôi tạo bài đăng mạng xã hội của riêng tôi.`;

        extractedContent = await gemini.generateContentFromParts({
          model: "gemini-2.5-flash",
          systemInstruction: MASTER_SYSTEM_PROMPT,
          promptParts: [
            extractionPrompt,
            {
              fileData: {
                fileUri: youtubeUrl,
                mimeType: 'video/*'
              }
            }
          ]
        });

      } catch (geminiError: unknown) {
        // Check if error is due to token limit (video too long)
        const geminiErrorMessage = geminiError instanceof Error ? geminiError.message : "";
        const isTokenLimitError = geminiErrorMessage.includes('token count exceeds') ||
          geminiErrorMessage.includes('maximum number of tokens') ||
          geminiErrorMessage.includes('400 Bad Request');

        if (isTokenLimitError) {
          console.warn(`[MultimodalGeneration] Video too long for Gemini Flash (token limit exceeded). Falling back to metadata extraction...`);

          // Fallback: Extract metadata using YouTube API/scraping
          try {
            const { extractYouTubeMetadata, formatYouTubeMetadataForAI } = await import('@/lib/services/youtube/extractMetadata');
            const metadata = await extractYouTubeMetadata(youtubeUrl);

            if (metadata) {
              // Get instructions from promptParts
              const instructions = promptParts
                .filter((part) => typeof part === 'string')
                .join('\n\n');

              // Format metadata for AI (this will be used directly in Step 2)
              extractedContent = formatYouTubeMetadataForAI(metadata);
            } else {
              // Last resort: use URL with instructions
              const instructions = promptParts
                .filter((part) => typeof part === 'string')
                .join('\n\n');
              extractedContent = `${instructions}\n\nNguồn video YouTube: ${youtubeUrl}\n\nLưu ý: Video quá dài để phân tích trực tiếp. Vui lòng tạo bài đăng dựa trên link này.`;
              console.warn(`[MultimodalGeneration] Metadata extraction failed, using URL fallback`);
            }
          } catch (fallbackError) {
            console.error(`[MultimodalGeneration] Fallback metadata extraction failed:`, fallbackError);
            // Last resort: use URL with instructions
            const instructions = promptParts
              .filter((part) => typeof part === 'string')
              .join('\n\n');
            extractedContent = `${instructions}\n\nNguồn video YouTube: ${youtubeUrl}\n\nLưu ý: Video quá dài để phân tích trực tiếp. Vui lòng tạo bài đăng dựa trên link này.`;
          }
        } else {
          // Other errors - rethrow
          throw geminiError;
        }
      }

      // Ensure extractedContent is defined (should always be set by this point)
      if (!extractedContent) {
        throw new Error('Extracted content is missing after YouTube extraction');
      }

      // Handle PDF upload if PDF exists alongside YouTube
      let openAIFileIds: string[] = [];
      if (documentFilesToUpload.length > 0) {
        const openai = aiManager.getProvider('openai');

        for (const doc of documentFilesToUpload) {
          try {
            const fileName = doc.uri.split('/').pop() || 'document';
            // OpenAI Assistants API supports PDF, DOC, DOCX
            const fileId = await openai.uploadFile(doc.uri, fileName, 'assistants');
            openAIFileIds.push(fileId);
          } catch (uploadError: unknown) {
            console.error(`[MultimodalGeneration] Failed to upload document ${doc.uri}:`, uploadError);
          }
        }
      }

      try {
        // If extractedContent already contains instructions (from fallback), use it directly
        // Otherwise, combine instructions with extracted content
        // Also include PDF text description if PDF upload failed
        let combinedPrompt = extractedContent.includes('=== YÊU CẦU ===') || extractedContent.includes('Nguồn video YouTube:')
          ? extractedContent
          : `${promptParts.filter((part) => typeof part === 'string').join('\n\n')}\n\nNội dung video YouTube đã được phân tích:\n\n${extractedContent}`;

        // Add PDF text description if PDF exists but upload failed
        if (documentFilesToUpload.length > 0 && openAIFileIds.length === 0) {
          combinedPrompt += `\n\n[Warning] Không thể upload file đính kèm. Danh sách file: ${documentFilesToUpload.map(d => d.uri).join(', ')}`;
        }

        // Validate combinedPrompt is not empty
        if (!combinedPrompt || combinedPrompt.trim().length === 0) {
          throw new Error('Generated prompt is empty after processing');
        }

        aiResponse = await aiManager.generateText({
          modelId: modelToUse,
          messages: [
            { role: 'system', content: MASTER_SYSTEM_PROMPT },
            { role: 'user', content: combinedPrompt }
          ],
          maxTokens: 20000,
          fileIds: openAIFileIds.length > 0 ? openAIFileIds : undefined
        });
      } finally {
        // Always delete uploaded files from OpenAI, even if generation fails
        if (openAIFileIds.length > 0) {
          const openai = aiManager.getProvider('openai');
          for (const fileId of openAIFileIds) {
            try {
              const deleted = await openai.deleteFile(fileId);
              if (deleted) {
                // File deleted successfully
              } else {
                console.warn(`[MultimodalGeneration] Failed to delete OpenAI file: ${fileId}`);
              }
            } catch (deleteError: unknown) {
              console.error(`[MultimodalGeneration] Error deleting OpenAI file ${fileId}:`, deleteError);
            }
          }
        }
      }
    } else if (isChatGPT && hasAudio && audioFileUri) {
      // ChatGPT + Audio: 2-step process (transcribe/extract with Gemini, then OpenAI)
      const gemini = aiManager.getProvider('gemini');
      try {
        const extractionPrompt = `Bạn là trợ lý tóm tắt audio. Hãy trích xuất:
- Tiêu đề/ngữ cảnh (nếu nhận biết được)
- 3-7 ý chính
- Tóm tắt ngắn gọn (<= 300 từ)
Chỉ trả về văn bản.`;

        extractedContent = await gemini.generateContentFromParts({
          model: "gemini-2.5-flash",
          systemInstruction: MASTER_SYSTEM_PROMPT,
          promptParts: [
            extractionPrompt,
            {
              fileData: {
                fileUri: audioFileUri,
                mimeType: 'audio/*'
              }
            }
          ]
        });
      } catch (geminiError: unknown) {
        console.error(`[MultimodalGeneration] Audio extraction failed:`, geminiError);
        // Fallback: use URL + instructions
        const instructions = promptParts
          .filter((part) => typeof part === 'string')
          .join('\n\n');
        extractedContent = `${instructions}\n\nNguồn audio: ${audioFileUri}\n\nLưu ý: Không thể trích xuất trực tiếp. Vui lòng tạo bài dựa trên link này.`;
      }

      if (!extractedContent) {
        throw new Error('Extracted content is missing after audio extraction');
      }

      let combinedPrompt = `${promptParts.filter((part) => typeof part === 'string').join('\n\n')}\n\nNội dung audio đã được trích xuất:\n\n${extractedContent}`;
      if (!combinedPrompt || combinedPrompt.trim().length === 0) {
        throw new Error('Generated prompt is empty after processing audio content');
      }

      aiResponse = await aiManager.generateText({
        modelId: modelToUse,
        messages: [
          { role: 'system', content: MASTER_SYSTEM_PROMPT },
          { role: 'user', content: combinedPrompt }
        ],
        maxTokens: 20000,
      });

      // extractedContent giữ lại cho FE

      // Lưu extractedContent để trả về cho FE (chỉ text, không có instructions)
      // Nếu extractedContent chứa instructions (từ fallback), chỉ lấy phần nội dung
      let finalExtractedContent: string = extractedContent;
      if (finalExtractedContent.includes('=== THÔNG TIN VIDEO YOUTUBE ===')) {
        // Tách phần metadata ra (bỏ phần instructions)
        const metadataMatch = finalExtractedContent.match(/=== THÔNG TIN VIDEO YOUTUBE ===([\s\S]*?)(?=\n=== YÊU CẦU ===|$)/);
        finalExtractedContent = metadataMatch ? metadataMatch[1].trim() : finalExtractedContent;
      } else if (!finalExtractedContent.includes('Nguồn video YouTube:')) {
        // Nếu là extracted content từ Gemini Flash (không có instructions), giữ nguyên
        // extractedContent đã là nội dung thuần túy
      }
      extractedContent = finalExtractedContent; // Cập nhật biến extractedContent
    } else if (isChatGPT) {
      // OpenAI: Handle PDF files by uploading to OpenAI Files API first
      let openAIFileIds: string[] = [];

      if (documentFilesToUpload.length > 0) {
        const openai = aiManager.getProvider('openai');
        for (const doc of documentFilesToUpload) {
          try {
            const fileName = doc.uri.split('/').pop() || 'document';
            const fileId = await openai.uploadFile(doc.uri, fileName, 'assistants');
            openAIFileIds.push(fileId);
          } catch (err) {
            console.error(`[MultimodalGeneration] Upload failed for ${doc.uri}`, err);
          }
        }
      }

      try {
        // Build prompt from promptParts (excluding PDF fileData if already uploaded)
        const combinedPrompt = promptParts
          .map((part) => {
            if (typeof part === 'string') return part;

            if ((part as any).fileData?.fileUri) {
              const fileUri = (part as any).fileData.fileUri;
              const mimeType = (part as any).fileData.mimeType || '';

              const isPdf = mimeType.includes('pdf') || fileUri.endsWith('.pdf');
              const isWord = mimeType.includes('msword') || mimeType.includes('wordprocessingml') || /\.(doc|docx)$/i.test(fileUri);
              const isUploadableDoc = isPdf || isWord;

              // [NEW] Skip text description if document was successfully uploaded
              if (isUploadableDoc && openAIFileIds.length > 0) {
                return null;
              }

              return `File input: ${fileUri} (mimeType: ${mimeType})`;
            }
            return JSON.stringify(part);
          })
          .filter((part) => part !== null && part.trim().length > 0)
          .join('\n\n');

        // Validate combinedPrompt is not empty
        if (!combinedPrompt || combinedPrompt.trim().length === 0) {
          throw new Error('Generated prompt is empty after processing promptParts');
        }

        // Generate with OpenAI, including file_ids if PDF was uploaded
        aiResponse = await aiManager.generateText({
          modelId: modelToUse,
          messages: [
            { role: 'system', content: MASTER_SYSTEM_PROMPT },
            { role: 'user', content: combinedPrompt }
          ],
          maxTokens: 20000,
          fileIds: openAIFileIds.length > 0 ? openAIFileIds : undefined
        });
      } finally {
        // Always delete uploaded files from OpenAI, even if generation fails
        // This cleans up temporary files and saves storage quota
        if (openAIFileIds.length > 0) {
          const openai = aiManager.getProvider('openai');
          for (const fileId of openAIFileIds) {
            try {
              const deleted = await openai.deleteFile(fileId);
              if (deleted) {
                // File deleted successfully
              } else {
                console.warn(`[MultimodalGeneration] Failed to delete OpenAI file: ${fileId}`);
              }
            } catch (deleteError: unknown) {
              console.error(`[MultimodalGeneration] Error deleting OpenAI file ${fileId}:`, deleteError);
              // Non-fatal: continue even if deletion fails
            }
          }
        }
      }
    } else {
      // Gemini: sử dụng generateContentFromParts để tận dụng multimodal (pdf, video, ...)
      // Nếu là YouTube, sẽ dùng gemini-2.5-flash (đã set ở trên)
      const gemini = aiManager.getProvider('gemini');

      // [FIX] Transform URL text to Video File Data for Gemini Native Video Understanding
      let finalPromptParts = promptParts;
      if (hasYouTubeUrl && youtubeUrl) {
        // Remove the URL string from PROMPT (to clean up) and append the structured fileData
        // We keep other text instructions.
        finalPromptParts = [
          ...promptParts.map(p => typeof p === 'string' ? p.replace(youtubeUrl!, '') : p),
          {
            fileData: {
              fileUri: youtubeUrl,
              mimeType: 'video/*'
            }
          }
        ];
      }

      // [FIX] Audio Handling for Gemini: Download -> Upload -> Native Audio Understanding
      let audioFileName: string | null = null;
      // Note: audioUrl extraction from string (if not provided as fileData) needs to be added to detection loop above
      // But since we can't easily jump back to line 70, we will do a quick check here if audioUrl wasn't found but a string part looks like audio
      if (!audioFileUri) {
        // Try to find audio URL in promptParts strings if not already found from fileData
        for (const p of promptParts) {
          if (typeof p === 'string') {
            const match = p.match(/(https?:\/\/[^\s]+?\.(?:mp3|wav|m4a|aac|flac|ogg))(\?.*)?$/i);
            if (match) audioFileUri = match[1];
          }
        }
      }

      if (audioFileUri && typeof audioFileUri === 'string' && audioFileUri.startsWith('http')) {
        try {
          // 1. Download
          const response = await fetch(audioFileUri);
          if (!response.ok) throw new Error("Failed to download Audio file");
          const buffer = Buffer.from(await response.arrayBuffer());

          // 2. Save temp
          const fs = await import('fs');
          const fsPromises = fs.promises || (fs as any).default?.promises;
          if (!fsPromises) throw new Error("fs.promises not found");

          const path = await import('path');
          const os = await import('os');

          const joinPath = path.join || (path as any).default?.join;
          const tmpDir = os.tmpdir || (os as any).default?.tmpdir;
          if (!joinPath || !tmpDir) throw new Error("System modules missing functions");

          const tempFilePath = joinPath(tmpDir(), `audio-gemini-${Date.now()}.mp3`);
          await fsPromises.writeFile(tempFilePath, new Uint8Array(buffer));

          // 3. Upload
          const uploadResult = await gemini.uploadFile(tempFilePath, 'audio/mp3', 'Audio File');
          const uploadedAudioUri = uploadResult.fileUri;
          audioFileName = uploadResult.name;

          // Wait for file processing
          await gemini.waitForActiveFile(audioFileName);

          // 4. Transform Prompt
          // If audioFileUri was found in string, remove it. If it was passed as fileData but is a URL, we replace it with uploaded URI
          finalPromptParts = [
            ...finalPromptParts.map(p => typeof p === 'string' ? p.replace(audioFileUri!, '') : p),
            {
              fileData: {
                fileUri: uploadedAudioUri,
                mimeType: 'audio/mp3'
              }
            }
          ];

          await fs.promises.unlink(tempFilePath);

        } catch (err) {
          console.error('[MultimodalGeneration] Failed to process Audio for Gemini:', err);
        }
      }

      // [DOCS] PDF/Document Handling for Gemini: Download -> Upload -> Native PDF Understanding
      let docFileName: string | null = null;
      let docFileUri: string | null = null;

      // Detect PDF URL in promptStrings if not already found from fileData
      if (!docFileUri) {
        for (const p of promptParts) {
          if (typeof p === 'string') {
            const match = p.match(/(https?:\/\/[^\s]+?\.pdf)(\?.*)?$/i);
            // Verify it's not a youtube/audio link by accident, though regex handles extension
            if (match) docFileUri = match[1];
          } else if ((p as any).fileData?.fileUri && (p as any).fileData.mimeType?.includes('pdf')) {
            // If already fileData but points to external URL
            const uri = (p as any).fileData.fileUri;
            if (uri.startsWith('http') && !uri.includes('generativelanguage.googleapis.com')) {
              docFileUri = uri;
            }
          }
        }
      }

      if (docFileUri && typeof docFileUri === 'string' && docFileUri.startsWith('http')) {
        try {
          // 1. Download
          const response = await fetch(docFileUri);
          if (!response.ok) throw new Error("Failed to download PDF file");
          const buffer = Buffer.from(await response.arrayBuffer());

          // 2. Save temp
          const fs = await import('fs');
          const fsPromises = fs.promises || (fs as any).default?.promises;
          const path = await import('path');
          const os = await import('os');

          const joinPath = path.join || (path as any).default?.join;
          const tmpDir = os.tmpdir || (os as any).default?.tmpdir;

          if (!fsPromises || !joinPath || !tmpDir) throw new Error("System modules missing");

          const tempFilePath = joinPath(tmpDir(), `doc-gemini-${Date.now()}.pdf`);
          await fsPromises.writeFile(tempFilePath, new Uint8Array(buffer));

          // 3. Upload (application/pdf)
          const uploadResult = await gemini.uploadFile(tempFilePath, 'application/pdf', 'PDF Document');
          const uploadedDocUri = uploadResult.fileUri;
          docFileName = uploadResult.name;

          // Wait for file processing
          await gemini.waitForActiveFile(docFileName);

          // 4. Transform Prompt
          finalPromptParts = [
            ...finalPromptParts.map(p => typeof p === 'string' ? p.replace(docFileUri!, '') : p),
            {
              fileData: {
                fileUri: uploadedDocUri,
                mimeType: 'application/pdf'
              }
            }
          ];

          await fs.promises.unlink(tempFilePath);

        } catch (err: unknown) {
          console.error('[MultimodalGeneration] Failed to process PDF for Gemini:', err);
        }
      }

      try {
        try {
          aiResponse = await gemini.generateContentFromParts({
            model: modelToUse,
            promptParts: finalPromptParts,
            systemInstruction: MASTER_SYSTEM_PROMPT,
            generationConfig: {
              maxOutputTokens: 20000
            }
          });
        } finally {
          // [CLEANUP] Delete uploaded files from Gemini
          if (audioFileName) await gemini.deleteFile(audioFileName).catch((e: unknown) => console.error("Failed to cleanup Audio file:", e));
          if (docFileName) await gemini.deleteFile(docFileName).catch((e: unknown) => console.error("Failed to cleanup Document file:", e));
        }
      } catch (geminiError: unknown) {
        // Check if error is due to token limit (video too long)
        const geminiErrorMsg = geminiError instanceof Error ? geminiError.message : "";
        const isTokenLimitError = geminiErrorMsg.includes('token count exceeds') ||
          geminiErrorMsg.includes('maximum number of tokens') ||
          geminiErrorMsg.includes('400 Bad Request');

        if (isTokenLimitError && hasYouTubeUrl && youtubeUrl) {
          console.warn(`[MultimodalGeneration] Video too long for Gemini (token limit exceeded). Falling back to metadata extraction...`);

          // Fallback: Extract metadata using YouTube API/scraping, then generate with Gemini
          try {
            const { extractYouTubeMetadata, formatYouTubeMetadataForAI } = await import('@/lib/services/youtube/extractMetadata');
            const metadata = await extractYouTubeMetadata(youtubeUrl);

            if (metadata) {
              // Get instructions from promptParts
              const instructions = promptParts
                .filter((part) => typeof part === 'string')
                .join('\n\n');

              // Format metadata for AI
              const formattedPrompt = formatYouTubeMetadataForAI(metadata);

              // Lưu extractedContent (chỉ metadata, không có instructions) để trả về cho FE
              // Truncate để giảm token usage: description 1500 chars, transcript 3000 chars
              extractedContent = `=== THÔNG TIN VIDEO YOUTUBE ===\nTiêu đề: ${metadata.title}\n${metadata.channelName ? `Kênh: ${metadata.channelName}\n` : ''}${metadata.description ? `\nMô tả video:\n${metadata.description.substring(0, 1500)}${metadata.description.length > 1500 ? '...' : ''}\n` : ''}${metadata.transcript ? `\nTranscript (nội dung video):\n${metadata.transcript.substring(0, 3000)}${metadata.transcript.length > 3000 ? '...' : ''}\n` : ''}`;

              // Generate with Gemini using formatted metadata (text-only, no video)
              aiResponse = await gemini.generateContentFromParts({
                model: modelToUse,
                systemInstruction: MASTER_SYSTEM_PROMPT,
                promptParts: [formattedPrompt]
              });

            } else {
              // Last resort: use URL with instructions
              const instructions = promptParts
                .filter((part) => typeof part === 'string')
                .join('\n\n');
              const fallbackPrompt = `${instructions}\n\nNguồn video YouTube: ${youtubeUrl}\n\nLưu ý: Video quá dài để phân tích trực tiếp. Vui lòng tạo bài đăng dựa trên link này.`;

              aiResponse = await gemini.generateContentFromParts({
                model: modelToUse,
                systemInstruction: MASTER_SYSTEM_PROMPT,
                promptParts: [fallbackPrompt]
              });

              console.warn(`[MultimodalGeneration] Metadata extraction failed, using URL fallback`);
            }
          } catch (fallbackError) {
            console.error(`[MultimodalGeneration] Fallback metadata extraction failed:`, fallbackError);
            // Re-throw original error if fallback also fails
            throw geminiError;
          }
        } else {
          // Other errors - rethrow
          throw geminiError;
        }
      }
    }
  } catch (aiError: unknown) {
    console.error("[MultimodalGeneration] Content generation error:", aiError);
    // Don't deduct credits if generation failed
    return {
      error: JSON.stringify({
        error: "Content generation failed",
        message: aiError instanceof Error ? aiError.message : "Content generation failed",
        creditsDeducted: false
      }),
      status: 500
    };
  }



  // --- NEW VALIDATION STEP: Validate JSON before deducting credits ---
  // If AI returns garbage (not JSON), we should NOT charge the user.
  // Logic matches Client-side parsing to ensure consistency.

  let isValidResponse = false;
  let cleanJson = "";

  // 1. Try to find JSON block
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = aiResponse.match(codeBlockRegex);

  if (match && match[1]) {
    cleanJson = match[1].trim();
  } else {
    // Fallback: Check if the whole string is JSON array
    const trimmed = aiResponse.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      cleanJson = trimmed;
    }
  }

  if (cleanJson) {
    try {
      // Fix common JSON errors (trailing commas)
      cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1');

      // Fix unescaped control characters (like literal newlines) inside JSON strings
      // We only escape when we are inside a string value to avoid converting structural newlines into '\n' strings
      let inString = false;
      let escapedJson = '';
      for (let i = 0; i < cleanJson.length; i++) {
        const char = cleanJson[i];
        if (char === '"' && (i === 0 || cleanJson[i - 1] !== '\\')) {
          inString = !inString;
          escapedJson += char;
        } else if (inString && char === '\n') {
          escapedJson += '\\n';
        } else if (inString && char === '\r') {
          escapedJson += '\\r';
        } else if (inString && char === '\t') {
          escapedJson += '\\t';
        } else {
          escapedJson += char;
        }
      }
      let parsed;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (parseError) {
        console.warn("[MultimodalGeneration] JSON.parse failed, initiating fallback extraction...");

        // --- FALLBACK EXTRACTOR ---
        // If the LLM produced wildly unescaped double quotes inside strings, JSON.parse dies.
        // We bypass JSON syntax entirely by searching for structural keys and extracting everything in between.
        const fallbackPosts = [];
        const chunks = cleanJson.split(/"action"\s*:\s*"create_post"/g);

        for (let i = 1; i < chunks.length; i++) {
          const chunk = chunks[i];

          const platformMatch = chunk.match(/"platform"\s*:\s*"([^"]+)"/);
          if (!platformMatch) continue;
          const platform = platformMatch[1];

          const contentKeyMatch = chunk.match(/"content"\s*:\s*"/);
          if (!contentKeyMatch) continue;
          const contentStartIndex = contentKeyMatch.index! + contentKeyMatch[0].length;

          const summaryMatch = chunk.match(/"summary_for_chat"\s*:\s*"/);

          let contentEndIndex = -1;
          let summary = "";

          if (summaryMatch) {
            const textBeforeSummary = chunk.substring(0, summaryMatch.index);
            contentEndIndex = textBeforeSummary.lastIndexOf('"');

            const summaryStartIndex = summaryMatch.index! + summaryMatch[0].length;
            const nextEndBrace = chunk.indexOf('}', summaryStartIndex);
            const searchEnd = nextEndBrace !== -1 ? nextEndBrace : chunk.length;

            const summaryEndIndex = chunk.lastIndexOf('"', searchEnd);
            if (summaryEndIndex > summaryStartIndex) {
              summary = chunk.substring(summaryStartIndex, summaryEndIndex);
            }
          } else {
            const nextEndBrace = chunk.indexOf('}', contentStartIndex);
            const searchEnd = nextEndBrace !== -1 ? nextEndBrace : chunk.length;
            contentEndIndex = chunk.lastIndexOf('"', searchEnd);
          }

          if (contentEndIndex !== -1 && contentEndIndex > contentStartIndex) {
            let rawContent = chunk.substring(contentStartIndex, contentEndIndex);

            // Clean AI escaped format to actual text
            rawContent = rawContent.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            summary = summary.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

            fallbackPosts.push({
              action: "create_post",
              platform,
              content: rawContent,
              summary_for_chat: summary
            });
          }
        }

        parsed = fallbackPosts;
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        isValidResponse = true;
      }
    } catch (e) {
      console.warn("[MultimodalGeneration] JSON Parse Failed:", e);
    }
  }

  if (!isValidResponse) {
    console.error("[MultimodalGeneration] FAILED VALIDATION - AI Response is not valid JSON. Credits will NOT be deducted.");
    console.error("[MultimodalGeneration] Invalid Response Preview:", aiResponse.substring(0, 500));

    return {
      error: JSON.stringify({
        error: "AI Response Error",
        message: "Phản hồi của AI không đúng định dạng JSON. Vui lòng thử lại (không mất credit).",
        creditsDeducted: false
      }),
      status: 422 // Unprocessable Entity
    };
  }
  // ------------------------------------------------------------------

  // Deduct credits ONLY after successful generation - one per platform
  let latestCreditsRemaining = paywallResult.creditsRemaining ?? 0;
  for (let i = 0; i < platformList.length; i++) {
    const platform = platformList[i];
    const creditResult = await deductCredits(user.id, 'TEXT_ONLY', {
      model: modelToUse,
      sourceType: 'multimodal',
      partsCount: promptParts.length,
      platform,
      platforms: platformList.join(','),
      postIndex: i + 1,
      totalPlatforms: platformList.length
    }, { response: aiResponse });

    if (!creditResult.success) {
      // Should not happen since we checked paywall, but log anyway
      console.error(`[MultimodalGeneration] Failed to deduct credits for platform ${platform}:`, creditResult);
    } else {
      latestCreditsRemaining = creditResult.creditsLeft ?? latestCreditsRemaining;
    }
  }

  // Track usage - increment posts_created to reflect number of AI-generated posts
  // Increment by platformList.length since we're generating content for multiple platforms
  try {
    const month = getMonthStartDate(DEFAULT_TIMEZONE);
    await supabase.rpc('increment_usage', {
      p_user_id: user.id,
      p_month: month,
      p_field: 'posts_created',
      p_amount: platformList.length
    });
  } catch (usageErr: unknown) {
    console.warn('[MultimodalGeneration] increment_usage error (posts_created):', usageErr);
    // Non-fatal: continue
  }

  return {
    response: aiResponse,
    platforms: platformList,
    creditsRemaining: latestCreditsRemaining,
    message: `Generated content for ${platformList.length} platform(s)`,
    extractedContent: extractedContent // Trả về extracted content cho FE (nếu có)
  };
}

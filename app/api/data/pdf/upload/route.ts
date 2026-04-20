import { NextRequest } from 'next/server';
import { requireAuth } from "@/lib/auth";
import { success, fail } from "@/lib/response";

export async function POST(request: NextRequest) {
  // Add authentication
  const user = await requireAuth(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return fail('No file provided', 400);
    }

    // Kiểm tra file có phải PDF không
    if (file.type !== 'application/pdf') {
      return fail('File must be a PDF', 400);
    }

    // Kiểm tra kích thước file (giới hạn 20MB cho an toàn)
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_SIZE) {
      return fail('File size must be less than 20MB', 400);
    }

    // Lấy API key từ environment variable (server-side only)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ API Key not found! Please check .env.local file');
      return fail('API key not configured', 500);
    }

    // Chuyển File object thành ArrayBuffer
    const bytes = await file.arrayBuffer();

    // Upload file lên Gemini File API bằng REST API
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
    
    // Tạo metadata
    const metadata = {
      file: {
        display_name: file.name,
      }
    };

    // Upload file với multipart
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
    
    // Tạo multipart body
    const textEncoder = new TextEncoder();
    
    const parts: Uint8Array[] = [
      textEncoder.encode(`--${boundary}\r\n`),
      textEncoder.encode('Content-Type: application/json; charset=UTF-8\r\n\r\n'),
      textEncoder.encode(JSON.stringify(metadata) + '\r\n'),
      textEncoder.encode(`--${boundary}\r\n`),
      textEncoder.encode('Content-Type: application/pdf\r\n\r\n'),
      new Uint8Array(bytes),
      textEncoder.encode(`\r\n--${boundary}--\r\n`)
    ];
    
    // Tính tổng length
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    
    // Merge tất cả parts thành một Uint8Array
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'X-Goog-Upload-Protocol': 'multipart',
      },
      body: body
    });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload file thất bại: ${uploadResponse.status} ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        
    return success({
      fileUri: uploadResult.file.uri,
      fileName: uploadResult.file.displayName,
      mimeType: uploadResult.file.mimeType,
    });

  } catch (error) {
    console.error('Error uploading PDF to Gemini:', error);
    return fail(
      `Failed to upload PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

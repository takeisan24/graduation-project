import { NextRequest } from "next/server";
import { success, fail } from "@/lib/response";
import { withAuthOnly } from "@/lib/middleware/api-protected";
import { uploadFile, getPublicUrl } from "@/lib/services/storage/storageService";
import { createFile } from "@/lib/services/db/files";

export const runtime = 'edge'; // optional

export async function POST(req: NextRequest) {
  const auth = await withAuthOnly(req);
  if ('error' in auth) return auth.error;
  const { user } = auth;
  // Expect multipart/form-data. Next.js route in edge runtime supports formData
  const form = await req.formData();
  const file = form.get("file") as File;
  if (!file) return fail("file missing", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  
  // Determine bucket based on file type
  // Use 'uploads' bucket for all files (images, videos, etc.)
  // This is the default bucket that will be auto-created if it doesn't exist
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';
  const key = `${user.id}/${Date.now()}-${file.name}`;
  
  // Upload file via service layer
  const uploadResult = await uploadFile(bucket, key, buffer, {
    contentType: file.type,
    upsert: true
  });
  
  if (!uploadResult.success || !uploadResult.data) {
    return fail(uploadResult.error || "Failed to upload file", 500);
  }
  
  // Get public URL via service layer
  const publicURL = getPublicUrl(bucket, uploadResult.data.path);
  
  // Create file record via service layer
  const fileRow = await createFile({
    user_id: user.id,
    key: uploadResult.data.path,
    bucket,
    mime: file.type,
    size: buffer.length
  });
  
  if (!fileRow) {
    return fail("Failed to create file record in database", 500);
  }
  
  return success({ file: fileRow, publicURL }, 201);
}

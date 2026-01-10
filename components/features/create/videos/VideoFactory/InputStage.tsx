"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, Youtube, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { isValidYouTubeUrl, fetchYouTubeInfo, validateVideoFile, generateVideoThumbnail, getVideoDurationFromFile } from "@/lib/utils/videoUtils";
import { VideoSourceConfig } from "@/lib/types/video";
import { toast } from "sonner";
import { VIDEO_ERRORS, MEDIA_ERRORS } from "@/lib/messages/errors";
import { supabaseClient } from "@/lib/supabaseClient";

interface InputStageProps {
  onNext: (config: VideoSourceConfig) => void;
}

export function InputStage({ onNext }: InputStageProps) {
  const t = useTranslations('CreatePage.videoFactory');
  const [activeTab, setActiveTab] = useState<'youtube' | 'upload'>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [uploadedFile, setUploadedFile] = useState<File | undefined>(undefined);
  const [uploadThumbnail, setUploadThumbnail] = useState<string>('');
  const [uploadUrl, setUploadUrl] = useState<string>('');
  const [signedUrl, setSignedUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadDurationSec, setUploadDurationSec] = useState<number | null>(null);
  const [uploadStorageKey, setUploadStorageKey] = useState<string>('');
  const [uploadStorageBucket, setUploadStorageBucket] = useState<string>('');
  const [uploadedMediaAssetId, setUploadedMediaAssetId] = useState<string>(''); // ✅ FIX: Store media_asset_id for reuse

  // Media Library integration for selecting existing uploads
  interface MediaAsset {
    id: string;
    asset_type: string;
    public_url: string;
    thumbnail_url?: string | null;
    duration?: number | null;
    metadata?: any;
    source_type?: string; // ✅ FIX: Added validation field
  }

  const [libraryAssets, setLibraryAssets] = useState<MediaAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);

  // Format duration in seconds -> XmYs (e.g. 975s -> 16m15s)
  const formatDuration = (seconds?: number | null): string => {
    if (!seconds || seconds <= 0) return '0s';
    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    if (minutes <= 0) return `${secs}s`;
    return `${minutes}m${secs.toString().padStart(2, '0')}s`;
  };

  const handleYouTubeValidation = async () => {
    if (!youtubeUrl.trim()) {
      toast.error(VIDEO_ERRORS.YOUTUBE_URL_REQUIRED);
      return;
    }

    if (!isValidYouTubeUrl(youtubeUrl)) {
      toast.error(VIDEO_ERRORS.YOUTUBE_URL_INVALID);
      return;
    }

    setIsValidating(true);
    try {
      const info = await fetchYouTubeInfo(youtubeUrl);
      if (info) {
        setVideoInfo(info);
        toast.success(t('youtubeValidated') || 'Video YouTube hợp lệ!');
      } else {
        toast.error(VIDEO_ERRORS.YOUTUBE_FETCH_FAILED);
      }
    } catch (error) {
      toast.error(VIDEO_ERRORS.YOUTUBE_VALIDATION_ERROR);
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateVideoFile(file);
    if (!validation.valid) {
      toast.error(validation.error || VIDEO_ERRORS.INVALID_FILE);
      return;
    }

    setUploadedFile(file);
    setUploadedMediaAssetId(''); // ✅ FIX: Reset media_asset_id when selecting new file

    // Generate thumbnail for preview (no upload yet)
    try {
      const thumbnail = await generateVideoThumbnail(file);
      setUploadThumbnail(thumbnail);
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      setUploadThumbnail('');
    }

    // Get duration and validate (<= 60 minutes)
    try {
      const duration = await getVideoDurationFromFile(file);
      const maxSeconds = 60 * 60; // 60 minutes
      if (duration > maxSeconds) {
        toast.error('Video dài hơn 60 phút. Vui lòng chọn video ngắn hơn.');
        // Clear selected file when duration is too long
        setUploadedFile(undefined);
        setUploadThumbnail('');
        setUploadDurationSec(null);
        setUploadedMediaAssetId(''); // ✅ FIX: Reset media_asset_id when clearing file
        return;
      }
      setUploadDurationSec(Math.round(duration));
    } catch (err) {
      console.error('Cannot read video duration:', err);
      setUploadDurationSec(null);
    }
  };

  /**
   * Register uploaded video into media_assets (S3-backed) so Media Library can reuse it.
   * This only stores metadata; the file itself is already on S3.
   */
  const registerMediaAsset = async (accessToken: string, publicUrl: string, key: string, bucket: string) => {
    try {
      const res = await fetch('/api/media-assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          asset_type: 'video',
          public_url: publicUrl,
          storage_bucket: bucket,
          storage_key: key,
          thumbnail_url: uploadThumbnail || null,
          duration: uploadDurationSec ?? null,
          metadata: {
            kind: 'video_factory_input',
            original_filename: uploadedFile?.name,
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        console.warn('[InputStage] Failed to register media asset', json);
        return null; // ✅ FIX: Return null on error
      }

      // ✅ FIX: Save media_asset_id for reuse (enables 70% cost reduction)
      const assetId = json.data?.id || json.data?.asset?.id;
      if (assetId) {
        setUploadedMediaAssetId(assetId);
        console.log('[InputStage] Media asset registered successfully', { assetId });
        return assetId;
      }
      return null;
    } catch (error) {
      console.error('[InputStage] registerMediaAsset error:', error);
      // Không block flow Video Factory nếu chỉ lưu metadata thất bại
      return null;
    }
  };

  const handleFileUpload = async () => {
    if (!uploadedFile) return;
    if (uploadUrl) return; // Already uploaded

    // Request signed URL then PUT file
    setUploading(true);
    try {
      // Get authentication token
      const { data: { session } } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Vui lòng đăng nhập lại');
      }

      // Step 1: Request presigned URL from Server A using ONLY metadata (JSON)
      // This prevents "Payload Too Large" errors on Server A (Next.js/Nginx)
      const res = await fetch('/api/video-factory/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          filename: uploadedFile.name,
          contentType: uploadedFile.type || 'video/mp4',
          contentLength: uploadedFile.size,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        if (res.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        throw new Error(json?.error || 'Upload thất bại');
      }
      const signed = json.data?.signed_url;
      const publicUrl = json.data?.upload_url;
      const key = json.data?.key;
      const bucket = json.data?.bucket;
      if (!signed || !publicUrl || !key || !bucket) {
        throw new Error('Thiếu thông tin signed URL hoặc S3 key');
      }
      // PUT file to signed URL
      const putRes = await fetch(signed, {
        method: 'PUT',
        headers: {
          'Content-Type': uploadedFile.type || 'video/mp4',
        },
        body: uploadedFile,
      });
      if (!putRes.ok) {
        throw new Error('Upload S3 thất bại');
      }
      setUploadUrl(publicUrl);
      setSignedUrl(signed);
      setUploadStorageKey(key);
      setUploadStorageBucket(bucket);

      // Đăng ký vào media_assets để Media Library có thể hiển thị / tái sử dụng
      await registerMediaAsset(accessToken, publicUrl, key, bucket);

      toast.success(t('fileUploaded') || 'Đã tải file thành công!');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Upload thất bại, vui lòng thử lại');
      setUploadUrl('');
      setSignedUrl('');
      setUploadStorageKey('');
      setUploadStorageBucket('');
    } finally {
      setUploading(false);
    }
  };

  const handleNext = async () => {
    if (activeTab === 'youtube') {
      if (!videoInfo) {
        toast.warning(VIDEO_ERRORS.VALIDATE_YOUTUBE_FIRST);
        return;
      }
      onNext({
        type: 'youtube',
        youtubeUrl: youtubeUrl,
        youtubeThumbnail: videoInfo.thumbnail,
        youtubeTitle: videoInfo.title,
        videoDuration: videoInfo.duration
      });
    } else {
      if (!uploadedFile) {
        // Nếu chưa chọn file mới, thử dùng media từ thư viện
        if (!selectedLibraryId) {
          toast.warning(VIDEO_ERRORS.UPLOAD_FILE_FIRST);
          return;
        }
      }

      // Nếu user đã chọn video từ Media Library thì ưu tiên dùng video đó
      if (selectedLibraryId) {
        const asset = libraryAssets.find((a) => a.id === selectedLibraryId);
        if (!asset) {
          toast.warning('Media đã chọn không còn tồn tại, vui lòng tải lại Media Library.');
          return;
        }
        onNext({
          type: 'upload',
          uploadUrl: asset.public_url,
          youtubeThumbnail: asset.thumbnail_url || uploadThumbnail,
          youtubeTitle: asset.metadata?.title || uploadedFile?.name || 'Media Library Video',
          videoDuration: asset.duration ? `${asset.duration}s` : (uploadDurationSec ? `${uploadDurationSec}s` : undefined),
          // ✅ FIX: Send snake_case to match backend API convention (for Smart Lookup reuse)
          media_asset_id: asset.id,  // Changed from mediaAssetId for backend compatibility
        });
        return;
      }

      // Upload file nếu chưa upload lên S3
      if (!uploadUrl) {
        // Safety guard: ensure uploadedFile exists before we try to upload or pass it to next step
        if (!uploadedFile) {
          toast.warning('Vui lòng chọn video hoặc chọn từ Media Library trước khi tiếp tục.');
          return;
        }
        if (uploading) {
          toast.warning('Đang upload file, vui lòng chờ...');
          return;
        }
        await handleFileUpload();
        if (!uploadUrl) {
          // Upload failed - error toast already shown by handleFileUpload()
          return;
        }
      }

      onNext({
        type: 'upload',
        file: uploadedFile!, // ensured non-null above
        uploadUrl,
        youtubeThumbnail: uploadThumbnail,
        youtubeTitle: uploadedFile?.name || 'Uploaded Video',
        videoDuration: uploadDurationSec ? `${uploadDurationSec}s` : undefined,
        media_asset_id: uploadedMediaAssetId || undefined, // ✅ FIX: Send media_asset_id for transcript reuse (70% cost savings)
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">{t('inputStageTitle') || 'Chọn nguồn Video'}</h2>
        <p className="text-white/70">{t('inputStageDesc') || 'Tải lên file hoặc dán link YouTube'}</p>
      </div>

      {/* Tab Selector */}
      <div className="grid grid-cols-2 gap-4 p-1 bg-gray-900/50 rounded-lg">
        <button
          onClick={() => setActiveTab('youtube')}
          className={`py-3 px-4 rounded-md font-medium transition-all ${activeTab === 'youtube'
            ? 'bg-blue-500 text-white shadow-lg'
            : 'bg-transparent text-white/60 hover:text-white'
            }`}
        >
          <Youtube className="w-5 h-5 inline mr-2" />
          {t('youtubeTab') || 'YouTube Link'}
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`py-3 px-4 rounded-md font-medium transition-all ${activeTab === 'upload'
            ? 'bg-blue-500 text-white shadow-lg'
            : 'bg-transparent text-white/60 hover:text-white'
            }`}
        >
          <Upload className="w-5 h-5 inline mr-2" />
          {t('uploadTab') || 'Tải lên File'}
        </button>
      </div>

      {/* YouTube Tab Content */}
      {activeTab === 'youtube' && (
        <Card className="bg-[#180F2E] border-[#E33265]/50 p-6 space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-white">{t('youtubeUrlLabel') || 'URL Video YouTube'}</label>
            <div className="flex gap-2">
              <Input
                placeholder="https://youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="flex-1 bg-gray-900/50 border-white/20"
                onKeyDown={(e) => e.key === 'Enter' && handleYouTubeValidation()}
              />
              <Button
                onClick={handleYouTubeValidation}
                disabled={isValidating}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t('validate') || 'Kiểm tra'
                )}
              </Button>
            </div>
          </div>

          {/* YouTube Video Preview */}
          {videoInfo && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-start gap-4">
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="w-32 h-20 object-cover rounded"
                />
                <div className="flex-1">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-white line-clamp-2">{videoInfo.title}</h3>
                      <p className="text-sm text-white/60 mt-1">{videoInfo.channelTitle}</p>
                      <p className="text-sm text-white/60">⏱️ {videoInfo.duration}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Upload Tab Content */}
      {activeTab === 'upload' && (
        <>
          <Card className="bg-[#180F2E] border-[#E33265]/50 p-6">
            <div className="space-y-4">
              <label className="text-sm font-medium text-white">{t('uploadFileLabel') || 'Tải lên Video'}</label>

              {!uploadedFile ? (
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-blue-500/50 transition-colors bg-gray-900/30">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-12 h-12 text-white/40 mb-4" />
                    <p className="mb-2 text-sm text-white/70">
                      <span className="font-semibold">{t('clickToUpload') || 'Click để tải lên'}</span> {t('orDragDrop') || 'hoặc kéo thả'}
                    </p>
                    <p className="text-xs text-white/50">{t('supportedFormats') || 'MP4, MOV, AVI, MKV, WebM (tối đa 500MB)'}</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="video/*"
                    onChange={handleFileSelect}
                  />
                </label>
              ) : (
                <div className={`p-4 border rounded-lg ${uploadUrl ? 'bg-green-500/10 border-green-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                  <div className="flex items-start gap-4">
                    {uploadThumbnail && (
                      <img
                        src={uploadThumbnail}
                        alt="Video thumbnail"
                        className="w-32 h-20 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        {uploadUrl ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Upload className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h3 className="font-semibold text-white">{uploadedFile.name}</h3>
                          <p className="text-sm text-white/60 mt-1">
                            {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                          {uploadUrl ? (
                            <p className="text-xs text-green-400 mt-1">✓ Đã upload</p>
                          ) : uploading ? (
                            <p className="text-xs text-blue-400 mt-1">Đang upload...</p>
                          ) : (
                            <p className="text-xs text-blue-400 mt-1">Sẽ upload khi click "Tiếp tục"</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Clear currently selected upload file and preview
                        setUploadedFile(undefined);
                        setUploadThumbnail('');
                        setUploadUrl('');
                        setSignedUrl('');
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      {t('remove') || 'Xóa'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Media Library selector - always shown below upload card when in upload tab */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Hoặc chọn video từ Media Library</span>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10 text-xs"
                disabled={libraryLoading}
                onClick={async () => {
                  if (libraryLoaded) {
                    // Allow manual refresh
                    setLibraryLoaded(false);
                  }
                  try {
                    setLibraryLoading(true);
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    const accessToken = session?.access_token;
                    if (!accessToken) {
                      throw new Error('Unauthorized');
                    }
                    const res = await fetch('/api/media-assets?type=video&limit=50', {
                      headers: {
                        Authorization: `Bearer ${accessToken}`,
                      },
                      credentials: 'include',
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok || !json?.success) {
                      throw new Error(json?.error || 'Không thể tải Media Library');
                    }
                    const allAssets = json.data?.assets || [];

                    // ✅ FILTER: Only show uploaded videos (hide AI generated / cuts)
                    const filteredAssets = allAssets.filter((a: MediaAsset) =>
                      a.source_type === 'uploaded' ||
                      a.metadata?.kind === 'video_factory_input'
                    );

                    setLibraryAssets(filteredAssets);
                    setLibraryLoaded(true);
                  } catch (error: any) {
                    console.error('[InputStage] load Media Library error:', error);
                    toast.error(error?.message || 'Không thể tải Media Library');
                  } finally {
                    setLibraryLoading(false);
                  }
                }}
              >
                {libraryLoading ? 'Đang tải...' : (libraryLoaded ? 'Reload' : 'Tải Media Library')}
              </Button>
            </div>
            {libraryLoaded && libraryAssets.length === 0 && (
              <p className="text-xs text-white/60">Chưa có video nào trong Media Library.</p>
            )}
            {libraryLoaded && libraryAssets.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {libraryAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedLibraryId(asset.id)}
                    className={`text-left rounded-lg border p-2 bg-black/40 hover:bg-black/60 transition-colors ${selectedLibraryId === asset.id ? 'border-[#E33265] shadow-[0_0_0_1px_rgba(227,50,101,0.6)]' : 'border-white/10'
                      }`}
                  >
                    <div className="relative aspect-video bg-black/40 rounded mb-2 overflow-hidden">
                      {asset.thumbnail_url ? (
                        <img src={asset.thumbnail_url} alt="thumbnail" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50 text-xs">
                          No thumbnail
                        </div>
                      )}
                      {asset.duration ? (
                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                          {formatDuration(asset.duration)}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-white/70 line-clamp-2">
                      {asset.metadata?.title || asset.metadata?.original_filename || asset.public_url}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Next Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleNext}
          disabled={
            (activeTab === 'youtube' && !videoInfo) ||
            (activeTab === 'upload' && !selectedLibraryId && (!uploadedFile || uploading))
          }
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-8"
          size="lg"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Đang upload...
            </>
          ) : (
            <>
              {t('next') || 'Tiếp tục'} →
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

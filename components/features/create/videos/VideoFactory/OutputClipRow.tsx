import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Settings, Film, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OutputClipRowProps {
    clip: any;
    clipIndex: number;
    versionConfig: any;
    getAssetUrl: (assetId: string) => string | null;
    assetToken: string | null;
    onPreview: (clip: any) => void;
}

export function OutputClipRow({ clip, clipIndex, versionConfig, getAssetUrl, assetToken, onPreview }: OutputClipRowProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const normalizedStatus = (clip.status || '').toUpperCase();
    // ✅ Asset Gateway fallback:
    // - Cut clips may not include `url` in SSE payload (only `key`), but we can still play via `videoAssetId`.
    const resolvedVideoUrl = clip.url || (clip.videoAssetId ? getAssetUrl(clip.videoAssetId) : null);
    const isReady = normalizedStatus === 'READY' || normalizedStatus === 'DONE' || normalizedStatus === 'COMPLETED' || !!resolvedVideoUrl;
    const isProcessing = normalizedStatus === 'PROCESSING' || normalizedStatus === 'PENDING' || (!isReady && normalizedStatus !== 'FAILED');
    const isFailed = normalizedStatus === 'FAILED';

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!resolvedVideoUrl || isDownloading) return;

        try {
            setIsDownloading(true);
            const response = await fetch(resolvedVideoUrl, { mode: 'cors' });
            if (response.ok) {
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `maiovo-ai-${Date.now()}.mp4`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
                return;
            }
        } catch (error) {
            console.warn('Blob fetch failed, fallback to href', error);
        } finally {
            setIsDownloading(false);
        }

        // Fallback
        const link = document.createElement('a');
        link.href = resolvedVideoUrl;
        link.download = `maiovo-ai-${Date.now()}.mp4`;
        link.target = '_blank';
        link.click();
    };

    return (
        <Card className="bg-[#180F2E] border-[#E33265]/30 p-2 hover:border-[#E33265]/60 transition-colors group relative">
            <div className="flex gap-3">
                {/* Thumbnail */}
                <div
                    className="w-24 h-16 bg-black rounded overflow-hidden flex-shrink-0 relative cursor-pointer"
                    onClick={() => !isProcessing && !isFailed && onPreview({ ...clip, url: resolvedVideoUrl || clip.url })}
                >
                    {isProcessing ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800/50 text-white/60">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white/60 rounded-full animate-spin mb-1" />
                            <span className="text-[9px]">Xử lý...</span>
                        </div>
                    ) : isFailed ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-red-900/20 text-red-400">
                            <div className="text-xl mb-1">⚠️</div>
                            <span className="text-[9px]">Lỗi</span>
                        </div>
                    ) : (() => {
                        const thumbnailUrl = clip.thumbnailUrl || (clip.thumbnailAssetId ? getAssetUrl(clip.thumbnailAssetId) : null);
                        return thumbnailUrl ? (
                            <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20">
                                <Film className="w-5 h-5" />
                            </div>
                        );
                    })()}

                    {/* Play Overlay */}
                    {resolvedVideoUrl && !isProcessing && !isFailed && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-5 h-5 text-white drop-shadow-md" />
                        </div>
                    )}
                </div>

                {/* Info & Actions */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-white font-medium truncate pr-2">
                            {clip.title || `Clip ${clipIndex + 1}`}
                        </span>
                    </div>

                    <div className="flex items-end justify-between mt-1">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-white/50">{clip.duration ? `${clip.duration}s` : ''}</span>
                            {/* Badges */}
                            <div className="flex flex-wrap gap-1">
                                {versionConfig?.autoCaptions && <span className="text-[9px] text-blue-300">Sub</span>}
                                {versionConfig?.bRollInsertion && <span className="text-[9px] text-purple-300">B-roll</span>}
                            </div>
                        </div>

                        {/* Download Button */}
                        {resolvedVideoUrl && !isProcessing && !isFailed && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 border-white/20 bg-white/5 hover:bg-white/10 text-white"
                                onClick={handleDownload}
                                disabled={isDownloading}
                                title={clip.title || `Tải Clip ${clipIndex + 1}`}
                            >
                                {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}

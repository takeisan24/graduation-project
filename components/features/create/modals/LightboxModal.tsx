"use client";

import Image from 'next/image';

import { X as CloseIcon, Download } from 'lucide-react';
import { useCreateLightboxStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';


export default function LightboxModal() {
  const t = useTranslations('CreatePage.createSection.lightboxModal');
  // Lấy state và action từ store
  const { lightboxMedia, closeLightbox } = useCreateLightboxStore(useShallow(state => ({
    lightboxMedia: state.lightboxMedia,
    closeLightbox: state.closeLightbox,
  })));

  const { url, type } = lightboxMedia;

  const handleDownload = async () => {
    if (!url) return;

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `creatorhub-ai-${Date.now()}.${type === 'video' ? 'mp4' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success(t('downloadSuccess'));
    } catch (error) {
      console.error("Download error:", error);
      toast.error(t('downloadError'));
    }
  };

  // Nếu không có url, không render gì cả
  if (!url) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
      onClick={closeLightbox}
    >
      <div
        className="relative max-w-full max-h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-14 right-0 flex gap-3">
          <button
            className="bg-secondary backdrop-blur-sm hover:bg-secondary/80 rounded-lg px-4 py-2 text-foreground flex items-center gap-2 transition-all shadow-lg border border-border active:scale-95"
            onClick={handleDownload}
            aria-label="Tải xuống"
          >
            <Download className="w-5 h-5" />
            <span className="text-sm font-medium">Tải về</span>
          </button>

          <button
            className="bg-secondary backdrop-blur-sm hover:bg-secondary/80 rounded-lg p-2.5 text-foreground transition-all shadow-lg border border-border active:scale-95"
            onClick={closeLightbox}
            aria-label="Đóng"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {type === 'image' ? (
          <Image
            unoptimized
            src={url}
            alt="Ảnh phóng to"
            width={1600}
            height={900}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-border"
          />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            loop
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-border"
          />
        )}
      </div>
    </div>
  )
}

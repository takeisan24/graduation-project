import React from 'react';
import { X as CloseIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoPreviewOverlayProps {
    src: string;
    poster?: string;
    onClose: () => void;
}

export function VideoPreviewOverlay({ src, poster, onClose }: VideoPreviewOverlayProps) {
    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-5xl mx-4 bg-black rounded-xl overflow-hidden shadow-2xl border border-border"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="absolute top-4 right-4 z-20 rounded-full bg-black/50 text-white p-2 hover:bg-black/80 transition-colors backdrop-blur-md border border-border"
                    onClick={onClose}
                    aria-label="Đóng"
                >
                    <CloseIcon className="w-6 h-6" />
                </button>
                <div className="aspect-video w-full bg-black flex items-center justify-center">
                    <video
                        src={src}
                        poster={poster}
                        className="w-full h-full max-h-[85vh] object-contain"
                        controls
                        autoPlay
                    />
                </div>
            </div>
        </div>
    );
}

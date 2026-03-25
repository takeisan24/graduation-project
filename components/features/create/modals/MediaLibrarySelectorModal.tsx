"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    SearchIcon,
    Loader2,
    CheckCircle2,
    X,
    Play,
    Film,
    Image as ImageIcon,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
    useMediaLibraryModalStore,
    useCreateMediaStore,
    useCreatePostsStore,
    useCreateLightboxStore
} from "@/store";
import { useShallow } from 'zustand/react/shallow';
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { MediaAsset } from "@/store/shared/types";

/**
 * MediaLibrarySelectorModal - Allows users to pick multiple assets from their library
 * and add them to the current selected post.
 */
export default function MediaLibrarySelectorModal() {
    const t = useTranslations('CreatePage.createSection.mediaLibraryModal');
    const tCalendar = useTranslations('CreatePage.calendarSection');
    const { isMediaLibraryModalOpen, setIsMediaLibraryModalOpen } = useMediaLibraryModalStore();
    const selectedPostId = useCreatePostsStore(state => state.selectedPostId);
    const handleLibraryMediaSelect = useCreateMediaStore(state => state.handleLibraryMediaSelect);
    const openLightbox = useCreateLightboxStore(state => state.openLightbox);

    const [assets, setAssets] = useState<MediaAsset[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Fetch library assets when modal opens
    useEffect(() => {
        if (isMediaLibraryModalOpen) {
            fetchAssets();
        }
    }, [isMediaLibraryModalOpen]);

    const fetchAssets = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data: { session } } = await supabaseClient.auth.getSession();
            const accessToken = session?.access_token;
            if (!accessToken) throw new Error("Unauthorized");

            const res = await fetch("/api/media-assets", {
                headers: { Authorization: `Bearer ${accessToken}` },
                credentials: "include"
            });
            const json = await res.json();

            if (!res.ok || !json?.success) {
                throw new Error(json?.error || "Failed to load library");
            }

            const assets = (json.data?.assets || []) as MediaAsset[];
            setAssets(assets);
        } catch (err: any) {
            console.error("[MediaLibrarySelectorModal] fetch error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const meta = asset.metadata as any;
            const matchSearch = search ? (
                meta?.title?.toLowerCase().includes(search.toLowerCase()) ||
                meta?.kind?.toLowerCase().includes(search.toLowerCase())
            ) : true;

            const matchType = typeFilter === "all" ? true : asset.asset_type === typeFilter;

            return matchSearch && matchType;
        });
    }, [assets, search, typeFilter]);

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleAdd = () => {
        if (selectedIds.size === 0) return;
        if (!selectedPostId) {
            toast.error(t('selectPostFirst'));
            return;
        }

        const selectedAssets = assets.filter(asset => selectedIds.has(asset.id));
        handleLibraryMediaSelect(selectedAssets, selectedPostId);

        toast.success(tCalendar('addedMedia', { count: selectedIds.size }));
        handleClose();
    };

    const handleClose = () => {
        setIsMediaLibraryModalOpen(false);
        setSelectedIds(new Set());
        setSearch("");
        setTypeFilter("all");
    };

    const formatDuration = (seconds?: number | null) => {
        if (!seconds) return "";
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <Dialog open={isMediaLibraryModalOpen} onOpenChange={setIsMediaLibraryModalOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-background text-foreground border-border p-0">
                <DialogHeader className="p-6 pb-2 border-b border-border">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Film className="w-5 h-5 text-purple-400" />
                            Media Library
                        </DialogTitle>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                        <div className="relative flex-1">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder={t('searchPlaceholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 bg-card border-border h-10"
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-full sm:w-32 bg-card border-border h-10">
                                <SelectValue placeholder={t('all')} />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                                <SelectItem value="all">{t('all')}</SelectItem>
                                <SelectItem value="video">{t('video')}</SelectItem>
                                <SelectItem value="image">{t('image')}</SelectItem>
                                <SelectItem value="audio">{t('audio')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 pt-2 min-h-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <p>{t('loadingLibrary')}</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-64 text-red-400">
                            <p>{t('error', { error })}</p>
                            <Button variant="link" onClick={fetchAssets} className="mt-2 text-purple-400">{t('retry')}</Button>
                        </div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <Film className="w-12 h-12 mb-2 opacity-20" />
                            <p>{t('noMediaFound')}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <AssetSection
                                title="Text-to-Video"
                                assets={filteredAssets.filter(a => {
                                    const meta = a.metadata as any;
                                    return meta?.kind === 'text-to-video';
                                })}
                                selectedIds={selectedIds}
                                toggleSelection={toggleSelection}
                                openLightbox={openLightbox}
                                formatDuration={formatDuration}
                            />

                            <AssetSection
                                title="Scene-Video"
                                assets={filteredAssets.filter(a => {
                                    const meta = a.metadata as any;
                                    return meta?.kind === 'scene_video';
                                })}
                                selectedIds={selectedIds}
                                toggleSelection={toggleSelection}
                                openLightbox={openLightbox}
                                formatDuration={formatDuration}
                            />

                            <AssetSection
                                title="Hậu kỳ"
                                assets={filteredAssets.filter(a => {
                                    const meta = a.metadata as any;
                                    const kind = meta?.kind;
                                    // Logic fallback for output_clips
                                    // ✅ FIX: Exclude AUDIO from Hậu kỳ
                                    if (a.asset_type === 'audio') return false;

                                    if (kind === 'output_clip' || kind === 'postprocessed_clip') return true;
                                    if (!kind && (a.source_type === 'processed' || a.source_type === 'ai_generated') &&
                                        (meta?.step === 'postprocess' || meta?.jobType === 'broll_mux')) return true;
                                    // Default fallback for processed if no specific step match (generic processed)
                                    if (!kind && (a.source_type === 'processed' || a.source_type === 'ai_generated') && !meta?.step) return true;
                                    return false;
                                })}
                                selectedIds={selectedIds}
                                toggleSelection={toggleSelection}
                                openLightbox={openLightbox}
                                formatDuration={formatDuration}
                            />

                            <AssetSection
                                title="Cut clips"
                                assets={filteredAssets.filter(a => {
                                    const meta = a.metadata as any;
                                    const kind = meta?.kind;
                                    if (kind === 'short_cut_clip') return true;
                                    // Fallback for cut clips
                                    if (!kind && (a.source_type === 'processed' || a.source_type === 'ai_generated') &&
                                        meta?.step === 'cut') return true;
                                    return false;
                                })}
                                selectedIds={selectedIds}
                                toggleSelection={toggleSelection}
                                openLightbox={openLightbox}
                                formatDuration={formatDuration}
                            />

                            <AssetSection
                                title="Video uploaded"
                                assets={filteredAssets.filter(a => {
                                    // ✅ CRITICAL: Only allow video assets
                                    if (a.asset_type !== 'video') return false;

                                    const meta = a.metadata as any;
                                    const kind = meta?.kind;
                                    if (kind === 'video_factory_input') return true;
                                    // Fallback for uploaded
                                    if (!kind && a.source_type === 'uploaded') return true;
                                    return false;
                                })}
                                selectedIds={selectedIds}
                                toggleSelection={toggleSelection}
                                openLightbox={openLightbox}
                                formatDuration={formatDuration}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-2 border-t border-border sm:justify-between items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                        {selectedIds.size > 0 ? (
                            <span className="text-purple-400 font-semibold">{t('selectedCount', { count: selectedIds.size })}</span>
                        ) : (
                            t('selectMediaHint')
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleClose} className="border-border">
                            {t('cancel')}
                        </Button>
                        <Button
                            disabled={selectedIds.size === 0}
                            onClick={handleAdd}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {t('addToPost')}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Helper Component for Collapsible Sections
function AssetSection({
    title,
    assets,
    selectedIds,
    toggleSelection,
    openLightbox,
    formatDuration
}: {
    title: string;
    assets: MediaAsset[];
    selectedIds: Set<string>;
    toggleSelection: (id: string) => void;
    openLightbox: (url: string, type: 'image' | 'video') => void;
    formatDuration: (s?: number | null) => string;
}) {
    const [isOpen, setIsOpen] = useState(true);

    if (assets.length === 0) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between group cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-2">
                    <div className={`p-1 rounded transition-colors ${isOpen ? 'bg-purple-500/20 text-purple-400' : 'bg-secondary text-muted-foreground'}`}>
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
                        {title}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">({assets.length})</span>
                    </h3>
                </div>
                <div className="h-px flex-1 bg-secondary ml-4" />
            </div>

            {isOpen && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    {assets.map((asset) => {
                        const isSelected = selectedIds.has(asset.id);
                        const kind = (asset.metadata as any)?.kind;
                        const kindLabel = (() => {
                            if (kind) {
                                if (kind === 'video_factory_input') return 'video_factory_input';
                                if (kind === 'short_cut_clip') return 'short_cut_clip';
                                if (kind === 'output_clip' || kind === 'postprocessed_clip') return 'output_clips';
                                if (kind === 'text-to-video') return 'text-to-video'; // ✅ NEW: Branding
                                return kind;
                            }
                            if (asset.source_type === 'uploaded') return 'video_factory_input';
                            if (asset.source_type === 'processed' || asset.source_type === 'ai_generated') {
                                if (asset.metadata?.step === 'cut') return 'short_cut_clip';
                                if (asset.metadata?.step === 'postprocess' || asset.metadata?.jobType === 'broll_mux') return 'output_clips';
                                // Detect text-to-video from source_type and lack of video factory steps
                                if (asset.source_type === 'ai_generated') return 'text-to-video';
                                return 'output_clips';
                            }
                            return null;
                        })();

                        // ✅ FIX: Override label for Audio
                        const displayKindLabel = asset.asset_type === 'audio' ? 'audio_input' : kindLabel;

                        return (
                            <Card
                                key={asset.id}
                                className={`relative group bg-card border-2 overflow-hidden transition-all cursor-pointer ${isSelected ? "border-purple-500 ring-2 ring-purple-500/20" : "border-border hover:border-border"
                                    }`}
                                onClick={() => toggleSelection(asset.id)}
                            >
                                <div className="aspect-video relative bg-black">
                                    {asset.thumbnail_url || asset.metadata?.thumbnailUrl ? (
                                        <img
                                            src={asset.thumbnail_url || asset.metadata?.thumbnailUrl}
                                            alt="thumbnail"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            {asset.asset_type === 'video' ? <Film className="text-gray-700" /> : <ImageIcon className="text-gray-700" />}
                                        </div>
                                    )}

                                    {asset.duration && (
                                        <div className="absolute bottom-1 right-1 bg-black/70 text-[10px] px-1 rounded">
                                            {formatDuration(asset.duration)}
                                        </div>
                                    )}

                                    {/* Overlays */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 text-foreground"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openLightbox(asset.public_url, asset.asset_type === 'video' ? 'video' : 'image');
                                            }}
                                        >
                                            <Play className="w-4 h-4 fill-current" />
                                        </Button>
                                    </div>

                                    {/* Selection checkmark */}
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 z-10">
                                            <CheckCircle2 className="w-6 h-6 text-purple-500 bg-white rounded-full" />
                                        </div>
                                    )}
                                </div>

                                <div className="p-2 space-y-1">
                                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold truncate">
                                            {asset.asset_type}
                                        </span>
                                        {kindLabel && (
                                            <span className="text-[10px] text-purple-400 font-mono truncate">
                                                {displayKindLabel}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-foreground truncate font-medium">
                                        {asset.metadata?.title || asset.metadata?.original_filename || "Untitled"}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

"use client"

import { PlatformIcon } from "@/components/shared/PlatformIcon"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate, formatTime } from "@/lib/utils/date"
import type { PublishedPost } from "@/store/shared/types"
import { ExternalLink, Link2, SquareArrowOutUpRight, Trash2, X } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

interface PublishedDetailModalProps {
  open: boolean
  post: PublishedPost | null
  onOpenChange: (open: boolean) => void
  onOpenExternal: (url: string) => void
  onUnpublish?: (post: PublishedPost) => void
}

// Nền tảng KHÔNG hỗ trợ gỡ bài đã đăng qua API (theo Zernio).
const UNPUBLISH_UNSUPPORTED = ["instagram", "tiktok"]

// Nhận diện URL video để render <video> thay vì <img>.
const isVideoUrl = (u: string) => /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(u)

export function PublishedDetailModal({
  open,
  post,
  onOpenChange,
  onOpenExternal,
  onUnpublish
}: PublishedDetailModalProps) {
  const t = useTranslations("CreatePage.publishedSection")
  const tCard = useTranslations("CreatePage.postCard")
  const locale = useLocale()
  const canUnpublish = post?.platform ? !UNPUBLISH_UNSUPPORTED.includes(post.platform.toLowerCase()) : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex max-h-[88vh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden rounded-3xl border-border/80 bg-card p-0 shadow-2xl">
        {/* Header gọn */}
        <div className="shrink-0 border-b border-border/70 px-5 py-4 sm:px-6">
          <DialogHeader className="gap-0 text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background">
                  <PlatformIcon platform={post?.platform || "unknown"} size={20} variant="inline" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-xl font-semibold capitalize text-foreground">
                    {post?.platform || tCard("noContent")}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 truncate text-sm text-muted-foreground">
                    {t("detailDescription")}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {tCard("published")}
                </div>
                <DialogClose asChild>
                  <button className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={t("close")}>
                    <X className="h-5 w-5" />
                  </button>
                </DialogClose>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body — 2 cột NẰM NGANG: trái = meta + link, phải = nội dung (cuộn) */}
        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 sm:p-5 md:grid-cols-[230px_1fr]">
          {/* Cột trái */}
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t("platformLabel")}</p>
              <p className="mt-1 text-base font-semibold capitalize text-foreground">{post?.platform || "-"}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t("publishedAtLabel")}</p>
              <p className="mt-1 text-base font-semibold leading-6 text-foreground">
                {post?.time ? `${formatTime(post.time, locale)} ${formatDate(post.time, locale)}` : "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{t("accountLabel")}</p>
              <p className="mt-1 truncate text-base font-semibold text-foreground">{post?.profileName || "-"}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Link2 className="h-4 w-4 text-primary" />
                {t("linkLabel")}
              </div>
              <p className="mt-2 break-all text-xs leading-6 text-muted-foreground">{post?.url || t("noLink")}</p>
            </div>
          </div>

          {/* Cột phải: ảnh/video + nội dung (cùng vùng cuộn) */}
          <div className="flex min-h-0 flex-col rounded-2xl border border-border/70 bg-background/60 p-4 sm:p-5">
            <div className="mb-3 flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
              <SquareArrowOutUpRight className="h-4 w-4 text-primary" />
              {t("contentLabel")}
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {post?.media && post.media.length > 0 && (
                <div className={`grid gap-2 ${post.media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {post.media.map((m, i) =>
                    isVideoUrl(m) ? (
                      <video
                        key={i}
                        src={m}
                        controls
                        className="aspect-square w-full rounded-lg border border-border/60 bg-black/5 object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={m}
                        alt=""
                        loading="lazy"
                        className="aspect-square w-full rounded-lg border border-border/60 object-cover"
                      />
                    )
                  )}
                </div>
              )}
              <div className="whitespace-pre-wrap break-words text-[0.95rem] leading-7 text-foreground">
                {post?.content?.trim() || tCard("noContent")}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="shrink-0 border-t border-border/70 px-5 py-4 sm:justify-between sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
          <div className="flex gap-2">
            {canUnpublish && onUnpublish && post && (
              <Button
                variant="outline"
                className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onUnpublish(post)}
              >
                <Trash2 className="h-4 w-4" />
                {t('unpublishButton')}
              </Button>
            )}
            <Button
              className="gap-2"
              disabled={!post?.url}
              onClick={() => post?.url && onOpenExternal(post.url)}
            >
              <ExternalLink className="h-4 w-4" />
              {t("openPost")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

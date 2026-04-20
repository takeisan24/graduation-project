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
import { ExternalLink, Link2, SquareArrowOutUpRight, X } from "lucide-react"
import { useTranslations } from "next-intl"

interface PublishedDetailModalProps {
  open: boolean
  post: PublishedPost | null
  onOpenChange: (open: boolean) => void
  onOpenExternal: (url: string) => void
}

export function PublishedDetailModal({
  open,
  post,
  onOpenChange,
  onOpenExternal
}: PublishedDetailModalProps) {
  const t = useTranslations("CreatePage.publishedSection")
  const tCard = useTranslations("CreatePage.postCard")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-3xl overflow-hidden rounded-[28px] border-border/80 bg-card p-0 shadow-2xl">
        <div className="border-b border-border/70 px-7 py-6 sm:px-8">
          <DialogHeader className="gap-5 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background shadow-sm">
                  <PlatformIcon platform={post?.platform || "unknown"} size={22} variant="inline" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <DialogTitle className="truncate text-[1.9rem] leading-none font-semibold capitalize text-foreground">
                    {post?.platform || tCard("noContent")}
                  </DialogTitle>
                  <DialogDescription className="mt-2 max-w-[32rem] text-base leading-7 text-muted-foreground">
                    {t("detailDescription")}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-base font-medium text-emerald-700 dark:text-emerald-400">
                  {tCard("published")}
                </div>
                <DialogClose asChild>
                  <button className="mt-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={t("close")}>
                    <X className="h-5 w-5" />
                  </button>
                </DialogClose>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-7 py-6 sm:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-border/70 bg-background/70 p-5 min-h-[136px]">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {t("platformLabel")}
              </p>
              <p className="mt-3 text-[1.15rem] font-semibold capitalize text-foreground">
                {post?.platform || "-"}
              </p>
            </div>
            <div className="rounded-[24px] border border-border/70 bg-background/70 p-5 min-h-[136px]">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {t("publishedAtLabel")}
              </p>
              <p className="mt-3 text-[1.15rem] font-semibold leading-8 text-foreground">
                {post?.time ? `${formatTime(post.time)} ${formatDate(post.time)}` : "-"}
              </p>
            </div>
            <div className="rounded-[24px] border border-border/70 bg-background/70 p-5 min-h-[136px]">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {t("accountLabel")}
              </p>
              <p className="mt-3 truncate text-[1.15rem] font-semibold text-foreground">
                {post?.profileName || "-"}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-background/60 p-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <SquareArrowOutUpRight className="h-4 w-4 text-primary" />
              {t("contentLabel")}
            </div>
            <div className="max-h-[320px] overflow-y-auto whitespace-pre-wrap break-words text-[1.05rem] leading-8 text-foreground">
              {post?.content?.trim() || tCard("noContent")}
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-background/60 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Link2 className="h-4 w-4 text-primary" />
              {t("linkLabel")}
            </div>
            <p className="mt-3 break-all text-[1.02rem] leading-7 text-muted-foreground">
              {post?.url || t("noLink")}
            </p>
          </div>
        </div>

        <DialogFooter className="border-t border-border/70 px-7 py-5 sm:justify-between sm:px-8">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
          <Button
            className="gap-2"
            disabled={!post?.url}
            onClick={() => post?.url && onOpenExternal(post.url)}
          >
            <ExternalLink className="h-4 w-4" />
            {t("openPost")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

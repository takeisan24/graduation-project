"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlatformIcon } from "@/components/shared/PlatformIcon"
import { formatDate } from "@/lib/utils/date"
import { getPlatformColors } from "@/lib/constants/platformColors"
import { AlertTriangle, Eye, ExternalLink, Pencil, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

interface PostCardProps {
  post: {
    id: string
    platform?: string
    content?: string
    created_at?: string
    scheduled_at?: string
    error_message?: string
    status?: string
    media_urls?: string[]
    url?: string
  }
  variant: "draft" | "published" | "failed"
  onEdit?: () => void
  onDelete?: () => void
  onClick?: () => void
  onViewDetails?: () => void
  onOpenExternal?: () => void
  actionsDisabled?: boolean
  previewNote?: string
}

export default function PostCard({
  post,
  variant,
  onEdit,
  onDelete,
  onClick,
  onViewDetails,
  onOpenExternal,
  actionsDisabled = false,
  previewNote
}: PostCardProps) {
  const t = useTranslations("CreatePage.postCard")

  const content = post.content || t("noContent")
  const platform = post.platform || "unknown"
  const date = post.created_at ? formatDate(post.created_at) : ""
  const colors = getPlatformColors(platform)
  const isClickable = Boolean(onClick) && !actionsDisabled
  const statusLabel =
    variant === "draft"
      ? t("draft")
      : variant === "published"
        ? t("published")
        : t("failed")
  const statusBadgeClassName =
    variant === "failed"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : variant === "published"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        : "border-border/70 bg-muted/70 text-muted-foreground"

  return (
    <Card
      className={`group relative overflow-hidden bg-card ${colors.border} transition-all duration-200 ${isClickable ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg" : "cursor-default"} ${colors.tint} ${colors.darkTint}`}
      onClick={isClickable ? onClick : undefined}
    >
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${variant === "failed" ? "bg-gradient-to-r from-destructive to-destructive/50" : colors.dot}`} />

      <div className="p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/95 shadow-sm">
              <PlatformIcon platform={platform} size={18} variant="inline" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold capitalize text-foreground">{platform}</p>
              {date ? <p className="text-xs text-muted-foreground">{date}</p> : null}
            </div>
          </div>
          <Badge variant="outline" className={`shrink-0 ${statusBadgeClassName}`}>
            {statusLabel}
          </Badge>
        </div>

        <p className="mb-3 min-h-[3.75rem] text-sm leading-relaxed text-muted-foreground line-clamp-3">
          {content}
        </p>

        {variant === "failed" && post.error_message && (
          <Badge variant="destructive" className="mb-3 gap-1 text-xs font-normal">
            <AlertTriangle className="h-3 w-3" />
            <span className="line-clamp-1">{post.error_message}</span>
          </Badge>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
          {actionsDisabled && previewNote ? (
            <span className="text-xs text-muted-foreground">{previewNote}</span>
          ) : null}
          {variant === "draft" && !actionsDisabled && (
            <>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("edit")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("delete")}
              </Button>
            </>
          )}
          {variant === "failed" && !actionsDisabled && (
            <>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("edit")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={(e) => { e.stopPropagation(); onViewDetails?.(); }}
              >
                <Eye className="h-3.5 w-3.5" />
                {t("viewDetails")}
              </Button>
            </>
          )}
          {variant === "published" && !actionsDisabled && (
            <>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={(e) => { e.stopPropagation(); onViewDetails?.(); }}
              >
                <Eye className="h-3.5 w-3.5" />
                {t("viewDetails")}
              </Button>
              {post.url ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={(e) => { e.stopPropagation(); onOpenExternal?.(); }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("openLink")}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlatformIcon } from "@/components/shared/PlatformIcon"
import { formatDate } from "@/lib/utils/date"
import { getPlatformColors } from "@/lib/constants/platformColors"
import { Pencil, Trash2, RefreshCw, AlertTriangle } from "lucide-react"
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
  }
  variant: "draft" | "published" | "failed"
  onEdit?: () => void
  onDelete?: () => void
  onRetry?: () => void
  onClick?: () => void
}

export default function PostCard({ post, variant, onEdit, onDelete, onRetry, onClick }: PostCardProps) {
  const t = useTranslations("CreatePage.postCard")

  const content = post.content || t("noContent")
  const platform = post.platform || "unknown"
  const date = post.created_at ? formatDate(post.created_at) : ""
  const colors = getPlatformColors(platform)

  return (
    <Card
      className={`group relative overflow-hidden bg-card ${colors.border} hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer ${colors.tint} ${colors.darkTint}`}
      onClick={onClick}
    >
      {/* Platform color top border */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${variant === "failed" ? "bg-gradient-to-r from-destructive to-destructive/50" : colors.dot}`} />

      <div className="p-4">
        {/* Header: platform badge + date */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md ${colors.bg} flex items-center justify-center`}>
              <PlatformIcon platform={platform} size={14} />
            </div>
            <span className="text-xs font-medium capitalize">{platform}</span>
          </div>
          {date && <span className="text-xs text-muted-foreground">{date}</span>}
        </div>

        {/* Content preview */}
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mb-3 min-h-[3.75rem]">
          {content}
        </p>

        {/* Error badge for failed posts */}
        {variant === "failed" && post.error_message && (
          <Badge variant="destructive" className="mb-3 text-xs font-normal gap-1">
            <AlertTriangle className="h-3 w-3" />
            <span className="line-clamp-1">{post.error_message}</span>
          </Badge>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {variant === "draft" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("edit")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("delete")}
              </Button>
            </>
          )}
          {variant === "failed" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 text-utc-royal"
                onClick={(e) => { e.stopPropagation(); onRetry?.(); }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("retry")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("delete")}
              </Button>
            </>
          )}
          {variant === "published" && (
            <span className="text-xs text-success">
              {post.status === "posted" ? `✓ ${t("published")}` : post.status}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

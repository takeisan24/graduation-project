"use client";

import { Badge } from "@/components/ui/badge";

interface PreviewNoticeProps {
  badge: string;
  description: string;
  className?: string;
}

export default function PreviewNotice({ badge, description, className = "" }: PreviewNoticeProps) {
  return (
    <div className={`rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 ${className}`.trim()}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Badge variant="secondary" className="w-fit rounded-full border border-primary/20 bg-background/80 text-primary">
          {badge}
        </Badge>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

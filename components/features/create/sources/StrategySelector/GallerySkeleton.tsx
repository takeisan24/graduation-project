"use client";

export default function GallerySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[...Array(6)].map((_, index) => (
        <div
          key={index}
          className="p-4 rounded-lg border border-border bg-card animate-pulse"
        >
          <div className="flex items-start gap-3">
            {/* Icon placeholder */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted"></div>
            
            {/* Content placeholder */}
            <div className="flex-1 space-y-2">
              {/* Title */}
              <div className="h-4 bg-muted rounded w-3/4"></div>
              {/* Description line 1 */}
              <div className="h-3 bg-muted rounded w-full"></div>
              {/* Description line 2 */}
              <div className="h-3 bg-muted rounded w-5/6"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

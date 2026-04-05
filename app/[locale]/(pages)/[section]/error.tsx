'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('[SectionError]', error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-xl font-semibold tracking-tight">
          Đã xảy ra lỗi / Something went wrong
        </h2>
        <p className="text-muted-foreground text-sm">
          Không thể tải nội dung này.
          <br />
          Could not load this content.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button size="sm" onClick={reset}>
            Thử lại / Try again
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push('/')}>
            Về trang chủ / Go home
          </Button>
        </div>
      </div>
    </div>
  )
}

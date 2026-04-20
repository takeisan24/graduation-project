'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[RootError]', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-2xl font-semibold tracking-tight">
          Đã xảy ra lỗi / Something went wrong
        </h2>
        <p className="text-muted-foreground text-sm">
          Vui lòng thử lại hoặc tải lại trang.
          <br />
          Please try again or reload the page.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button onClick={reset}>
            Thử lại / Try again
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Tải lại / Reload
          </Button>
        </div>
      </div>
    </div>
  )
}

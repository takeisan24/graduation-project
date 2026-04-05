import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-bold text-muted-foreground/50">404</h1>
        <h2 className="text-xl font-semibold tracking-tight">
          Không tìm thấy trang / Page not found
        </h2>
        <p className="text-muted-foreground text-sm">
          Trang bạn tìm không tồn tại hoặc đã bị di chuyển.
          <br />
          The page you are looking for does not exist.
        </p>
        <div className="pt-2">
          <Button asChild>
            <Link href="/">Về trang chủ / Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

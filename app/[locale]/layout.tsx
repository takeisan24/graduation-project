import type React from "react"
import type { Metadata } from "next"

import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Toaster } from 'sonner'
import { ToastTranslationProvider } from '@/components/providers/ToastTranslationProvider'

import "./globals.css"


const fontSans = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-sans', display: 'swap' })
export const metadata: Metadata = {
  title: "CreatorHub: Hỗ trợ Lập kế hoạch & Sáng tạo Nội dung đa nền tảng bằng AI",
  description:
    "Biến một nguồn duy nhất thành hàng loạt nội dung đa phương tiện và lên lịch đăng bài chỉ trong vài phút.",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  }
}

export default async function RootLayout({
  children,
  params: { locale },
}: Readonly<{
  children: React.ReactNode,
  params: { locale: string }
}>) {

  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body className={`font-sans ${fontSans.variable}`}>
        <NextIntlClientProvider messages={messages}>
          <ToastTranslationProvider>
            <Suspense fallback={null}>
              {children}
            </Suspense>
            <Toaster theme="dark" richColors position="bottom-left" />
            {/* SILENCED: Disable debug mode to clean up console */}
            <Analytics debug={false} />
          </ToastTranslationProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

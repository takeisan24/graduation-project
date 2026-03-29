import type React from "react"
import type { Metadata } from "next"

import { Inter, Calistoga, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Toaster } from 'sonner'
import { ToastTranslationProvider } from '@/components/providers/ToastTranslationProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'

import "./globals.css"


const fontSans = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-sans', display: 'swap' })
const fontDisplay = Calistoga({ weight: '400', subsets: ['latin', 'vietnamese'], variable: '--font-display', display: 'swap' })
const fontMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })
export const metadata: Metadata = {
  title: {
    default: "CreatorHub — Đồ án tốt nghiệp | Hỗ trợ Sáng tạo Nội dung đa nền tảng bằng AI",
    template: "%s | CreatorHub",
  },
  description:
    "Hệ thống hỗ trợ lập kế hoạch và sáng tạo nội dung đa nền tảng mạng xã hội bằng Generative AI. Đồ án tốt nghiệp ngành CNTT — Trường Đại học Giao thông Vận tải (UTC).",
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/apple-icon.svg',
  },
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
    <html lang={locale} suppressHydrationWarning>
      <body className={`font-sans ${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider messages={messages}>
            <TooltipProvider>
              <ToastTranslationProvider>
                <Suspense fallback={null}>
                  {children}
                </Suspense>
                <Toaster richColors position="bottom-left" />
                <Analytics debug={false} />
              </ToastTranslationProvider>
            </TooltipProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

"use client"

import { useTranslations } from "next-intl"
import { XCircle } from "lucide-react"
import { Link } from "@/i18n/navigation"

export default function PaymentCancelPage() {
  const t = useTranslations("CreatePage.payment")

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
        <XCircle className="h-16 w-16 text-red-600 dark:text-red-400" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{t("cancelTitle")}</h1>
        <p className="text-muted-foreground">{t("cancelDesc")}</p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/settings"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("tryAgain")}
        </Link>
        <Link
          href="/create"
          className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium hover:bg-accent transition-colors"
        >
          {t("backToApp")}
        </Link>
      </div>
    </div>
  )
}

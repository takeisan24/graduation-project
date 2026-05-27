"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircle, Loader2 } from "lucide-react"
import { supabaseClient } from "@/lib/supabaseClient"
import { Link } from "@/i18n/navigation"

export default function PaymentSuccessPage() {
  const t = useTranslations("CreatePage.payment")
  const searchParams = useSearchParams()
  const orderCode = searchParams.get("orderCode")
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    if (!orderCode) {
      setStatus("success")
      return
    }

    const checkOrder = async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession()
        if (!session?.access_token) {
          setStatus("success")
          return
        }

        const res = await fetch(`/api/payment/check-order?orderCode=${orderCode}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (res.ok) {
          const { data } = await res.json()
          if (data?.status === "PAID") {
            setCredits(data.credits)
          }
        }
        setStatus("success")
      } catch {
        setStatus("success")
      }
    }

    checkOrder()
  }, [orderCode])

  if (status === "verifying") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">{t("verifying")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
        <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{t("successTitle")}</h1>
        <p className="text-muted-foreground">{t("successDesc")}</p>
        {credits && (
          <p className="text-lg font-semibold text-primary">
            {t("successCredits", { credits })}
          </p>
        )}
      </div>
      <Link
        href="/create"
        className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {t("backToApp")}
      </Link>
    </div>
  )
}

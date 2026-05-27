"use client"

import { useState } from "react"
import { CREDIT_PACKAGES } from "@/lib/constants/credit-packages"
import { supabaseClient } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { Sparkles, Zap, Crown, Rocket, Copy, Check, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const PACKAGE_ICONS = [Sparkles, Zap, Crown, Rocket] as const

const BANK_NAMES: Record<string, string> = {
  "970436": "Vietcombank",
  "970422": "MB Bank",
  "970407": "Techcombank",
  "970416": "ACB",
}

interface OrderData {
  qrUrl: string
  orderCode: number
  bankInfo: {
    bankBin: string
    accountNo: string
    accountName: string
    amount: number
    content: string
  }
  packageCredits: number
}

export default function CreditTopUp() {
  const t = useTranslations("CreatePage.payment")
  const [loading, setLoading] = useState<string | null>(null)
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const getSession = async () => {
    const { data: { session } } = await supabaseClient.auth.getSession()
    return session
  }

  const handlePurchase = async (packageId: string) => {
    setLoading(packageId)
    try {
      const session = await getSession()
      if (!session?.access_token) {
        toast.error(t("loginRequired"))
        return
      }

      const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)

      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ packageId }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || t("createOrderFailed"))
      }

      const { data } = await res.json()
      setOrderData({ ...data, packageCredits: pkg?.credits ?? 0 })
    } catch (err) {
      const message = err instanceof Error ? err.message : t("unknownError")
      toast.error(message)
    } finally {
      setLoading(null)
    }
  }

  const handleConfirmPayment = async () => {
    if (!orderData) return
    setConfirming(true)
    try {
      const session = await getSession()
      if (!session?.access_token) {
        toast.error(t("loginRequired"))
        return
      }

      const res = await fetch("/api/payment/confirm-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ orderCode: orderData.orderCode }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || t("unknownError"))
      }

      const { data } = await res.json()
      if (data?.status === "PAID") {
        toast.success(t("successCredits", { credits: data.credits }))
        setOrderData(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("unknownError")
      toast.error(message)
    } finally {
      setConfirming(false)
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const CopyButton = ({ value, field }: { value: string; field: string }) => (
    <button
      onClick={() => copyToClipboard(value, field)}
      className="ml-2 p-1 rounded hover:bg-accent transition-colors"
    >
      {copiedField === field
        ? <Check className="h-3.5 w-3.5 text-green-500" />
        : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("description")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CREDIT_PACKAGES.map((pkg, index) => {
          const Icon = PACKAGE_ICONS[index] || Sparkles
          const isPopular = pkg.id === "popular"

          return (
            <div
              key={pkg.id}
              className={`relative rounded-xl border p-5 text-center space-y-3 transition-all hover:shadow-md ${
                isPopular
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {isPopular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-0.5 rounded-full">
                  {t("popular")}
                </span>
              )}

              <Icon className="h-8 w-8 mx-auto text-primary" />

              <div>
                <p className="text-2xl font-bold">{pkg.credits}</p>
                <p className="text-xs text-muted-foreground">credits</p>
              </div>

              <p className="text-xl font-semibold text-primary">
                {pkg.priceVND.toLocaleString("vi-VN")}&#8363;
              </p>

              <p className="text-xs text-muted-foreground">
                {Math.round(pkg.priceVND / pkg.credits).toLocaleString("vi-VN")}&#8363;/credit
              </p>

              <button
                onClick={() => handlePurchase(pkg.id)}
                disabled={loading !== null}
                className={`w-full rounded-lg py-2.5 px-4 text-sm font-medium transition-colors ${
                  isPopular
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === pkg.id ? t("processing") : t("buyNow")}
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t("paymentNote")}
      </p>

      <Dialog open={!!orderData} onOpenChange={(open) => !open && setOrderData(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("qrTitle")}</DialogTitle>
          </DialogHeader>

          {orderData && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={orderData.qrUrl}
                  alt="VietQR"
                  className="w-64 h-64 rounded-lg border"
                />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-muted-foreground">{t("qrBank")}</span>
                  <span className="font-medium">
                    {BANK_NAMES[orderData.bankInfo.bankBin] || orderData.bankInfo.bankBin}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-muted-foreground">{t("qrAccount")}</span>
                  <div className="flex items-center">
                    <span className="font-medium">{orderData.bankInfo.accountNo}</span>
                    <CopyButton value={orderData.bankInfo.accountNo} field="account" />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-muted-foreground">{t("qrName")}</span>
                  <span className="font-medium">{orderData.bankInfo.accountName}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-muted-foreground">{t("qrAmount")}</span>
                  <div className="flex items-center">
                    <span className="font-medium text-primary">
                      {orderData.bankInfo.amount.toLocaleString("vi-VN")}&#8363;
                    </span>
                    <CopyButton value={String(orderData.bankInfo.amount)} field="amount" />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-muted-foreground">{t("qrContent")}</span>
                  <div className="flex items-center">
                    <span className="font-mono font-medium text-xs">{orderData.bankInfo.content}</span>
                    <CopyButton value={orderData.bankInfo.content} field="content" />
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {t("qrNote")}
              </p>

              <button
                onClick={handleConfirmPayment}
                disabled={confirming}
                className="w-full rounded-lg bg-primary py-3 px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {confirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("confirmingPayment")}
                  </span>
                ) : (
                  t("confirmPayment")
                )}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

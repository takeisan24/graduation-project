"use client"

import Image from "next/image"
import { useState } from "react"
import { useSWRConfig } from "swr"
import { CREDIT_PRESETS, CREDIT_UNIT_PRICE_VND, MIN_CREDITS, MAX_CREDITS, computeCreditAmount } from "@/lib/constants/credit-packages"
import { supabaseClient } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { Copy, Check, Loader2, Coins } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  const { mutate } = useSWRConfig()
  const [loading, setLoading] = useState(false)
  const [creditAmount, setCreditAmount] = useState<number>(100)
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const isValidAmount = Number.isFinite(creditAmount) && creditAmount >= MIN_CREDITS && creditAmount <= MAX_CREDITS
  const totalPrice = computeCreditAmount(isValidAmount ? creditAmount : 0)

  const getSession = async () => {
    const { data: { session } } = await supabaseClient.auth.getSession()
    return session
  }

  const handlePurchase = async () => {
    if (!isValidAmount) return
    setLoading(true)
    try {
      const session = await getSession()
      if (!session?.access_token) {
        toast.error(t("loginRequired"))
        return
      }

      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ credits: creditAmount }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || t("createOrderFailed"))
      }

      const { data } = await res.json()
      setOrderData({ ...data, packageCredits: data?.credits ?? creditAmount })
    } catch (err) {
      const message = err instanceof Error ? err.message : t("unknownError")
      toast.error(message)
    } finally {
      setLoading(false)
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
        // Làm mới số dư credit hiển thị ở thanh công cụ (useDashboardUsage dùng key /api/usage)
        // revalidate: true để force-bypass dedupingInterval, tránh SWR bỏ qua fetch sau payment
        void mutate("/api/usage", undefined, { revalidate: true })
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
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }).catch(() => toast.error(t("unknownError")))
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

      {/* Mua credit theo số tự do (mô hình trả theo dùng) */}
      <div className="rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Coins className="h-4 w-4 text-primary" />
          {t("creditAmountLabel")}
        </div>

        {/* Preset nhanh */}
        <div className="flex flex-wrap gap-2">
          {CREDIT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setCreditAmount(preset)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                creditAmount === preset
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Nhập số tự do */}
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={MIN_CREDITS}
            max={MAX_CREDITS}
            value={Number.isFinite(creditAmount) ? creditAmount : ""}
            onChange={(e) => setCreditAmount(Math.floor(Number(e.target.value)))}
            className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-lg font-semibold text-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
          />
          <span className="text-sm text-muted-foreground">{t("creditsUnit")}</span>
        </div>

        {/* Giá realtime */}
        <div className="flex items-baseline justify-between border-t border-border/60 pt-3">
          <span className="text-sm text-muted-foreground">
            {CREDIT_UNIT_PRICE_VND.toLocaleString("vi-VN")}{t("perCredit")}
          </span>
          <span className="text-2xl font-bold text-primary">
            {totalPrice.toLocaleString("vi-VN")}&#8363;
          </span>
        </div>

        {!isValidAmount && (
          <p className="text-xs text-destructive">{t("creditRangeHint", { min: MIN_CREDITS, max: MAX_CREDITS })}</p>
        )}

        <button
          onClick={handlePurchase}
          disabled={loading || !isValidAmount}
          className="w-full rounded-lg bg-primary py-3 px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t("processing") : t("buyCredits", { credits: isValidAmount ? creditAmount : 0 })}
        </button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t("paymentNote")}
      </p>

      <Dialog open={!!orderData} onOpenChange={(open) => !open && setOrderData(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("qrTitle")}</DialogTitle>
            <DialogDescription>{t("qrNote")}</DialogDescription>
          </DialogHeader>

          {/* Disclaimer học thuật: QR + STK là thật nhưng thanh toán được MÔ PHỎNG cho đồ án */}
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {t("demoNotice")}
          </p>

          {orderData && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Image
                  src={orderData.qrUrl}
                  alt="VietQR"
                  width={256}
                  height={256}
                  className="rounded-lg border"
                  unoptimized
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
                    <span className="font-mono font-medium text-xs break-all max-w-[140px] text-right">{orderData.bankInfo.content}</span>
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

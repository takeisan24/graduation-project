"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, ExternalLink, Loader2, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabaseClient } from "@/lib/supabaseClient";

interface PaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any; // Using any for now, ideally strictly typed
  onSuccess?: () => void;
}

import { useLocale } from "next-intl";

export default function PaymentConfirmationModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: PaymentConfirmationModalProps) {
  /* 
    Updated to use Real OnePay QR Code based on API
  */
  const [loadingQR, setLoadingQR] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isProcessingOnePay, setIsProcessingOnePay] = useState(false); // UI Lock State
  const [isVerifying, setIsVerifying] = useState(false); // Verification after paid state detected
  const [paymentSuccess, setPaymentSuccess] = useState(false); // Success State
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const locale = useLocale();

  // Hardcoded Beneficiary Info
  const beneficiaryName = "CONG TY TNHH CONG NGHE SO MAIOVO";
  const bankName = "TPBANK - Ngân hàng Tiên phong";

  const lastFetchedOrderId = useRef<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (order?.id && isOpen) {
      // Prevent refetching if we already fetched for this order
      // This solves the issue where switching tabs/apps causes revalidation -> new order object ref -> new fetch -> new txnRef
      if (lastFetchedOrderId.current === order.id && qrCodeUrl) {
          // Already have QR for this order, start polling but don't re-fetch QR
      } else {
        // New order or first load
        fetchQR();
      }
      
      // Always poll if open
      // Polling Logic: Check DB every 3s. Check OnePay directly every 6s (every 2nd tick).
      let tickCount = 0;
      intervalId = setInterval(async () => {
         tickCount++;
         
         // 1. Check DB first (Fastest)
         const { data, error } = await supabaseClient
          .from("orders")
          .select("status")
          .eq("id", order.id)
          .single();

        if (data && (data.status === "paid" || data.status === "completed")) {
          clearInterval(intervalId);
          setIsVerifying(true);
          // Simulate short delay for "Verifying" UX
          setTimeout(() => {
              setIsVerifying(false);
              setPaymentSuccess(true);
              if (onSuccess) onSuccess();
          }, 1500);
          return;
        }

        // 2. Active QueryDR Check (Every 6 seconds - 2 ticks)
        // This is crucial for Localhost where IPN doesn't reach, or if IPN is delayed.
        if (tickCount % 2 === 0) {
            try {
                // Call our own API which calls OnePay and updates DB
                await fetch('/api/payment/onepay/query-dr', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order.id })
                });
                // Note: We don't check result here, we let the next DB poll pick it up
            } catch (err) {
                // Silent fail on background check
                console.log("Background QueryDR failed", err);
            }
        }
      }, 3000);
    }
    
    // Helper function moved inside to access deps or use useCallback
    async function fetchQR() {
        if (!order?.id) return;
        lastFetchedOrderId.current = order.id; // Mark as fetched
        
        try {
          setLoadingQR(true);
          setQrCodeUrl("");

          const res = await fetch("/api/payment/onepay/get-qr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: order.id,
              // amount: order.total_amount, // REMOVED: Managed by Backend
              locale,
            }),
          });
          
          if (!res.ok) throw new Error("Failed to fetch QR");

          const data = await res.json();
          // ... (same parsing logic)
          if (data.qrData) {
            let qrString = data.qrData;
            // Logic to determine if it's an Image (Base64 PNG) or Content (Text)
            
            if (qrString.length < 1000) {
               try {
                  const cleaned = qrString.replace(/-/g, "+").replace(/_/g, "/");
                  const decoded = atob(cleaned);
                  if (decoded.startsWith("00")) qrString = decoded;
               } catch (e) { console.log(e); }
               setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrString)}`);
            } else {
                // Base64 Image
                let prefix = "data:image/png;base64,";
                if (!qrString.startsWith("data:image")) {
                    setQrCodeUrl(`${prefix}${qrString}`);
                } else {
                    setQrCodeUrl(qrString);
                }
            }
          }
        } catch (e: any) {
          console.error("Error fetching QR:", e);
          toast.error("Không thể tải mã QR thanh toán.");
          // Reset ref so we can try again if user re-opens
          lastFetchedOrderId.current = null;
        } finally {
          setLoadingQR(false);
        }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [order?.id, isOpen, locale]);

  // ... (keeping other handlers)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã sao chép vào bộ nhớ tạm");
  };

  const handlePayWithOnePay = async () => {
    if (!order) return;

    setIsProcessingOnePay(true); // Lock UI

    try {
      // Call API to get Payment URL (Redirect Method)
      const res = await fetch("/api/payment/onepay/create-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          // amount: order.total_amount, // REMOVED
          locale: locale,
        }),
      });

      const data = await res.json();

      if (data.url) {
        // Redirect to OnePay Gateway (Full Page)
        // Note: This might be redundant if user scans QR, but kept as alternative
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Không thể tạo liên kết thanh toán.");
        setIsProcessingOnePay(false);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Lỗi kết nối: " + e.message);
      setIsProcessingOnePay(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          if (!isProcessingOnePay && !isCheckingStatus && !paymentSuccess && !isVerifying) {
            onClose();
          } else if (paymentSuccess) {
             onClose();
          }
        }
      }}
    >
      <DialogContent className="max-w-2xl bg-[#0C0717] border border-white/10 shadow-2xl p-0 overflow-hidden flex flex-col md:flex-row relative w-[95vw] md:w-full rounded-xl md:rounded-lg max-h-[90vh] md:max-h-none overflow-y-auto md:overflow-visible">
        
        {/* VERIFYING STATE */}
        {isVerifying ? (
          <div className="w-full flex flex-col items-center justify-center p-12 text-center text-white h-[400px]">
             <Loader2 className="w-12 h-12 mb-6 animate-spin text-[#E33265]" />
             <h3 className="text-xl font-bold mb-2">Đang xác thực giao dịch...</h3>
             <p className="text-gray-400 text-sm max-w-ws">Hệ thống đang kiểm tra kết quả từ OnePay. Vui lòng chờ trong giây lát.</p>
          </div>
        ) : paymentSuccess ? (
          <div className="w-full flex flex-col items-center justify-center p-8 md:p-12 text-center space-y-6 relative bg-gradient-to-br from-[#0C0717] to-[#1A0F30]">
             {/* Background Decoration */}
             <div className="absolute inset-0 overflow-hidden pointer-events-none">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
             </div>

            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-2 ring-1 ring-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                <CheckCircle2 className="w-12 h-12 text-green-500 animate-in zoom-in duration-500" />
            </div>
            
            <div className="space-y-2">
                <h2 className="text-2xl md:text-3xl font-bold text-white">Thanh toán thành công!</h2>
                <div className="text-gray-300 text-sm md:text-base max-w-md mx-auto">
                    Chúc mừng bạn đã nâng cấp gói <span className="text-[#E33265] font-bold">{order.plan_name}</span> thành công.
                </div>
            </div>

            {/* Receipt Card */}
            <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-xl p-4 gap-4 flex flex-col backdrop-blur-sm">
                <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                    <span className="text-gray-400">Mã đơn hàng</span>
                    <span className="font-mono text-white">{order.order_number}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                    <span className="text-gray-400">Gói dịch vụ</span>
                    <span className="font-semibold text-white">{order.plan_name}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                    <span className="text-gray-400">Thời hạn</span>
                    <span className="text-white">{order.billing_cycle === 'yearly' ? '12 tháng' : '1 tháng'}</span>
                </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Credit nhận được</span>
                    <span className="font-bold text-yellow-400 flex items-center gap-1">
                        + {order.billing_cycle === 'yearly' ? '12 x ' : ''}{new Intl.NumberFormat('vi-VN').format(order.credits_amount || 0)} Credits
                    </span>
                </div>
            </div>

            <Button 
                onClick={onClose}
                className="bg-[#E33265] hover:bg-[#c92a56] text-white min-w-[200px] h-11 rounded-full text-base font-medium shadow-lg hover:shadow-[#E33265]/25 transition-all mt-4"
            >
                Bắt đầu sử dụng
            </Button>
          </div>
        ) : (
          <>
        {/* LOCK OVERLAY */}
        {(isProcessingOnePay || isCheckingStatus) && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-white animate-in fade-in duration-200">
            <Loader2 className="w-10 h-10 mb-4 animate-spin text-[#E33265]" />
            <p className="font-semibold text-lg">Đang xử lý...</p>
            <p className="text-sm text-white/60 mt-1">
              Vui lòng không tắt trình duyệt
            </p>
          </div>
        )}

        {/* Left Side: Order Info & QR */}
        <div className="flex-1 p-4 md:p-6 md:border-r border-white/10 flex flex-col gap-4 md:gap-6">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-[#E33265] flex items-center justify-center text-white text-xs md:text-sm flex-shrink-0">
                1
              </span>
              Quét mã QR để thanh toán
            </h3>
            <p className="text-xs md:text-sm text-gray-400 mt-1 pl-8 md:pl-10">
              Sử dụng ứng dụng ngân hàng / Ví điện tử
            </p>
          </div>

          <div className="flex justify-center bg-white p-3 md:p-4 rounded-xl min-h-[200px] flex-col items-center">
            {/* QR Code Display */}
            {loadingQR ? (
              <div className="flex flex-col items-center justify-center h-40 md:h-48 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-[#E33265]" />
                <span className="text-xs">Đang tải mã QR...</span>
              </div>
            ) : qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="VietQR"
                className="w-40 h-40 md:w-48 md:h-48 object-contain"
              />
            ) : (
              <div className="w-40 h-40 md:w-48 md:h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-xs text-center p-2">
                Không thể tải mã QR
                <br />
                Vui lòng thử lại
              </div>
            )}
          </div>

          <div className="text-center text-[10px] md:text-xs text-gray-500">
            Mã QR được tạo tự động từ OnePay.
            <br />
            Hệ thống sẽ tự động xác nhận khi thanh toán thành công.
          </div>
        </div>

        {/* Right Side: Details & Actions */}
        <div className="flex-1 p-4 md:p-6 flex flex-col bg-[#1A0F30] gap-4 md:gap-0">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-bold text-white">
              Thông tin đơn hàng
            </h3>
            <button
              onClick={onClose}
              disabled={isProcessingOnePay}
              className="p-1 rounded-full hover:bg-white/10 transition-colors disabled:opacity-0"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Section 1: Total Amount */}
          <div className="mb-4 md:mb-6 pb-4 md:pb-6 border-b border-dashed border-white/10">
            <div className="text-xs md:text-sm text-gray-400 mb-1">
              Tổng số tiền
            </div>
            <div className="text-2xl md:text-3xl font-bold text-[#E33265]">
              {new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
              }).format(order.total_amount)}
            </div>
          </div>

          {/* Section 2: Beneficiary Info */}
          <div className="mb-4 md:mb-6 pb-4 md:pb-6 border-b border-dashed border-white/10 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs text-gray-400">Ngân hàng thụ hưởng</div>
                <div className="text-sm font-semibold text-white">
                  {bankName}
                </div>
              </div>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs text-gray-400">Tên người thụ hưởng</div>
                <div className="text-sm font-semibold text-white">
                  {beneficiaryName}
                </div>
              </div>
              <button
                onClick={() => handleCopy(beneficiaryName)}
                className="text-xs text-[#E33265] hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Sao chép
              </button>
            </div>
          </div>

          {/* Section 3: Order Info */}
          <div className="flex-1 space-y-3 mb-4 md:mb-6">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-400">Mã đơn hàng</div>
                <div className="text-sm font-semibold text-white">
                  {order.order_number}
                </div>
              </div>
              <button
                onClick={() => handleCopy(order.order_number)}
                className="text-xs text-[#E33265] hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <div>
              <div className="text-xs text-gray-400">Gói dịch vụ</div>
              <div className="text-sm font-semibold text-white">
                {order.plan_name}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Nội dung chuyển khoản</div>
              <div className="bg-black/30 p-2 rounded border border-white/10 text-xs md:text-sm font-mono text-yellow-400 break-all">
                Thanh toan don hang {order.order_number}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-auto space-y-3 pb-2 md:pb-0">
            <Button
              className="w-full bg-gradient-to-r from-[#E33265] to-[#ef4444] hover:from-[#c92a56] hover:to-[#dc2626] text-white h-11 md:h-12 shadow-lg shadow-[#E33265]/20 font-semibold text-base transition-all duration-300 hover:scale-[1.02]"
              onClick={handlePayWithOnePay}
              disabled={isProcessingOnePay}
            >
              <ExternalLink className="w-5 h-5 mr-2" /> Pay with Visa, ATM, QR...
            </Button>


          </div>
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

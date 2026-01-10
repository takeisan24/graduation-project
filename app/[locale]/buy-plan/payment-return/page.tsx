'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Confetti from 'react-confetti';
import { Loader2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { TransactionDebugModal } from '@/components/features/create/modals/TransactionDebugModal';
import { useTranslations } from 'next-intl';

export default function PaymentReturnPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('BuyPlan.paymentReturn');
  
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  // Display fields
  const txnRef = searchParams.get('vpc_MerchTxnRef');
  const orderInfo = searchParams.get('vpc_OrderInfo'); // e.g., "Order <UUID>"
  
  // Try to parse Order ID from OrderInfo if not in params
  let orderId = searchParams.get('orderId');
  if (!orderId && orderInfo) {
      const match = orderInfo.match(/Order\s+([a-f0-9-]+)/i);
      if (match) {
          orderId = match[1];
      }
  }
  // Fallback for display only (avoid using this for logic if possible)
  const displayId = orderId || txnRef;

  const amount = searchParams.get('amount') || searchParams.get('vpc_Amount');
  const transactionNo = searchParams.get('transactionNo') || searchParams.get('vpc_TransactionNo');
  
  const hasFetched = useRef(false);

  useEffect(() => {
    // Prevent double-fetch in React Strict Mode
    if (hasFetched.current) return;
    hasFetched.current = true;

    // 1. Collect all params
    const params: any = {};
    searchParams.forEach((value, key) => {
        params[key] = value;
    });

    // 2. Call Verify API
    const verifyPayment = async () => {
        try {
            const res = await fetch('/api/payment/onepay/verify-return', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });
            const data = await res.json();

            if (data.isValid) {
                setVerified(true);
                if (data.success) {
                    setSuccess(true);
                    setOrderData(data.order);
                    setShowConfetti(true);
                } else {
                    setSuccess(false);
                }
            } else {
                setVerified(false);
                setErrorMsg(t('invalidData'));
            }
        } catch (e) {
            console.error(e);
            setErrorMsg(t('failedMessage'));
        } finally {
            setLoading(false);
        }
    };

    if (searchParams.toString()) {
        verifyPayment();
    } else {
        setLoading(false);
        setErrorMsg(t('invalidData'));
    }

    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
  }, [searchParams]);


  const [orderData, setOrderData] = useState<any>(null);

  // ... (useEffect logic updates orderData)

  if (loading) {
      return (
          <div className="min-h-screen bg-[#1A0F30] flex flex-col items-center justify-center text-white">
              <Loader2 className="w-12 h-12 animate-spin text-[#E33265] mb-4" />
              <p className="text-lg font-medium">{t('verifying')}</p>
              <p className="text-white/40 text-sm">{t('waitSecurely')}</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#1A0F30] flex items-center justify-center p-4">
        {showConfetti && <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={500} />}
        
        <div className="bg-[#0C0717] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center relative shadow-2xl">
            {verified && success ? (
                <>
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-300">
                        <CheckCircle2 className="w-10 h-10 text-green-400" />
                    </div>
                    
                    <h2 className="text-3xl font-bold text-white mb-2">{t('success')}</h2>
                    <p className="text-white/60 mb-8">{t('creditsAdded')}</p>

                    <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-3">
                         <div className="flex justify-between">
                            <span className="text-white/60 text-sm">Mã đơn hàng</span>
                            <span className="text-white font-mono text-sm">{displayId}</span>
                        </div>
                        {orderData && (
                            <>
                                <div className="flex justify-between items-center border-t border-white/10 pt-3">
                                    <span className="text-white/60 text-sm">Gói dịch vụ</span>
                                    <span className="text-white font-semibold">{orderData.plan_name}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-white/60 text-sm">Số tiền</span>
                                    <span className="text-white font-semibold">
                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(orderData.amount)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-white/60 text-sm">Credits cộng thêm</span>
                                    <span className="text-[#E33265] font-bold">+{orderData.credits_amount}</span>
                                </div>
                            </>
                        )}
                        <div className="flex justify-between items-center border-t border-white/10 pt-3">
                            <span className="text-white/60 text-sm">Mã giao dịch</span>
                            <span className="text-white/40 text-xs font-mono">{transactionNo}</span>
                        </div>
                    </div>

                    <button 
                        onClick={() => router.push('/create')}
                        className="w-full bg-[#E33265] hover:bg-[#c52b57] text-white font-bold py-3 rounded-xl transition mb-4"
                    >
                        {t('backToHome')}
                    </button>
                    
                    {/* <TransactionDebugModal 
                        orderId={displayId || ''} 
                        txnRef={txnRef || ''} 
                        params={Object.fromEntries(searchParams.entries())}
                    /> */}
                </>
            ) : (
                <>
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="w-10 h-10 text-red-500" />
                    </div>
                    
                    <h2 className="text-3xl font-bold text-white mb-2">{t('failed')}</h2>
                    <p className="text-white/60 mb-8">{errorMsg || t('failedMessage')}</p>

                    <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-white/60 text-sm">Order ID</span>
                            <span className="text-white font-mono text-sm">{displayId}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-white/60 text-sm">Ref ID</span>
                            <span className="text-white font-mono text-sm">{txnRef}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-white/60 text-sm">Số tiền</span>
                            <span className="text-white font-mono text-sm">
                                {amount ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount)/100) : '---'}
                            </span>
                        </div>
                    </div>

                    <button 
                        onClick={() => router.push('/buy-plan')}
                        className="w-full bg-[#E33265] hover:bg-[#c52b57] text-white font-bold py-3 rounded-xl transition mb-3"
                    >
                        {t('backToHome')}
                    </button>

                     <button 
                        onClick={() => {
                            // Retry with specific order if available
                            const idToRetry = orderData?.id || displayId;
                            if (idToRetry) {
                                router.push(`/buy-plan?retryOrder=${idToRetry}`);
                            } else {
                                router.push('/buy-plan');
                            }
                        }}
                        className="w-full bg-white/5 hover:bg-white/10 text-white font-medium py-3 rounded-xl transition"
                    >
                        {t('tryAgain')}
                    </button>
                    
                    <div className="mt-4">
                        {/* <TransactionDebugModal 
                            orderId={displayId || ''} 
                            txnRef={txnRef || ''} 
                            params={Object.fromEntries(searchParams.entries())}
                        /> */}
                    </div>
                </>
            )}
        </div>
    </div>
  );
}

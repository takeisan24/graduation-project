'use client';

import { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import CreateLayout from "@/components/features/create/layout/CreateLayout"
import { useNavigationStore } from "@/store"
import { useAuth } from "@/hooks/useAuth"
import { useCreditsStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { useLocale, useTranslations } from 'next-intl';
import PaymentConfirmationModal from '@/components/features/create/modals/PaymentConfirmationModal';

// EXCHANGE_RATE removed, moved to state


interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  credits_monthly: number;
  credits_yearly: number;
  tier_level: number;
  features: string[];
}

interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  maxDiscountAmount: number | null;
}

export default function BuyPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const locale = useLocale();
  const t = useTranslations('BuyPlan');
  
  // Format Price Helper
  const formatPrice = (amount: number) => {
    if (locale === 'vi') {
      // DB stores USD, so convert to VND for Vietnamese users
      return Math.round(amount * exchangeRate).toLocaleString('vi-VN') + 'đ';
    }
    // For other locales, display USD directly (DB value)
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // Connect to Global Store for Sync
  const { currentPlan: storePlanSlug, refreshCredits } = useCreditsStore(useShallow((state) => ({
    currentPlan: state.currentPlan,
    refreshCredits: state.refreshCredits,
  })));

  // State
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>(searchParams.get('plan') || '');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [exchangeRate, setExchangeRate] = useState(24000); // Default fallback

  // Sync plan and billing from URL & Handle Payment Callbacks
  useEffect(() => {
    // 1. Sync Plan/Billing Params
    const planParam = searchParams.get('plan');
    if (planParam) {
      setSelectedPlan(planParam);
    }
    
    const billingParam = searchParams.get('billing');
    if (billingParam === 'monthly' || billingParam === 'yearly') {
      setBillingCycle(billingParam);
    }

    // 2. Handle OnePay Status Params
    const statusParam = searchParams.get('status');
    const retryOrderId = searchParams.get('retryOrder');

    if (statusParam === 'success') {
      // Trigger Success Modal
      refreshCredits(true); // Sync store
      
      // Reconstruct success data from URL params (passed by backend)
      const amountParam = searchParams.get('amount');
      const planSlugParam = searchParams.get('plan');
      const planNameParam = searchParams.get('plan_name');
      const creditsParam = searchParams.get('credits');
      
      setSuccessData({
        amount: amountParam ? parseFloat(amountParam) : 0,
        planName: planNameParam || planSlugParam || 'Unknown Plan',
        credits: creditsParam ? parseInt(creditsParam) : 0,
        currency: 'VND'
      });
      
      // Clear Coupon & sensitive state on success
      setAppliedCoupon(null);
      setCouponCode('');
      
      setShowSuccessModal(true);
      toast.success(t('successModal.title'));
      
      // Clear params to clean URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

    } else if (statusParam === 'failed') {
      const reason = searchParams.get('reason');
      // Show Error Modal - Store raw reason or null
      setErrorData({
        reason: reason
      });
      setShowErrorModal(true);
      
      // Clear params
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    // 3. Handle Retry Order
    if (retryOrderId && user) {
        const fetchRetryOrder = async () => {
             const { data: orderData, error } = await supabaseClient
                .from('orders')
                .select('*')
                .eq('id', retryOrderId)
                .eq('user_id', user.id)
                .single();
            
            if (orderData && (orderData.status === 'pending' || orderData.status === 'failed')) {
                setCurrentOrder(orderData);
                setShowQRModal(true);
            } else if (error) {
                console.error("Error fetching retry order:", error);
                toast.error("Không tìm thấy đơn hàng để thử lại.");
            }
        };
        fetchRetryOrder();
    }
    
  }, [searchParams, user, refreshCredits, t]);

  // Monthly Credit Check (Lazy Grant)
  useEffect(() => {
    if (!user) return;

    const checkMonthlyGrant = async () => {
        try {
            const res = await fetch(`/api/subscription/grant-monthly?userId=${user.id}`);
            const data = await res.json();
            
            if (data.success && data.granted) {
                toast.success(`Đã cộng thêm ${data.creditsAdded} credits tháng mới!`);
                refreshCredits(true); // Sync store with new balance
            }
        } catch (error) {
            console.error("Error checking monthly grant:", error);
        }
    };

    checkMonthlyGrant();
  }, [user, refreshCredits]);

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Create full return URL with params
      const currentUrl = window.location.href; // This works in client component
      // We can also construct it: /buy-plan?plan=...
      // But passing the full URL is safer if we change routes. 
      // However, we need to pass a relative path or absolute path. 
      // SignInPage logic uses router.push(redirectUrl). 
      // If we pass absolute URL (http...), router.push might treat it as external? 
      // Next.js router.push handles absolute URLs too if they are same origin.
      // Let's use relative path for safety: 
      const returnPath = window.location.pathname + window.location.search;
      router.push(`/signin?redirect=${encodeURIComponent(returnPath)}`);
    }
  }, [authLoading, isAuthenticated, router]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [loading, setLoading] = useState(true);

  // MOCK PAYMENT STATE
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  
  // Payment Error Modal State
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorData, setErrorData] = useState<any>(null);


  // Fetch plans from database
  useEffect(() => {
    async function fetchPlans() {
      try {
        console.log('Fetching plans...');
        const { data, error } = await supabaseClient
          .from('plans')
          .select('*')
          .eq('is_active', true)
          .neq('slug', 'free')
          .order('tier_level');

        if (error) {
          console.error('Supabase fetch error:', error);
          toast.error(`Failed to load plans: ${error.message} (${error.code})`);
          throw error;
        }

        console.log('Plans fetched:', data);
        if (data) setPlans(data);
      } catch (error: any) {
        console.error('Error fetching plans:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);
  // Fetch Exchange Rate
  useEffect(() => {
    async function fetchExchangeRate() {
      try {
        const res = await fetch('/api/exchange-rate');
        const data = await res.json();
        if (data && data.rate) {
          setExchangeRate(data.rate);
        }
      } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
      }
    }
    fetchExchangeRate();
  }, []);

  // Get selected plan details
  const currentPlan = plans.find(p => p.slug === selectedPlan);
  const price = billingCycle === 'yearly' 
    ? currentPlan?.price_yearly 
    : currentPlan?.price_monthly;
  const credits = billingCycle === 'yearly'
    ? currentPlan?.credits_yearly
    : currentPlan?.credits_monthly;

  // Calculate discount
  const subtotal = price || 0;
  let discountAmount = 0;
  
  if (appliedCoupon) {
    if (appliedCoupon.discountType === 'percentage') {
      discountAmount = (subtotal * appliedCoupon.discountValue) / 100;
      if (appliedCoupon.maxDiscountAmount && discountAmount > appliedCoupon.maxDiscountAmount) {
        discountAmount = appliedCoupon.maxDiscountAmount;
      }
    } else {
      discountAmount = appliedCoupon.discountValue;
    }
  }

  const total = Math.max(0, subtotal - discountAmount);

  // Validate coupon
  async function handleApplyCoupon() {
    if (!couponCode.trim()) {
      toast.error(t('coupon.placeholder'));
      return;
    }

    setIsValidatingCoupon(true);
    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode,
          planSlug: selectedPlan,
          billingCycle,
        }),
      });

      const data = await response.json();

      if (data.valid) {
        setAppliedCoupon(data.coupon);
        toast.success(t('coupon.success'));
      } else {
        toast.error(data.message || t('coupon.invalid'));
      }
    } catch (error) {
      toast.error(t('coupon.error'));
    } finally {
      setIsValidatingCoupon(false);
    }
  }

  // Remove coupon
  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponCode('');
  }

  // Create order mock
  const [showQRModal, setShowQRModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);

  // 1. Initial Click -> Create Order -> Show Payment Modal
  async function handleProceedToPayment() {
    if (!user) {
        router.push('/signin');
        return;
    }
    
    setIsCreatingOrder(true);
    try {
        // Prepare customer info
        const customerInfo = {
             name: user.user_metadata?.full_name || user.email?.split('@')[0],
             email: user.email,
             phone: user.phone || '',
        };

        // Call Secure Backend API to Create Order
        const response = await fetch('/api/payment/create-order', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                 planSlug: selectedPlan,
                 billingCycle: billingCycle,
                 couponCode: appliedCoupon?.code,
                 customerInfo: customerInfo,
                 userId: user.id,
                 paymentMethod: 'onepay' // Or 'vnpay' if you add a toggle
             })
        });

        const data = await response.json();

        if (!response.ok) {
             throw new Error(data.error || 'Failed to create order');
        }

        // Backend now handles Everything (Price calc, Order Insert)
        // We just receive the Order Object (or Order ID) to show confirmation
        
        // We need to shape the data to match what the Modal expects or what state uses
        // The API returns { success, orderId, paymentUrl, orderDetails, ... }
        // Ideally we fetch the full order or construct a partial object for the modal

        // For now, let's fetch the full order to be safe and consistent with previous logic
        const { data: orderData, error: fetchError } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('id', data.orderUuid) // API returns orderUuid
            .single();
        
        if (fetchError || !orderData) throw new Error("Could not fetch created order details");

        setCurrentOrder(orderData);
        setShowQRModal(true); 

    } catch (error: any) {
        console.error('Order creation error:', error);
        toast.error("Không thể tạo đơn hàng: " + error.message);
    } finally {
        setIsCreatingOrder(false);
    }
  }

  // 2. Success Callback from Modal
  const handlePaymentSuccess = async () => {
    // Payment verified by modal. Now refresh UI.
    setShowQRModal(false);
    
    // Refresh credits
    await refreshCredits(true);

    // Show Success Modal
    setSuccessData({
        amount: total,
        planName: currentPlan ? t(`plans.${currentPlan.slug}.name`, { defaultValue: currentPlan.name }) : '',
        credits: billingCycle === 'yearly' ? currentPlan?.credits_yearly : currentPlan?.credits_monthly
    });
    setShowSuccessModal(true);
    toast.success(t('successModal.title'));
  }


  const { isSidebarOpen, setIsSidebarOpen } = useNavigationStore();

  // Calculate yearly savings
  const yearlySavings = currentPlan 
    ? Math.round(((currentPlan.price_monthly * 12 - currentPlan.price_yearly) / (currentPlan.price_monthly * 12) * 100))
    : 0;

  if (loading) {
    return (
      <CreateLayout
        activeSection="settings" // Highlight settings or keep neutral
        onSectionChange={() => {}} // No-op for buy plan page
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={setIsSidebarOpen}
      >
        <div className="min-h-screen bg-gradient-to-br from-[#1A0F30] to-[#2A2A30] flex items-center justify-center">
          <div className="text-white text-xl">{t('loading')}</div>
        </div>
      </CreateLayout>
    );
  }

  return (
    <CreateLayout
      activeSection=""
      onSectionChange={() => {}}
      isSidebarOpen={isSidebarOpen}
      onSidebarToggle={setIsSidebarOpen}
    >
      <div className="h-full overflow-y-auto bg-gradient-to-br from-[#1A0F30] to-[#2A2A30] py-12 px-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="max-w-6xl mx-auto pb-20">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {t('title')}
            </h1>
            <p className="text-white/60 text-lg">
              {t('subtitle')}
            </p>
          </div>

          {!plans.length ? (
            <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
              <h3 className="text-xl text-white font-semibold mb-2">{t('noPlans.title')}</h3>
              <p className="text-white/60">{t('noPlans.description')}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-[#E33265] text-white rounded-lg hover:bg-[#E33265]/90 transition"
              >
                {t('noPlans.retry')}
              </button>
            </div>
          ) : (
            <>
              {/* Billing Toggle */}
              <div className="flex justify-center mb-12">
                <div className="bg-white/5 p-1 rounded-xl inline-flex">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-6 py-2 rounded-lg transition ${
                      billingCycle === 'monthly'
                        ? 'bg-[#E33265] text-white'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {t('billing.monthly')}
                  </button>
                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-6 py-2 rounded-lg transition relative ${
                      billingCycle === 'yearly'
                        ? 'bg-[#E33265] text-white'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {t('billing.yearly')}
                    {yearlySavings > 0 && (
                      <span className="absolute -top-3 -right-3 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {t('billing.save', { percent: yearlySavings })}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-8">
                {/* Left: Plans */}
                <div className="lg:col-span-2 space-y-4">
                  {plans.map((plan) => {
                     // Get current plan tier
                     // Use storePlanSlug for instant reactivity to Debug Modal / Sidebar changes
                     const currentPlanSlug = storePlanSlug || 'free';
                     const currentPlanDetails = plans.find(p => p.slug === currentPlanSlug);
                     const currentTier = currentPlanDetails?.tier_level || 0;

                     // LOGIC: Disable downgrades, enable Agency repurchase
                     const isCurrentPlan = plan.slug === currentPlanSlug;
                     const isLowerTier = plan.tier_level < currentTier;
                     const isAgency = plan.slug === 'agency';
                     
                     let isDisabled = false;
                     let statusText = "";

                     if (isLowerTier) {
                        isDisabled = true;
                        statusText = t('planStatus.higherTier');
                     } else if (isCurrentPlan && !isAgency) {
                        isDisabled = true;
                        statusText = t('planStatus.current');
                     }
                     
                     if (isAgency) {
                        isDisabled = false; 
                        statusText = isCurrentPlan ? t('planStatus.renewAgency') : "";
                     }

                     // Handler for plan selection with coupon reset
                     const handlePlanSelect = (slug: string) => {
                       setSelectedPlan(slug);
                       if (appliedCoupon) {
                         setAppliedCoupon(null);
                         setCouponCode('');
                         // toast.info(t('coupon.removed'));
                       }
                     };

                     return (
                    <div
                      key={plan.id}
                      onClick={() => !isDisabled && handlePlanSelect(plan.slug)}
                      className={`relative bg-white/5 backdrop-blur-lg rounded-2xl p-6 transition border-2 ${
                        isDisabled ? 'opacity-50 cursor-not-allowed border-white/5' : 'cursor-pointer'
                      } ${
                        selectedPlan === plan.slug && !isDisabled
                          ? 'border-[#E33265] bg-[#E33265]/10'
                          : isDisabled ? '' : 'border-white/10 hover:border-[#E33265]/50'
                      }`}
                    >
                      {isDisabled && (
                          <div className="absolute top-4 right-4 text-xs font-semibold bg-white/10 px-2 py-1 rounded text-white/50">
                              {statusText}
                          </div>
                      )}
                      
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-2xl font-bold text-white mb-2">
                            {t(`plans.${plan.slug}.name`, { defaultValue: plan.name })}
                          </h3>
                          <p className="text-white/60 mb-4">
                            {t(`plans.${plan.slug}.description`, { defaultValue: plan.description })}
                          </p>
                          
                          {billingCycle === 'yearly' ? (
                             <div>
                                {/* Comparison Section */}
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-white/40 line-through text-sm">
                                        {formatPrice(plan.price_monthly * 12)}
                                    </span>
                                    <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded">
                                        {t('billing.save', { percent: Math.round(((plan.price_monthly * 12 - plan.price_yearly) / (plan.price_monthly * 12)) * 100) })}
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-white">
                                        {formatPrice(plan.price_yearly / 12)}
                                    </span>
                                    <span className="text-white/60 text-sm">/mo</span>
                                </div>
                                <p className="text-xs text-white/40 mt-1">
                                    {t('billing.billedYearly', { price: formatPrice(plan.price_yearly) })}
                                </p>
                             </div>
                          ) : (
                             <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-bold text-white">
                                    {formatPrice(plan.price_monthly)}
                                </span>
                                <span className="text-white/60 text-sm">/mo</span>
                             </div>
                          )}

                          <div className="mt-4 pt-4 border-t border-white/10 text-[#E33265] font-semibold flex items-center gap-2">
                            <span className="text-lg">{billingCycle === 'yearly' ? plan.credits_yearly : plan.credits_monthly}</span>
                            <span className="text-sm opacity-80">Credits / {billingCycle === 'yearly' ? t('billing.yearly') : t('billing.monthly')}</span>
                          </div>
                        </div>
                        {selectedPlan === plan.slug && !isDisabled && (
                          <div className="w-6 h-6 rounded-full bg-[#E33265] flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                 })}
                </div>

                {/* Right: Coupon & Summary */}
                <div className="space-y-6">
                  {/* Coupon Input */}
                  <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">{t('coupon.title')}</h3>
                    {!appliedCoupon ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder={t('coupon.placeholder')}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-white/40"
                        />
                        <button
                          onClick={handleApplyCoupon}
                          disabled={isValidatingCoupon}
                          className="w-full bg-[#E33265] hover:bg-[#E33265]/90 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
                        >
                          {isValidatingCoupon ? t('coupon.validating') : t('coupon.apply')}
                        </button>
                      </div>
                    ) : (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-green-400 font-semibold">{appliedCoupon.code}</div>
                            <div className="text-white/60 text-sm">
                              {appliedCoupon.discountType === 'percentage' 
                                ? t('coupon.discount', { value: appliedCoupon.discountValue + '%' })
                                : t('coupon.discount', { value: formatPrice(appliedCoupon.discountValue) })}
                            </div>
                          </div>
                          <button
                            onClick={handleRemoveCoupon}
                            className="text-white/60 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Redesigned Order Summary (Detailed + Yearly Savings) */}
                  {/* Redesigned Order Summary (Detailed + Yearly Savings) */}
                  <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 text-white">
                    <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">{t('summary.title')}</h3>
                    
                    {!currentPlan ? (
                        <div className="text-center py-6">
                            <p className="text-white/60 mb-2">{t('summary.noPlanSelected')}</p>
                            <div className="text-sm text-white/40">{t('summary.noPlanSelected')}</div>
                        </div>
                    ) : (
                    <div className="space-y-3 text-sm">
                      
                      {billingCycle === 'yearly' ? (
                         <>
                            <div className="flex justify-between">
                                <span className="text-white/60">{t('summary.originalPrice')} ({formatPrice(currentPlan.price_monthly)} x 12)</span>
                                <span className="font-medium text-white/50 line-through">
                                    {formatPrice(currentPlan.price_monthly * 12)}
                                </span>
                            </div>
                            <div className="flex justify-between text-green-400">
                                <span>{t('summary.yearlySavings')} (-{yearlySavings}%)</span>
                                <span>-{formatPrice((currentPlan.price_monthly * 12) - currentPlan.price_yearly)}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-2 mb-2">
                                <span className="text-white/80 font-semibold">{t('summary.dealPrice')}</span>
                                <span className="font-bold text-white">{formatPrice(currentPlan.price_yearly)}</span>
                            </div>
                         </>
                      ) : (
                        <div className="flex justify-between">
                            <span className="text-white/60">{t('summary.subtotal')}</span>
                            <span className="font-medium text-white">{formatPrice(subtotal)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between">
                         <span className="text-white/60">{t('summary.plan')}</span>
                         <span className="font-medium text-white">{currentPlan?.name} ({billingCycle === 'yearly' ? t('billing.yearly') : t('billing.monthly')})</span>
                       </div>

                      {appliedCoupon && discountAmount > 0 && (
                        <div className="flex justify-between text-[#E33265] font-semibold">
                          <span>{t('summary.voucherDiscount')}</span>
                          <span>-{formatPrice(discountAmount)}</span>
                        </div>
                      )}
                      
                      <div className="border-t border-white/10 mt-4 pt-4 flex justify-between items-end">
                        <span className="text-base font-semibold text-white">{t('summary.totalAmount')}</span>
                        <span className="text-2xl font-bold text-[#E33265]">{formatPrice(total)}</span>
                      </div>
                    </div>
                    )}

                    <button
                      onClick={handleProceedToPayment}
                      disabled={!currentPlan}
                      className={`w-full mt-6 bg-[#E33265] hover:bg-[#E33265]/90 text-white font-bold py-3 rounded-lg transition ${!currentPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isCreatingOrder ? (
                          <span className="flex items-center justify-center gap-2">
                             {t('coupon.validating')}
                          </span>
                      ) : t('summary.proceed')}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

        {/* PAYMENT CONFIRMATION MODAL */}
        <PaymentConfirmationModal 
            isOpen={showQRModal}
            onClose={() => setShowQRModal(false)}
            order={currentOrder}
            onSuccess={handlePaymentSuccess}
        />
          
        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1A0F30] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center relative shadow-2xl">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                 <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                 </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">{t('successModal.title')}</h2>
              <p className="text-white/60 mb-6">
                {t('successModal.description')}
              </p>
              
              <div className="bg-white/5 rounded-xl p-4 mb-6">
                 <div className="flex justify-between mb-2">
                    <span className="text-white/60">{t('summary.plan')}</span>
                    <span className="text-white font-semibold">{successData?.planName}</span>
                 </div>
                 <div className="flex justify-between mb-2">
                    <span className="text-white/60">{t('successModal.amountPaid')}</span>
                    <span className="text-white font-semibold">
                        {successData?.currency === 'VND' 
                            ? (successData.amount.toLocaleString('vi-VN') + 'đ')
                            : formatPrice(successData?.amount)
                        }
                    </span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-white/60">{t('successModal.totalCredits')}</span>
                    <span className="text-[#E33265] font-bold">{successData?.credits} (Updated)</span>
                 </div>
              </div>

              <button
                onClick={async () => {
                   setShowSuccessModal(false);
                   await refreshCredits(true); // Force refresh global store
                   router.push('/create'); // Navigate to Create page
                }}
                className="w-full bg-[#E33265] hover:bg-[#E33265]/90 text-white font-bold py-3 rounded-xl transition"
              >
                {t('successModal.close')}
              </button>
            </div>
          </div>
        )}
        
        {/* Error Modal */}
        {showErrorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1A0F30] border border-red-500/30 rounded-2xl p-8 max-w-md w-full text-center relative shadow-2xl">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                 <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                 </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">{t('paymentModal.failed')}</h2>
              <p className="text-white/60 mb-6">
                {errorData?.reason || t('paymentModal.defaultError')}
              </p>
              
              <div className="bg-white/5 rounded-xl p-4 mb-6 text-sm text-left">
                  <p className="text-white/80"><span className="text-white/50">{t('paymentModal.reason')}:</span> {errorData?.reason || t('paymentModal.generalError')}</p>
                  <p className="text-white/80 mt-2"><span className="text-white/50">{t('paymentModal.support')}:</span> help@maiovo.com</p>
              </div>

              <button
                onClick={() => setShowErrorModal(false)}
                className="w-full bg-[#E33265] hover:bg-[#E33265]/90 text-white font-bold py-3 rounded-xl transition"
              >
                {t('paymentModal.close')}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </CreateLayout>
  );
}

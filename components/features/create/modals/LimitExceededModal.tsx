"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useLimitExceededModalStore } from '@/store/shared/limitExceededModal';
import { useCreditsStore } from '@/store';
import { getPlanCredits, getPlanProfileLimit, getPlanPostLimit } from '@/lib/usage';
import { PLAN_CONFIG } from '@/lib/payments/lemonsqueezy';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

/**
 * Limit Exceeded Modal
 * 
 * Displays when user hits profile limit, post limit, or runs out of credits
 * Similar structure to Test Plan & Credits modal but separate component
 */
export default function LimitExceededModal() {
  const {
    isOpen,
    reason,
    errorMessage,
    profileUsage,
    postUsage,
    creditsRemaining,
    currentPlan,
    selectedPlan,
    dontShowToday,
    closeModal,
    setSelectedPlan,
    setDontShowToday,
  } = useLimitExceededModalStore();

  const router = useRouter();
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  // Plan options (excluding Free)
  const planOptions = [
    { value: 'creator', label: 'Creator' },
    { value: 'creator_pro', label: 'Creator Pro' },
    { value: 'agency', label: 'Agency' },
  ];

  // Format plan label
  const formatPlanLabel = (plan: string) => {
    if (!plan) return 'Free';
    return plan
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get plan details
  const getPlanDetails = (planValue: string) => {
    const config = PLAN_CONFIG[planValue as keyof typeof PLAN_CONFIG];
    if (!config) {
      // Fallback to usage functions
      return {
        name: formatPlanLabel(planValue),
        credits: getPlanCredits(planValue),
        profiles: getPlanProfileLimit(planValue),
        posts: getPlanPostLimit(planValue),
        price: planValue === 'creator' ? 29 : planValue === 'creator_pro' ? 49 : 99,
      };
    }
    return {
      name: config.name,
      credits: config.credits,
      profiles: config.profiles,
      posts: config.posts,
      price: config.price,
    };
  };

  // Handle close
  const handleClose = () => {
    closeModal();
  };

  // Handle upgrade button click
  const handleUpgrade = () => {
    handleClose(); // Close modal first
    router.push("/buy-plan");
  };

  if (!isOpen || !reason) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Part 1: Error message and usage info */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Đã đạt giới hạn
              </h3>
              <p className="text-sm text-white/60 mb-4">
                Bạn đã đạt đến giới hạn của gói plan hiện tại. Vui lòng nâng cấp để tiếp tục sử dụng.
              </p>
            </div>

            {/* Error message (in red) */}
            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400">{errorMessage}</p>
              </div>
            )}

            {/* Usage info */}
            <div className="bg-[#1E1E23] rounded-lg p-4 space-y-3 border border-[#3A3A42]">
              {profileUsage && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/80">Tài khoản MXH đã kết nối</span>
                  <span className="text-sm font-medium text-white">
                    {profileUsage.current}/{profileUsage.limit === -1 ? '∞' : profileUsage.limit}
                  </span>
                </div>
              )}

              {postUsage && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/80">Bài đăng trong tháng</span>
                  <span className="text-sm font-medium text-white">
                    {postUsage.current}/{postUsage.limit === -1 ? '∞' : postUsage.limit}
                  </span>
                </div>
              )}

              {creditsRemaining !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/80">Số credit hiện còn</span>
                  <span className="text-sm font-medium text-white">{creditsRemaining}</span>
                </div>
              )}

              {currentPlan && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/80">Plan</span>
                  <span className="text-sm font-medium text-white">{formatPlanLabel(currentPlan)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Part 2: Plan selection */}
          <div>
            <Label className="text-sm text-white/80 mb-3 block">Chọn plan để nâng cấp</Label>
            <div className="space-y-3">
              {planOptions.map((option) => {
                const isActive = selectedPlan === option.value;
                const isExpanded = expandedPlan === option.value;
                const planDetails = getPlanDetails(option.value);

                return (
                  <div
                    key={option.value}
                    className={`rounded-lg border transition ${isActive
                      ? "border-[#E33265] bg-[#E33265]/10"
                      : "border-white/10 hover:border-[#E33265]/50"
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlan(option.value);
                        setExpandedPlan(isExpanded ? null : option.value);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm text-white"
                    >
                      <div className="flex items-center gap-2">
                        <span>{option.label}</span>
                        {isActive && (
                          <span className="text-xs uppercase tracking-wide text-[#E33265] flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Selected
                          </span>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-white/70" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/70" />
                      )}
                    </button>

                    {/* Expanded plan details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-2 border-t border-white/10 mt-2 space-y-2">
                        <div className="text-xs text-white/60 space-y-1">
                          <div className="flex justify-between">
                            <span>Credits:</span>
                            <span className="text-white/80">{planDetails.credits} Credits</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tài khoản MXH:</span>
                            <span className="text-white/80">
                              {planDetails.profiles === -1 ? 'Không giới hạn' : `${planDetails.profiles} Profiles`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Bài đăng/tháng:</span>
                            <span className="text-white/80">
                              {planDetails.posts === -1 ? 'Không giới hạn' : `${planDetails.posts} Posts`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Giá:</span>
                            <span className="text-white/80 font-medium">${planDetails.price}/tháng</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Part 3: Don't show today checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dontShowToday"
              checked={dontShowToday}
              onChange={(e) => setDontShowToday(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-[#1E1E23] text-[#E33265] focus:ring-[#E33265] focus:ring-offset-0 cursor-pointer"
            />
            <label
              htmlFor="dontShowToday"
              className="text-sm text-white/80 cursor-pointer"
            >
              Không hiển thị lại thông tin này trong ngày hôm nay.
            </label>
          </div>

          {/* Part 4: Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="outline"
              type="button"
              onClick={handleClose}
              className="border-[#3A3A42] text-white hover:bg-white/10 hover:border-white/20"
            >
              Tắt
            </Button>
            <Button
              type="button"
              onClick={handleUpgrade}
              className="bg-[#E33265] hover:bg-[#c52b57] text-white"
            >
              Nâng cấp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Zap, ChevronUp } from "lucide-react";
import type { CreditPackage } from "@/hooks/useTopUpModal";

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditPackages: CreditPackage[];
  onBuyCredits: (pkg: CreditPackage) => void;
}

export default function TopUpModal({
  isOpen,
  onClose,
  creditPackages,
  onBuyCredits,
}: TopUpModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-[#0C0717] border border-white/10 shadow-2xl p-0 overflow-hidden">
        
        {/* Header */}
        <div className="relative p-6 border-b border-white/10 bg-gradient-to-r from-[#E33265]/10 to-transparent">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Zap className="w-24 h-24 text-[#E33265] -rotate-12 transform translate-x-8 -translate-y-8" />
          </div>
          <h3 className="text-xl font-bold text-white flex items-center gap-3 relative z-10">
            <span className="p-2 rounded-lg bg-[#E33265] text-white shadow-lg shadow-[#E33265]/40">
              <Zap className="w-5 h-5 fill-current" />
            </span>
            Nạp thêm Credits
          </h3>
          <p className="text-sm text-gray-400 mt-2 relative z-10 max-w-[85%]">
            Mua thêm năng lượng để sáng tạo không giới hạn. Credits mua thêm 
            <span className="text-white font-semibold"> không bao giờ hết hạn</span>.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {creditPackages.map((pkg, index) => {
            const isPopular = index === 1;
            const isBestValue = index === 2;
            
            return (
              <div 
                key={pkg.id}
                onClick={() => onBuyCredits(pkg)}
                className={`
                  relative group flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-300
                  ${isPopular 
                    ? 'bg-[#E33265]/5 border-[#E33265]/50 shadow-[0_0_15px_rgba(227,50,101,0.1)]' 
                    : 'bg-white/[0.02] border-white/10 hover:border-[#E33265]/30 hover:bg-white/[0.05]'
                  }
                `}
              >
                {/* Badge Popular/Best Value */}
                {(isPopular || isBestValue) && (
                  <div className="absolute -top-2 right-4 z-10">
                    <span className={`
                      px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md
                      ${isPopular 
                        ? 'bg-[#E33265] text-white' 
                        : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                      }
                    `}>
                      {isPopular ? '🔥 Phổ biến' : '💎 Tiết kiệm'}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {/* Icon Circle */}
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-transform group-hover:scale-110
                    ${isPopular 
                      ? 'bg-[#E33265] text-white shadow-lg shadow-[#E33265]/40' 
                      : 'bg-white/10 text-gray-300 group-hover:bg-[#E33265]/20 group-hover:text-[#E33265]'
                    }
                  `}>
                    <Zap className="w-5 h-5 fill-current" />
                  </div>

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white group-hover:text-[#E33265] transition-colors">
                        {pkg.credits} Credits
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                      {pkg.label}
                    </div>
                  </div>
                </div>

                {/* Price & Button */}
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xl font-bold text-white">{pkg.price}</span>
                  <span className="text-[10px] text-gray-500">Thanh toán 1 lần</span>
                  
                  {/* Hover Effect Button */}
                  <div className="h-0 overflow-hidden group-hover:h-auto group-hover:mt-2 transition-all duration-300">
                      <span className="text-xs font-semibold text-[#E33265] flex items-center gap-1">
                          Mua ngay <ChevronUp className="w-3 h-3 rotate-90" />
                      </span>
                  </div>
                </div>

                {/* Active Border Glow on Hover */}
                <div className="absolute inset-0 rounded-xl border-2 border-[#E33265] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/20 border-t border-white/5 flex justify-between items-center text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>Thanh toán bảo mật qua LemonSqueezy</span>
          </div>
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white transition-all font-medium"
          >
            Đóng
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

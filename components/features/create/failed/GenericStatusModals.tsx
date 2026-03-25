"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from 'next-intl';

interface ModalProps{
    isOpen: boolean;
    onClose?: () => void;
}

export function LoadingModal({ isOpen }: ModalProps) {
    const t = useTranslations('Common.toast');
    if (!isOpen) return null;
    return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[50]">
      <div className="bg-card border border-border rounded-2xl w-[420px] max-w-[95vw] shadow-xl text-center p-10">
        <div className="mx-auto mb-4 w-10 h-10 rounded-full border-4 border-primary/40 border-t-primary animate-spin" />
        <div className="text-2xl font-bold text-foreground mb-2">{t('retryingModal')}</div>
        <div className="text-muted-foreground">{t('pleaseWait')}</div>
      </div>
    </div>
    // <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    //     <div className="bg-card border border-border rounded-2xl w-[420px] max-w-[95vw] shadow-xl text-center p-10">
    //       <div className="mx-auto mb-4 w-10 h-10 rounded-full border-4 border-primary/40 border-t-primary animate-spin" />
    //       <div className="text-2xl font-bold text-foreground mb-2">Đang thử lại...</div>
    //       <div className="text-muted-foreground">Vui lòng chờ trong giây lát</div>
    //     </div>
    //   </div>
  );
}

export function SuccessModal({ isOpen, onClose }: ModalProps) {
    const t = useTranslations('Common');
    if (!isOpen) return null;
    return(
        <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[50]" 
            onClick={onClose}>
        <div 
            className="bg-card border border-border rounded-2xl w-[420px] max-w-[95vw] shadow-xl text-center p-8" 
            onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-green-900/60 flex items-center justify-center">
          <svg 
            className="w-10 h-10 text-green-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24">
                <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        </div>
        <div className="text-3xl font-extrabold text-foreground mb-2">{t('toast.successTitle')}</div>
        <div className="text-muted-foreground mb-6">{t('toast.successMessage')}</div>
        <Button 
            className="px-8 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90" 
            onClick={onClose}> 
            {t('close')}
        </Button>
      </div>
    </div>
    // <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) setShowSuccessModal(false) }}>
    //     <div className="bg-card border border-border rounded-2xl w-[420px] max-w-[95vw] shadow-xl text-center p-8">
    //       <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-green-900/60 flex items-center justify-center">
    //         <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    //         </svg>
    //       </div>
    //       <div className="text-3xl font-extrabold text-foreground mb-2">Thành công!</div>
    //       <div className="text-muted-foreground mb-6">Bài viết đã được đăng thành công!</div>
    //       <button className="px-8 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowSuccessModal(false)}>Đóng</button>
    //     </div>
    //   </div>
    );
}
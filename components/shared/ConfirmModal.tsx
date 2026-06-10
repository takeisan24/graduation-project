"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  // Nút hành động phụ (tùy chọn) — ví dụ: "Chỉ gỡ khỏi lịch" bên cạnh "Xóa hoàn toàn".
  secondaryText?: string;
  onSecondary?: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  secondaryText,
  onSecondary,
  variant = 'warning'
}: ConfirmModalProps) {
  const tCommon = useTranslations('Common');
  const resolvedConfirmText = confirmText ?? tCommon('confirm');
  const resolvedCancelText = cancelText ?? tCommon('cancel');

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleSecondary = () => {
    onSecondary?.();
    onClose();
  };

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      iconBg: 'bg-red-500/10',
      button: 'bg-red-500 hover:bg-red-600'
    },
    warning: {
      icon: 'text-yellow-500',
      iconBg: 'bg-yellow-500/10',
      button: 'bg-yellow-500 hover:bg-yellow-600'
    },
    info: {
      icon: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
      button: 'bg-blue-500 hover:bg-blue-600'
    }
  };

  const styles = variantStyles[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Content */}
              <div className="p-6">
                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <div className={`w-16 h-16 rounded-full ${styles.iconBg} flex items-center justify-center`}>
                    <AlertTriangle className={`w-8 h-8 ${styles.icon}`} />
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-foreground text-center mb-2">
                  {title}
                </h3>

                {/* Description */}
                <p className="text-sm text-muted-foreground text-center mb-6">
                  {description}
                </p>

                {/* Actions */}
                {secondaryText && onSecondary ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleSecondary}
                      variant="outline"
                      className="w-full border-border text-foreground hover:bg-secondary"
                    >
                      {secondaryText}
                    </Button>
                    <Button
                      onClick={handleConfirm}
                      className={`w-full text-primary-foreground ${styles.button}`}
                    >
                      {resolvedConfirmText}
                    </Button>
                    <Button
                      onClick={onClose}
                      variant="ghost"
                      className="w-full text-muted-foreground hover:bg-secondary"
                    >
                      {resolvedCancelText}
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      onClick={onClose}
                      variant="outline"
                      className="flex-1 border-border text-foreground hover:bg-secondary"
                    >
                      {resolvedCancelText}
                    </Button>
                    <Button
                      onClick={handleConfirm}
                      className={`flex-1 text-primary-foreground ${styles.button}`}
                    >
                      {resolvedConfirmText}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

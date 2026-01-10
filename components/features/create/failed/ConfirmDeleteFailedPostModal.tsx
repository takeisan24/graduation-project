"use client";

import { Button } from "@/components/ui/button";

interface ConfirmDeleteFailedPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation modal for deleting a failed post
 * Displays a confirmation dialog asking the user to confirm deletion
 */
export function ConfirmDeleteFailedPostModal({ isOpen, onClose, onConfirm }: ConfirmDeleteFailedPostModalProps) {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="bg-[#2A2A30] border border-white/10 rounded-lg shadow-lg w-[320px] p-7 text-center" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl text-white font-semibold mb-2">Xác nhận xóa?</h3>
              <p className="text-white/70 mb-8">Bạn có chắc chắn muốn xóa bài đăng thất bại này không?</p>
              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" className="flex-1" onClick={onClose}>Hủy</Button>
                <Button variant="destructive" className="flex-1" onClick={onConfirm}>Xóa</Button>
              </div>
            </div>
        </div>
    );
}


"use client";

import { Button } from "@/components/ui/button";

interface ConfirmDeleteModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({ onClose, onConfirm }: ConfirmDeleteModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div className="bg-[#2A2A30] border border-white/10 rounded-lg shadow-lg w-[320px] p-7 text-center" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl text-white font-semibold mb-2">Xác nhận xóa?</h3>
              <p className="text-white/70 mb-8">Bạn có chắc chắn muốn xóa sự kiện này khỏi lịch không?</p>
              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" className="flex-1" onClick={onClose}>Không</Button>
                <Button variant="destructive" className="flex-1" onClick={onConfirm}>Xóa</Button>
              </div>
            </div>
        </div>
    );
}
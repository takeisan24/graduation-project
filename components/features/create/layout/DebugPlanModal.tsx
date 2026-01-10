"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface DebugPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: string;
  onPlanChange: (plan: string) => void;
  creditsToAdd: string;
  onCreditsChange: (credits: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  planOptions: Array<{ value: string; label: string }>;
}

export default function DebugPlanModal({
  isOpen,
  onClose,
  selectedPlan,
  onPlanChange,
  creditsToAdd,
  onCreditsChange,
  onSubmit,
  isSubmitting,
  planOptions,
}: DebugPlanModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="max-w-md">
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Test Plan & Credits</h3>
            <p className="text-sm text-white/60">
              Temporary QA-only control for switching plans or adding credits.
            </p>
          </div>

          <div>
            <Label className="text-sm text-white/80">Select plan</Label>
            <div className="mt-3 space-y-3">
              {planOptions.map((option) => {
                const isActive = selectedPlan === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onPlanChange(option.value)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                      isActive
                        ? "border-[#E33265] bg-[#E33265]/10 text-white"
                        : "border-white/10 text-white/80 hover:border-[#E33265]/50 hover:text-white"
                    }`}
                  >
                    <span>{option.label}</span>
                    {isActive && <span className="text-xs uppercase tracking-wide text-[#E33265]">Selected</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="creditsToAdd" className="text-sm text-white/80">
              Credits to change
            </Label>
            <Input
              id="creditsToAdd"
              type="number"
              min="0"
              value={creditsToAdd}
              onChange={(e) => onCreditsChange(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

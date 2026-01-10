import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface TransactionDebugModalProps {
  params: any; // The initial return params
  orderId?: string; // Optional Order UUID
  txnRef?: string; // Optional OnePay Transaction Reference
}

export function TransactionDebugModal({ params, orderId, txnRef }: TransactionDebugModalProps) {
  const [queryResult, setQueryResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleQueryDR = async () => {
    if (!orderId && !txnRef) return;
    setLoading(true);
    try {
        const res = await fetch('/api/payment/onepay/query-dr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, txnRef })
        });
        const data = await res.json();
        if (data.success) {
            setQueryResult(data.data);
            toast.success("QueryDR Success");
        } else {
            setQueryResult(data); // Show error response
            toast.error("QueryDR Failed: " + data.message);
        }
    } catch (e: any) {
        toast.error("Error: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        className="mt-4 border-white/20 text-white/60 hover:text-white hover:bg-white/10"
        onClick={() => setIsOpen(true)}
      >
        View Technical Details (Webhook/IPN)
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-full max-w-[90vw] bg-[#1A0F30] text-white border-white/10">
            <DialogHeader>
            <DialogTitle>Transaction Debug Info</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
                {/* 1. Return Parameters (What we received now) */}
                <div>
                    <h3 className="text-sm font-semibold text-[#E33265] mb-2 uppercase tracking-wider">
                        Return Parameters (Webhook Payload)
                    </h3>
                    <ScrollArea className="h-48 rounded-md border border-white/10 bg-black/20 p-4">
                        <pre className="text-xs font-mono text-green-400">
                            {JSON.stringify(params, null, 2)}
                        </pre>
                    </ScrollArea>
                    <p className="text-xs text-white/40 mt-1">This data was received via Redirect/Return URL.</p>
                </div>

                {/* 2. QueryDR Section */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-[#E33265] uppercase tracking-wider">
                            Real-time Status Check (QueryDR)
                        </h3>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={handleQueryDR} 
                            disabled={loading || (!orderId && !txnRef)}
                            className="h-8 text-xs bg-white/5 hover:bg-white/10"
                        >
                            {loading ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <RefreshCw className="w-3 h-3 mr-2"/>}
                            Fetch Live Status
                        </Button>
                    </div>
                    
                    {queryResult ? (
                        <ScrollArea className="h-48 rounded-md border border-white/10 bg-black/20 p-4">
                            <pre className="text-xs font-mono text-blue-400">
                                {JSON.stringify(queryResult, null, 2)}
                            </pre>
                        </ScrollArea>
                    ) : (
                        <div className="h-12 rounded-md border border-white/10 bg-black/20 flex items-center justify-center text-white/20 text-xs">
                            Click "Fetch Live Status" to check with OnePay Server
                        </div>
                    )}
                </div>

                {/* Close Button */}
                <div className="flex justify-end pt-4 border-t border-white/10">
                    <Button variant="secondary" onClick={() => setIsOpen(false)}>
                        Close Debug
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

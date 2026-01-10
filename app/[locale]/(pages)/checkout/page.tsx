import { Suspense } from 'react';
import CheckoutClient from './CheckoutClient';

export default function CheckoutPageWrapper() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={
        <div className="container mx-auto px-6 py-10 text-center">
          <div className="animate-pulse">Đang tải thông tin thanh toán...</div>
        </div>
      }>
        <CheckoutClient />
      </Suspense>
    </div>
  );
}
"use client"

import Header from "@/components/shared/header"
import { useRequireAuth } from "@/hooks/useRequireAuth"

export default function AgencyCheckoutPage() {
  // Protect checkout page - require authentication
  const { loading: authLoading } = useRequireAuth()

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E33265] mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Header />
      <div className="relative z-10 container mx-auto px-6 py-12 text-white max-w-3xl">
        <h1 className="text-3xl font-bold mb-6">Subscribe – Agency</h1>

        <form className="space-y-8">
          {/* Company & Contact */}
          <section className="bg-gray-900/50 border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Company & Contact</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-white/70 mb-1">Company name</label>
                <input className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#E33265]" />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Contact first name</label>
                <input className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#E33265]" />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Contact last name</label>
                <input className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#E33265]" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-white/70 mb-1">Billing email</label>
                <input type="email" className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#E33265]" />
              </div>
            </div>
          </section>

          {/* Billing */}
          <section className="bg-gray-900/50 border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Billing</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-white/70 mb-1">Card number</label>
                <input inputMode="numeric" className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#E33265]" placeholder="1234 5678 9012 3456" />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Expiration (MM/YY)</label>
                <input className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#E33265]" placeholder="09/27" />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">CVC</label>
                <input className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#E33265]" placeholder="123" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-white/70 mb-1">Billing address</label>
                <input className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#E33265]" />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">City</label>
                <input className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#E33265]" />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Postal code</label>
                <input className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#E33265]" />
              </div>
            </div>
          </section>

          <button type="submit" className="bg-[#E33265] hover:bg-[#c52b57] text-white px-6 py-3 rounded">Confirm Subscription</button>
        </form>
      </div>
    </div>
  )
}




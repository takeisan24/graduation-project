"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabaseClient } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { Lock, Eye, EyeOff } from "lucide-react"

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // Verify user is authenticated (via the recovery link)
  useEffect(() => {
    // Check if we have a hash in URL (Supabase sends token in hash)
    const hasHash = window.location.hash.length > 0;
    
    // If no hash and no existing session, redirect immediately
    if (!hasHash) {
       supabaseClient.auth.getSession().then(({ data: { session } }) => {
          if (!session) {
             toast.error("Invalid link. Please request a new password reset.")
             router.push("/forgot-password")
          }
       });
       return;
    }

    // If hash exists, wait for Supabase to process it
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth event:", event);
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        // Valid session
      } else if (event === "SIGNED_OUT") {
         // Only redirect if we are sure processing is done
      }
    })

    // Fallback: If after 3 seconds we still don't have a session, assume failure
    // This handles cases where the hash is invalid or expired
    const timer = setTimeout(() => {
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
           toast.error("Invalid or expired reset link. Please try again.")
           router.push("/forgot-password")
        }
      })
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [router])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setLoading(true)

    try {
      const { error } = await supabaseClient.auth.updateUser({
        password: password
      })

      if (error) throw error

      toast.success("Password updated successfully!")
      router.push("/signin")
    } catch (error: any) {
      console.error("Error updating password:", error)
      toast.error(error.message || "Failed to update password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
          <h2 className="text-3xl font-bold">Set new password</h2>
          <p className="text-muted-foreground mt-2">
            Please enter your new password below.
          </p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Sparkles, ArrowLeft } from "lucide-react"
import Header from "@/components/shared/header"
import Footer from "@/components/shared/footer"
import Link from "next/link"

import { useTranslations } from "next-intl"

import { supabaseClient } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const t = useTranslations('ForgotPasswordPage');
  const tCommon = useTranslations('Common.auth');
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Get the current URL for redirect
      const baseUrl = window.location.origin
      
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/auth/update-password`,
      })

      if (error) {
        throw error
      }

      setSuccess(true)
      toast.success("Password reset link sent to your email")
    } catch (error: any) {
      console.error("Error sending reset password email:", error)
      toast.error(error.message || "Failed to send reset password email")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>

          <Card className="p-8 bg-card border-border">
            {success ? (
              <div className="text-center space-y-4 py-4">
                <div className="flex justify-center">
                  <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold">Check your email</h3>
                <p className="text-muted-foreground">
                  We have sent a password reset link to <span className="font-medium text-foreground">{email}</span>
                </p>
                <div className="pt-4">
                  <Link 
                    href="/signin" 
                    className="text-sm text-primary hover:underline font-medium flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t('backToSignIn')}
                  </Link>
                </div>
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">{tCommon('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={tCommon('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 text-base" 
                  size="lg"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : t('form.submitButton')}
                </Button>
                
                <div className="text-center pt-4">
                  <Link 
                    href="/signin" 
                    className="text-sm text-primary hover:underline font-medium flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t('backToSignIn')}
                  </Link>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  )
}
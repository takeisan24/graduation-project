"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, RefreshCw, Trash2, Database, Play } from "lucide-react"
import { useTranslations } from "next-intl"
import { GENERIC_ERRORS } from "@/lib/messages/errors"

/**
 * AdminPanel Component
 * Allows manual triggering of admin cron jobs from frontend
 * Useful for Hobby plan where cron jobs are limited (2 jobs, once per day)
 * 
 * Jobs:
 * 1. Cleanup Inactive Connections - Clean up connections for users inactive 30+ days
 * 2. Sync Late Accounts - Sync account limits from late.dev API
 * 3. Startup Sync - Import CSV + sync metadata for all accounts
 * 4. Sync TikTok URLs - Batch sync TikTok post URLs
 */
export default function AdminPanel() {
  const t = useTranslations('SettingsSection')
  const [adminApiKey, setAdminApiKey] = useState("")
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  /**
   * Trigger an admin job
   */
  const triggerJob = async (jobName: string, endpoint: string, method: string = "POST", params?: Record<string, string>) => {
    if (!adminApiKey.trim()) {
      toast.error("Please enter Admin API Key")
      return
    }

    setLoading(prev => ({ ...prev, [jobName]: true }))
    const loadingToastId = toast.loading(`Running ${jobName}...`)

    try {
      const url = new URL(`${window.location.origin}${endpoint}`)
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value)
        })
      }

      const response = await fetch(url.toString(), {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": adminApiKey.trim()
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || `HTTP ${response.status}`)
      }

      toast.success(`${jobName} completed successfully!`, { id: loadingToastId })
      console.log(`[AdminPanel] ${jobName} result:`, result)
    } catch (error: any) {
      console.error(`[AdminPanel] ${jobName} error:`, error)
      toast.error(GENERIC_ERRORS.ADMIN_JOB_FAILED(jobName, error.message), { id: loadingToastId })
    } finally {
      setLoading(prev => ({ ...prev, [jobName]: false }))
    }
  }

  const jobs = [
    {
      name: "Cleanup Inactive Connections",
      description: "Clean up social media connections for users inactive 30+ days (runs monthly)",
      endpoint: "/api/admin/cleanup-inactive-connections",
      method: "POST",
      icon: Trash2,
      params: { force: "true" } // Allow running anytime
    },
    {
      name: "Sync Late Accounts",
      description: "Sync account limits and metadata from late.dev API for all accounts",
      endpoint: "/api/admin/sync-late-accounts",
      method: "POST",
      icon: RefreshCw,
      params: { force: "true" }
    },
    {
      name: "Startup Sync",
      description: "Import accounts from CSV + sync metadata for all accounts",
      endpoint: "/api/admin/startup-sync",
      method: "POST",
      icon: Database,
      params: { force: "true" }
    },
    {
      name: "Sync TikTok URLs",
      description: "Batch sync TikTok post URLs for posts posted within last 24 hours",
      endpoint: "/api/admin/sync-tiktok-urls",
      method: "GET",
      icon: Play
    }
  ]

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Admin Jobs (Manual Trigger)
        </CardTitle>
        <CardDescription>
          Manually trigger admin jobs. Useful for Hobby plan where cron jobs are limited.
          <br />
          <span className="text-xs text-muted-foreground mt-1 block">
            Note: Requires ADMIN_API_KEY. Jobs can also be triggered via API calls with x-api-key header.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Admin API Key Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Admin API Key</label>
          <Input
            type="password"
            placeholder="Enter ADMIN_API_KEY"
            value={adminApiKey}
            onChange={(e) => setAdminApiKey(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Set ADMIN_API_KEY in environment variables or enter it here for manual triggers
          </p>
        </div>

        {/* Job Buttons */}
        <div className="grid gap-3">
          {jobs.map((job) => {
            const Icon = job.icon
            const isLoading = loading[job.name] || false

            return (
              <div
                key={job.name}
                className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium text-sm">{job.name}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">{job.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerJob(job.name, job.endpoint, job.method, job.params)}
                  disabled={isLoading || !adminApiKey.trim()}
                  className="ml-4"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 mr-2" />
                      Run
                    </>
                  )}
                </Button>
              </div>
            )
          })}
        </div>

        {/* Info */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> These jobs are normally run automatically via Vercel Cron.
            For Hobby plan (limited to 2 cron jobs, once per day), you can trigger them manually here.
            <br />
            <br />
            <strong>Alternative:</strong> You can also trigger these jobs via API calls:
            <code className="block mt-1 p-2 bg-background rounded text-xs">
              curl -X POST https://your-app.vercel.app/api/admin/[endpoint] -H "x-api-key: YOUR_KEY"
            </code>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}


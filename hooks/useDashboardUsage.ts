"use client"

import useSWR from "swr"
import { supabaseClient } from "@/lib/supabaseClient"
import { useAuth } from "@/hooks/useAuth"

const authFetcher = async (url: string) => {
  const session = await supabaseClient.auth.getSession()
  const token = session.data.session?.access_token
  if (!token) return null
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const json = await res.json()
  return json.data
}

export function useDashboardUsage() {
  const { user } = useAuth()

  const { data: usageData, isLoading: isLoadingCredits, mutate: refreshCredits } = useSWR(
    user ? "/api/usage" : null,
    authFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  const { data: storageRaw } = useSWR(
    user ? "/api/usage/storage" : null,
    authFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const resourceBudget = usageData?.resourceBudget ?? usageData?.credits ?? null
  const workflowCapacity = usageData?.workflowCapacity ?? usageData?.limits ?? null
  const resourceTier = usageData?.resourceTier ?? usageData?.plan ?? "free"
  const creditsRemaining = resourceBudget?.balance ?? resourceBudget?.remaining ?? 0
  const totalCredits = resourceBudget?.total ?? 0
  const currentPlan = resourceTier
  const profileLimits = workflowCapacity?.profiles ?? { current: 0, limit: 2 }

  const storageData = storageRaw
    ? {
        used: Number((storageRaw.usedBytes / (1024 * 1024 * 1024)).toFixed(2)),
        total: storageRaw.limitGB,
        percent: Math.round((storageRaw.usedBytes / (storageRaw.limitGB * 1024 * 1024 * 1024)) * 100),
      }
    : { used: 0, total: 1, percent: 0 }

  const creditsPercent = totalCredits > 0 ? Math.round((creditsRemaining / totalCredits) * 100) : 100
  const isCreditsLow = creditsPercent <= 20
  const isCreditsCritical = creditsPercent <= 5

  return {
    resourceTier,
    resourceBudget,
    workflowCapacity,
    creditsRemaining,
    totalCredits,
    creditsPercent,
    isCreditsLow,
    isCreditsCritical,
    isLoadingCredits,
    refreshCredits,
    currentPlan,
    profileLimits,
    storageData,
  }
}

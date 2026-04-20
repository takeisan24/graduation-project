"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import SectionHeader from "../layout/SectionHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CheckCircle2, FileText, Layers3, Link2, RadioTower, ShieldAlert, Sparkles, Workflow, XCircle } from "lucide-react";
import { usePublishedPostsStore } from "@/store/published/publishedPageStore";
import { useFailedPostsStore } from "@/store/failed/failedPageStore";
import { useDraftsStore } from "@/store/drafts/draftsPageStore";
import { useConnectionsStore } from "@/store";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { useShallow } from "zustand/react/shallow";
import { format, formatDistanceToNow } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import PreviewNotice from "../shared/PreviewNotice";
import {
  getCreatePreviewCopy,
  getPreviewConnectedAccounts,
  getPreviewDraftPosts,
  getPreviewFailedPosts,
  getPreviewPublishedPosts,
  isCreatePreviewEnabled,
} from "@/lib/mocks/createSectionPreview";

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  date: Date;
  status: "success" | "warning" | "neutral";
};

type TimeResolvablePost = {
  time?: string | null;
  date?: string | null;
  scheduledAt?: string | null;
};

const STATUS_COLORS = {
  drafts: "#f59e0b",
  published: "#10b981",
  failed: "#f43f5e",
};

const PLATFORM_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#7c3aed", "#ef4444", "#06b6d4", "#0f766e", "#fb7185"];

function getResolvedPostDate(post: TimeResolvablePost): Date | null {
  const candidates = [
    post.scheduledAt,
    post.date && post.time ? `${post.date}T${post.time}` : null,
    post.time,
    post.date,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = new Date(candidate);
    if (!Number.isNaN(resolved.getTime())) {
      return resolved;
    }
  }

  return null;
}

export default function ApiDashboardSection() {
  const t = useTranslations("CreatePage.apiDashboard");
  const tHeaders = useTranslations("CreatePage.sectionHeaders");
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState("overview");

  const { publishedPosts, loadPublishedPosts, hasLoadedPublishedPosts } = usePublishedPostsStore(
    useShallow((state) => ({
      publishedPosts: state.publishedPosts,
      loadPublishedPosts: state.loadPublishedPosts,
      hasLoadedPublishedPosts: state.hasLoadedPublishedPosts,
    }))
  );

  const { failedPosts, loadFailedPosts, hasLoadedFailedPosts } = useFailedPostsStore(
    useShallow((state) => ({
      failedPosts: state.failedPosts,
      loadFailedPosts: state.loadFailedPosts,
      hasLoadedFailedPosts: state.hasLoadedFailedPosts,
    }))
  );

  const { draftPosts, loadDrafts, hasLoadedDrafts } = useDraftsStore(
    useShallow((state) => ({
      draftPosts: state.draftPosts,
      loadDrafts: state.loadDrafts,
      hasLoadedDrafts: state.hasLoadedDrafts,
    }))
  );
  const { accounts, loading: connectionsLoading } = useConnectedAccounts();
  const hasLoadedConnectedAccounts = useConnectionsStore((state) => state.hasLoadedConnectedAccounts);

  useEffect(() => {
    if (!hasLoadedPublishedPosts) loadPublishedPosts();
    if (!hasLoadedFailedPosts) loadFailedPosts();
    if (!hasLoadedDrafts) loadDrafts();
  }, [hasLoadedPublishedPosts, hasLoadedFailedPosts, hasLoadedDrafts, loadPublishedPosts, loadFailedPosts, loadDrafts]);

  const localeConfig = locale === "vi" ? vi : enUS;
  const previewCopy = useMemo(() => getCreatePreviewCopy(locale), [locale]);
  const previewDraftPosts = useMemo(() => getPreviewDraftPosts(), []);
  const previewPublishedPosts = useMemo(() => getPreviewPublishedPosts(), []);
  const previewFailedPosts = useMemo(() => getPreviewFailedPosts(), []);
  const previewAccounts = useMemo(() => getPreviewConnectedAccounts(), []);
  const showPreviewNotice =
    isCreatePreviewEnabled() &&
    hasLoadedDrafts &&
    hasLoadedPublishedPosts &&
    hasLoadedFailedPosts &&
    hasLoadedConnectedAccounts &&
    !connectionsLoading &&
    draftPosts.length === 0 &&
    publishedPosts.length === 0 &&
    failedPosts.length === 0 &&
    accounts.length === 0;

  const displayDraftPosts = showPreviewNotice ? previewDraftPosts : draftPosts;
  const displayPublishedPosts = showPreviewNotice ? previewPublishedPosts : publishedPosts;
  const displayFailedPosts = showPreviewNotice ? previewFailedPosts : failedPosts;
  const displayAccounts = showPreviewNotice ? previewAccounts : accounts;

  const {
    successRate,
    platformDistribution,
    statusDistribution,
    activityTimeline,
    readinessScore,
    dominantPlatform,
    recentActivity,
    connectedPlatforms,
  } = useMemo(() => {
    const allOperationalPosts = [...displayDraftPosts, ...displayPublishedPosts, ...displayFailedPosts];
    const totalResolved = displayPublishedPosts.length + displayFailedPosts.length;
    const successRatio = totalResolved > 0 ? Math.round((displayPublishedPosts.length / totalResolved) * 100) : 100;

    const platformCounts = new Map<string, number>();
    const platformSet = new Set<string>();

    allOperationalPosts.forEach((post) => {
      const platform = String(post.platform || "Unknown");
      platformSet.add(platform);
      platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
    });

    const distribution = Array.from(platformCounts.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: PLATFORM_COLORS[index % PLATFORM_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    const dominant = distribution[0]?.name || t("noData");
    const readinessRaw =
      Math.min(displayAccounts.length * 16, 32) +
      Math.min(displayDraftPosts.length * 6, 24) +
      Math.min(displayPublishedPosts.length * 4, 24) +
      (displayFailedPosts.length === 0 ? 20 : Math.max(0, 20 - displayFailedPosts.length * 5));
    const readiness = Math.max(0, Math.min(100, readinessRaw));

    const timeline = Array.from({ length: 7 }, (_, offset) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (6 - offset));
      const key = format(day, "yyyy-MM-dd");

      const drafts = displayDraftPosts.filter((post) => {
        const resolvedDate = getResolvedPostDate(post);
        return resolvedDate ? format(resolvedDate, "yyyy-MM-dd") === key : false;
      }).length;
      const published = displayPublishedPosts.filter((post) => {
        const resolvedDate = getResolvedPostDate(post);
        return resolvedDate ? format(resolvedDate, "yyyy-MM-dd") === key : false;
      }).length;
      const failed = displayFailedPosts.filter((post) => {
        const resolvedDate = getResolvedPostDate(post);
        return resolvedDate ? format(resolvedDate, "yyyy-MM-dd") === key : false;
      }).length;

      return {
        date: key,
        drafts,
        published,
        failed,
        total: drafts + published + failed,
      };
    });

    const activity: ActivityItem[] = [
      ...displayPublishedPosts.slice(0, 8).map((post) => ({
        id: `published-${post.id}`,
        title: t("activityPublished"),
        detail: `${post.platform} • ${post.content?.slice(0, 80) || t("activityNoContent")}`,
        date: getResolvedPostDate(post) || new Date(),
        status: "success" as const,
      })),
      ...displayFailedPosts.slice(0, 8).map((post) => ({
        id: `failed-${post.id}`,
        title: t("activityFailed"),
        detail: `${post.platform} • ${post.content?.slice(0, 80) || t("activityNoContent")}`,
        date: getResolvedPostDate(post) || new Date(),
        status: "warning" as const,
      })),
      ...displayAccounts.slice(0, 4).map((account) => ({
        id: `account-${account.id}`,
        title: t("activityConnected"),
        detail: `${account.platform || "Social"} • ${account.profile_name || account.profile_metadata?.username || "N/A"}`,
        date: account.created_at ? new Date(account.created_at) : new Date(),
        status: "neutral" as const,
      })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8);

    return {
      successRate: successRatio,
      platformDistribution: distribution,
      statusDistribution: [
        { name: t("drafts"), value: displayDraftPosts.length, color: STATUS_COLORS.drafts },
        { name: t("published"), value: displayPublishedPosts.length, color: STATUS_COLORS.published },
        { name: t("failed"), value: displayFailedPosts.length, color: STATUS_COLORS.failed },
      ],
      activityTimeline: timeline,
      readinessScore: readiness,
      dominantPlatform: dominant,
      recentActivity: activity,
      connectedPlatforms: platformSet.size,
    };
  }, [displayAccounts, displayDraftPosts, displayFailedPosts, displayPublishedPosts, t]);

  const weeklyVolume = useMemo(() => activityTimeline.reduce((sum, day) => sum + day.total, 0), [activityTimeline]);
  const totalManagedPosts = displayDraftPosts.length + displayPublishedPosts.length + displayFailedPosts.length;

  return (
    <div className="h-full w-full max-w-none overflow-y-auto py-2 lg:py-3">
      <SectionHeader
        icon={BarChart3}
        title={tHeaders("operations.title")}
        description={tHeaders("operations.description")}
      />

      <div className="mx-auto w-full max-w-[1440px] px-4 pb-8 pt-4 sm:px-6 xl:px-8">
      {showPreviewNotice ? (
        <PreviewNotice badge={previewCopy.badge} description={previewCopy.emptyDescription} className="mb-4" />
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 grid h-auto w-full grid-cols-3 gap-1 bg-card p-1 text-xs lg:mb-6 lg:text-sm">
          <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
          <TabsTrigger value="analytics">{t("analytics")}</TabsTrigger>
          <TabsTrigger value="activity">{t("activity")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/70 bg-card/95">
              <CardHeader className="pb-2">
                <CardDescription>{t("totalDrafts")}</CardDescription>
                <CardTitle className="flex items-center gap-2 text-3xl">
                  <FileText className="h-5 w-5 text-amber-500" />
                  {displayDraftPosts.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t("draftsHint")}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95">
              <CardHeader className="pb-2">
                <CardDescription>{t("published")}</CardDescription>
                <CardTitle className="flex items-center gap-2 text-3xl">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  {displayPublishedPosts.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t("publishedHint")}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95">
              <CardHeader className="pb-2">
                <CardDescription>{t("failed")}</CardDescription>
                <CardTitle className="flex items-center gap-2 text-3xl">
                  <XCircle className="h-5 w-5 text-rose-500" />
                  {displayFailedPosts.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t("failedHint")}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95">
              <CardHeader className="pb-2">
                <CardDescription>{t("connectedAccounts")}</CardDescription>
                <CardTitle className="flex items-center gap-2 text-3xl">
                  <Link2 className="h-5 w-5 text-sky-500" />
                  {displayAccounts.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {connectionsLoading && !showPreviewNotice ? t("loading") : t("connectedPlatformsCount", { count: connectedPlatforms })}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <Card className="border-border/70 bg-gradient-to-br from-background via-card to-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <Workflow className="h-5 w-5" />
                  <CardTitle>{t("operationalSnapshot")}</CardTitle>
                </div>
                <CardDescription>{t("operationalSnapshotDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("readinessScore")}</p>
                    <p className="mt-3 text-3xl font-bold text-foreground">{readinessScore}<span className="text-base text-muted-foreground">/100</span></p>
                    <div className="mt-3 h-2 rounded-full bg-secondary">
                      <div className="h-2 rounded-full bg-gradient-to-r from-primary to-sky-500" style={{ width: `${readinessScore}%` }} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("weeklyVolume")}</p>
                    <p className="mt-3 text-3xl font-bold text-foreground">{weeklyVolume}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{t("weeklyVolumeHint")}</p>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("successRate")}</p>
                    <p className="mt-3 text-3xl font-bold text-foreground">{successRate}%</p>
                    <p className="mt-2 text-sm text-muted-foreground">{t("successRateHint")}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Layers3 className="h-4 w-4 text-primary" />
                      {t("dominantPlatform")}
                    </div>
                    <p className="mt-3 text-lg font-semibold text-foreground">{dominantPlatform}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t("dominantPlatformHint")}</p>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <RadioTower className="h-4 w-4 text-primary" />
                      {t("pipelineHealth")}
                    </div>
                    <p className="mt-3 text-lg font-semibold text-foreground">
                      {displayFailedPosts.length === 0 ? t("pipelineStable") : t("pipelineNeedsAttention")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{t("pipelineHealthHint")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95">
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-5 w-5" />
                  <CardTitle>{t("systemFocus")}</CardTitle>
                </div>
                <CardDescription>{t("systemFocusDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("focusDrafts")}</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{t("focusDraftsDesc", { count: displayDraftPosts.length })}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("focusConnections")}</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{t("focusConnectionsDesc", { count: displayAccounts.length })}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("focusFailures")}</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{t("focusFailuresDesc", { count: displayFailedPosts.length })}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
            <Card className="border-border/70 bg-card/95">
              <CardHeader>
                <CardTitle>{t("dailyOperations")}</CardTitle>
                <CardDescription>{t("dailyOperationsDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityTimeline}>
                      <defs>
                        <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => format(new Date(value), "dd/MM")}
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "rgba(148,163,184,0.2)", borderRadius: "14px" }}
                        formatter={(value: number) => [value, t("totalPosts")]}
                        labelFormatter={(value) => format(new Date(value), "dd/MM/yyyy")}
                      />
                      <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} fill="url(#activityGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95">
              <CardHeader>
                <CardTitle>{t("platformDist")}</CardTitle>
                <CardDescription>{t("platformDistDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={platformDistribution.length > 0 ? platformDistribution : [{ name: t("noData"), value: 1, color: "#94a3b8" }]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={4}
                      >
                        {(platformDistribution.length > 0 ? platformDistribution : [{ name: t("noData"), value: 1, color: "#94a3b8" }]).map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "rgba(148,163,184,0.2)", borderRadius: "14px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {platformDistribution.map((platform) => (
                    <Badge key={platform.name} variant="secondary" className="gap-2 rounded-full border border-border/70 bg-secondary/35 px-3 py-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: platform.color }} />
                      {platform.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 bg-card/95">
            <CardHeader>
              <CardTitle>{t("statusDistribution")}</CardTitle>
              <CardDescription>{t("statusDistributionDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusDistribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "rgba(148,163,184,0.2)", borderRadius: "14px" }}
                    />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {statusDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="border-border/70 bg-card/95">
              <CardHeader>
                <CardTitle>{t("activityFeed")}</CardTitle>
                <CardDescription>{t("activityFeedDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4 rounded-2xl border border-border/70 bg-background/80 p-4">
                      <div
                        className={`mt-1 flex h-10 w-10 items-center justify-center rounded-xl ${
                          activity.status === "success"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : activity.status === "warning"
                            ? "bg-rose-500/10 text-rose-600"
                            : "bg-sky-500/10 text-sky-600"
                        }`}
                      >
                        {activity.status === "success" ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : activity.status === "warning" ? (
                          <ShieldAlert className="h-5 w-5" />
                        ) : (
                          <Link2 className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-semibold text-foreground">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(activity.date, { addSuffix: true, locale: localeConfig })}
                          </p>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{activity.detail}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/25 p-6 text-center text-sm text-muted-foreground">
                    {t("noRecentActivity")}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95">
              <CardHeader>
                <CardTitle>{t("insightSummary")}</CardTitle>
                <CardDescription>{t("insightSummaryDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("totalPosts")}</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{totalManagedPosts}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("connectedPlatformsLabel")}</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{connectedPlatforms}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("nextFocus")}</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {displayFailedPosts.length > 0 ? t("nextFocusFailed") : displayDraftPosts.length > 0 ? t("nextFocusDrafts") : t("nextFocusHealthy")}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{t("latestWindow")}</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{t("latestWindowDesc")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

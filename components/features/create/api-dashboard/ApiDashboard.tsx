"use client";

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Zap, Activity, FileText, CheckCircle2, XCircle, Users, Sparkles, ImageIcon, Video, Brain, TrendingUp, Copy, RefreshCw, Plus, Key, Shield, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils/cn";
import { useApiDashboardPageStore } from "@/store/api-dashboard/apiDashboardPageStore";
import { useCreditsStore } from "@/store/shared/credits";
import { usePublishedPostsStore } from "@/store/published/publishedPageStore";
import { useFailedPostsStore } from "@/store/failed/failedPageStore";
import { useShallow } from 'zustand/react/shallow';
import { useState, useMemo, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import { useLocale } from 'next-intl';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Inline Badge component
function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "destructive" | "outline" }) {
  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)} {...props} />
  )
}

// Helper Function
const PlatformIcon = ({ platform, size = 20, className}: { platform: string, size?: number, className?: string }) => {
    return <div className={cn("rounded bg-white/10 p-1 flex items-center justify-center font-bold text-xs w-6 h-6", className)}>{platform?.[0] || '?'}</div>
};

// Fallback Mock Data for Charts (only used if absolutely no real data)
const MOCK_AI_STATS = [
  { name: 'OpenAI (GPT-4)', value: 0, color: '#10A37F' },
  { name: 'Anthropic (Claude)', value: 0, color: '#D97757' },
  { name: 'Google (Gemini)', value: 0, color: '#4285F4' },
];

export default function ApiDashboardSection() {
  const t = useTranslations('CreatePage.apiDashboard');
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState('overview');

  // Stores
  const { 
    apiStats, 
    apiKeys,
    handleRegenerateKey,
    handleCreateKey
  } = useApiDashboardPageStore(useShallow((state) => ({
    apiStats: state.apiStats,
    apiKeys: state.apiKeys, 
    handleRegenerateKey: state.handleRegenerateKey,
    handleCreateKey: state.handleCreateKey,
  })));

  const { creditsRemaining, creditsUsed, totalCredits, currentPlan, postLimits, profileLimits } = useCreditsStore(useShallow((state) => ({
    creditsRemaining: state.creditsRemaining,
    creditsUsed: state.creditsUsed,
    totalCredits: state.totalCredits,
    currentPlan: state.currentPlan,
    postLimits: state.postLimits,
    profileLimits: state.profileLimits
  })));

  const { publishedPosts, loadPublishedPosts, hasLoadedPublishedPosts } = usePublishedPostsStore(useShallow((state) => ({
    publishedPosts: state.publishedPosts,
    loadPublishedPosts: state.loadPublishedPosts,
    hasLoadedPublishedPosts: state.hasLoadedPublishedPosts
  })));

  const { failedPosts, loadFailedPosts, hasLoadedFailedPosts } = useFailedPostsStore(useShallow((state) => ({
    failedPosts: state.failedPosts,
    loadFailedPosts: state.loadFailedPosts,
    hasLoadedFailedPosts: state.hasLoadedFailedPosts
  })));

  // Load data if needed
  useEffect(() => {
    if (!hasLoadedPublishedPosts) loadPublishedPosts();
    if (!hasLoadedFailedPosts) loadFailedPosts();
  }, [hasLoadedPublishedPosts, hasLoadedFailedPosts, loadPublishedPosts, loadFailedPosts]);
  
  // Real Data Derivation
  const { platformStats, totalPosts, successRate, genTotals, recentActivity, timeSeries } = useMemo(() => {
    const allPosts = [...publishedPosts, ...failedPosts];
    const total = allPosts.length;
    
    // Platform Distribution
    const platformCounts: Record<string, number> = {};
    allPosts.forEach(post => {
      const p = post.platform || 'Unknown';
      platformCounts[p] = (platformCounts[p] || 0) + 1;
    });

    const pStats = Object.entries(platformCounts).map(([name, value]) => {
      let color = '#6b7280';
      if (name.toLowerCase() === 'facebook') color = '#1877F2';
      if (name.toLowerCase() === 'instagram') color = '#E4405F';
      if (name.toLowerCase() === 'twitter' || name.toLowerCase() === 'x') color = '#1DA1F2';
      if (name.toLowerCase() === 'linkedin') color = '#0A66C2';
      if (name.toLowerCase() === 'youtube') color = '#FF0000';
      if (name.toLowerCase() === 'tiktok') color = '#000000'; // Or specific tiktok color
      if (name.toLowerCase() === 'pinterest') color = '#BD081C';

       // Ensure color is visible on dark theme (TikTok black might be invisible)
       if (color === '#000000') color = '#25F4EE'; // TikTok Cyan-ish

      return { name, value, color };
    }).sort((a, b) => b.value - a.value);

    // Platform percentages
    const finalPlatformStats = pStats.map(stat => ({
      ...stat,
      percent: total > 0 ? Math.round((stat.value / total) * 100) : 0
    }));

    // Success Rate
    const failedCount = failedPosts.length;
    const successCalc = total > 0 ? ((total - failedCount) / total) * 100 : 100;

    // Generation Totals (Heuristic)
    let textCount = 0;
    let imageCount = 0;
    let videoCount = 0;

    allPosts.forEach(post => {
      const p = (post.platform || '').toLowerCase();
      // Check media if available or infer from platform
      const hasVideo = ('media' in post && Array.isArray(post.media) && post.media.some((m: any) => m.type === 'video')) || p === 'youtube' || p === 'tiktok';
      const hasImage = ('media' in post && Array.isArray(post.media) && post.media.some((m: any) => m.type === 'image')) || p === 'instagram' || p === 'pinterest';
      
      if (hasVideo) videoCount++;
      else if (hasImage) imageCount++;
      else textCount++;
    });

    // Recent Activity
    const activity = allPosts
      .map(post => {
        let time = new Date();
        if ('time' in post && post.time) {
             if (post.time.includes('T')) time = new Date(post.time); // ISO
             else if (post.time.includes(':')) { // HH:MM, need date
                 const today = new Date();
                 const [h, m] = post.time.split(':');
                 today.setHours(Number(h), Number(m));
                 time = today;
                 // If failed post has 'date', use it
                 if ('date' in post && post.date) {
                     const d = new Date(post.date);
                     d.setHours(Number(h), Number(m));
                     time = d;
                 }
             }
        }
        
        return {
          id: post.id,
          typeKey: 'postGeneration', // Generic for now
          statusKey: 'errorMessage' in post ? 'failed' : 'success',
          time,
          credits: 'errorMessage' in post ? 0 : 1, // Assume 1 credit per post for now
          details: `Posted to ${post.platform}`,
          platform: post.platform
        };
      })
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 10);

      // Time Series (Group by day) - Last 7 days
      const days = 7;
      const history: any[] = [];
      for (let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          
          let count = 0;
          allPosts.forEach(post => {
              let pDate = '';
               if ('time' in post && post.time?.includes('T')) pDate = post.time.split('T')[0];
               else if ('date' in post) pDate = post.date;
               
               if (pDate === dateStr) count++;
          });
          
          history.push({
              date: dateStr,
              apiCalls: count,
              credits: count * 1 // Rough estimate
          });
      }

    return {
      platformStats: finalPlatformStats,
      totalPosts: total,
      successRate: successCalc.toFixed(1),
      genTotals: { text: textCount, image: imageCount, video: videoCount },
      recentActivity: activity,
      timeSeries: history
    };
  }, [publishedPosts, failedPosts]);

  // Derived Credits Logic
  const creditLimit = totalCredits > 0 ? totalCredits : 1000; 
  const creditPercentage = (creditsUsed / creditLimit) * 100;
  
  // Helpers
  const formatPlanName = (plan = 'free') => {
    return (plan || 'free').charAt(0).toUpperCase() + (plan || 'free').slice(1);
  };

  const getPlanColor = () => {
    const plan = (currentPlan || 'free').toLowerCase().trim();
    if (plan === 'pro') return 'bg-purple-600';
    if (plan === 'business') return 'bg-blue-600';
    if (plan === 'agency') return 'bg-orange-600';
    // Default / Free / Starter / Unknown
    return 'bg-emerald-600'; 
  };
  
  const postLimitsFromCredits = postLimits || { current: totalPosts, limit: 50 }; // Use real total posts if available
  const profileLimitsFromCredits = profileLimits || { current: 0, limit: 5 }; 

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };
  
  return (
    <div className="w-full max-w-none px-2 lg:px-4 py-2 lg:py-3 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-0 mb-4 lg:mb-6">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-white">{t('title')}</h2>
          <p className="text-xs lg:text-sm text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        <Badge className={cn("text-white px-3 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm font-semibold self-start lg:self-auto uppercase tracking-wide border-none", getPlanColor())}>
          {formatPlanName(currentPlan)}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-4 lg:mb-6 bg-gray-900/50 text-xs lg:text-sm h-auto sm:h-10 p-1 gap-1">
          <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('analytics')}</TabsTrigger>
          <TabsTrigger value="credits">{t('credits')}</TabsTrigger>
          <TabsTrigger value="activity">{t('activity')}</TabsTrigger>
          {/* API Keys Tab hidden as requested */}
          {/* <TabsTrigger value="api-keys">{t('apiKeys')}</TabsTrigger> */}
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4 lg:space-y-6">
          {/* Primary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {/* Credits Card */}
            <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-500/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-purple-300" />
                <span className="text-sm text-purple-200 font-medium">{t('credits')}</span>
              </div>
              <div className="text-white text-3xl font-bold mb-2">
                {creditsRemaining.toLocaleString()}
                <span className="text-lg text-purple-300 font-normal ml-1">/ {creditLimit.toLocaleString()}</span>
              </div>
              <div className="w-full bg-purple-950/50 rounded-full h-2 mb-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(creditPercentage, 100)}%` }}
                />
              </div>
              <div className="text-xs text-purple-300">
                {t('used', { count: creditsUsed.toLocaleString(), percent: creditPercentage.toFixed(1) })}
              </div>
            </Card>

            {/* Post Limits Card */}
            <Card className="bg-[#1C1C21] border-white/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-gray-400 font-medium">{t('monthlyPosts')}</span>
              </div>
              <div className="text-white text-3xl font-bold mb-2">
                {postLimitsFromCredits.current}
                <span className="text-lg text-gray-500 font-normal ml-1">/ {postLimitsFromCredits.limit < 0 ? '∞' : postLimitsFromCredits.limit}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-green-400">
                <TrendingUp className="w-3 h-3" />
                <span>{t('trendWeek', {value: timeSeries.reduce((acc, curr) => acc + curr.apiCalls, 0)})}</span>
              </div>
            </Card>

            {/* Success Rate Card */}
            <Card className="bg-[#1C1C21] border-white/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400 font-medium">{t('successRate')}</span>
              </div>
              <div className="text-white text-3xl font-bold mb-2">
                {successRate}%
              </div>
               <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{t('recentActivityBasis')}</span>
              </div>
            </Card>
            
            {/* Profiles Card */}
             <Card className="bg-[#1C1C21] border-white/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-orange-400" />
                <span className="text-sm text-gray-400 font-medium">{t('activeProfiles')}</span>
              </div>
              <div className="text-white text-3xl font-bold mb-2">
                {profileLimitsFromCredits.current}
                <span className="text-lg text-gray-500 font-normal ml-1">/ {profileLimitsFromCredits.limit}</span>
              </div>
               <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{t('manageInAccounts')}</span>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* Main Chart Area */}
             <Card className="lg:col-span-2 bg-[#1C1C21] border-white/5 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                   <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#E33265]" />
                      {t('generationsOverview')}
                   </h3>
                   <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#E33265]"></div>
                        <span className="text-gray-400">{t('posts')}</span>
                        <span className="text-white font-medium">{genTotals.text}</span>
                      </div>
                       <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-gray-400">{t('images')}</span>
                         <span className="text-white font-medium">{genTotals.image}</span>
                      </div>
                   </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeries}>
                      <defs>
                        <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#E33265" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#E33265" stopOpacity={0}/>
                        </linearGradient>
                         <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="date" 
                        stroke="#525252" 
                        fontSize={12} 
                        tickFormatter={(str) => format(new Date(str), 'MM/dd')}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                         stroke="#525252" 
                         fontSize={12}
                         tickLine={false}
                         axisLine={false}
                         tickFormatter={(number) => `${number}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1E1E23', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        labelStyle={{ color: '#ccc', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="apiCalls" stroke="#E33265" strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
             </Card>

             {/* Distribution / Stats */}
             <div className="space-y-6">
                <Card className="bg-[#1C1C21] border-white/5 p-6 h-full">
                   <h3 className="text-lg font-semibold text-white mb-4">{t('contentTypeDistribution')}</h3>
                   {platformStats.length > 0 ? (
                      <div className="space-y-4">
                        {platformStats.slice(0, 4).map((stat) => (
                          <div key={stat.name} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                              <div className="flex items-center gap-3">
                                  <div className="p-2 rounded bg-white/10" style={{ color: stat.color }}>
                                    {/* Simplistic Icon Mapping */}
                                    {stat.name.toLowerCase().includes('video') ? <Video className="w-5 h-5"/> : 
                                     stat.name.toLowerCase().includes('image') || stat.name.toLowerCase() === 'instagram' ? <ImageIcon className="w-5 h-5"/> :
                                     <FileText className="w-5 h-5"/>}
                                  </div>
                                  <div>
                                    <div className="text-white font-medium">{stat.name}</div>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <div className="text-white font-bold">{stat.value}</div>
                                  <div className="text-xs text-green-400">{stat.percent}%</div>
                              </div>
                          </div>
                        ))}
                      </div>
                   ) : (
                      <div className="flex items-center justify-center h-[200px] text-gray-500">
                        No data available
                      </div>
                   )}
                </Card>
             </div>
          </div>
        </TabsContent>
        
        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="space-y-6">
           {/* Detailed Charts */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Note: AI Model Usage is difficult to get real data for without backend support. Keeping placeholder or hiding? 
                  User said "Real Data". I will hide the AI Model Usage for now or use MOCK_AI_STATS but let's just keep Platform Distribution as the main star.
                  Actually, let's keep it but mark as "Last 30 Days (Global)" or just show "Coming Soon" effectively.
                  Better: Just hide it to avoid confusion if it's fake.
              */}
              
              <Card className="bg-[#1C1C21] border-white/5 p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-6">{t('platformDist')}</h3>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={platformStats.length > 0 ? platformStats : [{name: 'No Data', value: 1, color: '#333'}]}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                         {(platformStats.length > 0 ? platformStats : [{name: 'No Data', value: 1, color: '#333'}]).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1E1E23', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }} 
                        itemStyle={{ color: '#fff' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        content={(props) => {
                          const { payload } = props;
                          return (
                            <div className="flex flex-wrap justify-center gap-4 mt-4">
                              {payload?.map((entry: any, index: number) => (
                                <div key={`item-${index}`} className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span className="text-sm font-medium text-gray-300">{entry.value}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
           </div>
           
           <Card className="bg-[#1C1C21] border-white/5 p-6">
              <div className="flex items-center justify-between mb-6">
                   <h3 className="text-lg font-semibold text-white">{t('dailyApiVolume')}</h3>
                   <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 text-xs border-white/10 hover:bg-white/5">{t('exportCsv')}</Button>
                   </div>
              </div>
              <div className="h-[300px] w-full text-center flex items-center justify-center text-gray-500 bg-white/5 rounded-lg border border-dashed border-white/10">
                  {t('dataVizRequiresHistory')}
              </div>
           </Card>
        </TabsContent>

        {/* API KEYS TAB (Commented out)
        <TabsContent value="api-keys" className="space-y-6">
            ...
        </TabsContent>
        */}

        {/* CREDITS TAB (Usage View) */}
        <TabsContent value="credits" className="space-y-6">
             <Card className="bg-[#1C1C21] border-white/5 p-6">
                <CardHeader>
                    <CardTitle className="text-white">{t('credits')}</CardTitle>
                    <CardDescription>{t('viewDetailedHistory')}</CardDescription>
                </CardHeader>
                <div className="h-[300px] w-full text-center flex items-center justify-center text-gray-500 bg-white/5 rounded-lg border border-dashed border-white/10">
                    {t('detailedHistoryComingSoon')}
                </div>
            </Card>
        </TabsContent>

         {/* ACTIVITY TAB */}
         <TabsContent value="activity" className="min-h-[400px]">
             <div className="w-full max-w-4xl mx-auto space-y-4">
               {recentActivity.length > 0 ? recentActivity.map((activity) => (
                 <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#1C1C21] rounded-lg border border-white/5 hover:border-white/10 transition-colors gap-3">
                    <div className="flex items-start gap-4">
                       <div className={`mt-1 p-2 rounded-full ${activity.statusKey === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          {activity.statusKey === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                       </div>
                       <div>
                          <div className="text-white font-medium flex items-center gap-2">
                            {/* Simple fallback translation or direct string if key missing */}
                            {activity.typeKey === 'postGeneration' ? t('activityType.postGeneration') : activity.typeKey}
                          </div>
                          <div className="text-sm text-gray-500">{activity.details}</div>
                       </div>
                    </div>
                    <div className="text-left sm:text-right pl-[52px] sm:pl-0">
                       <div className="text-sm text-gray-400">{formatDistanceToNow(activity.time, { addSuffix: true, locale: locale === 'vi' ? vi : enUS })}</div>
                       <div className="text-xs text-gray-600">
                           {/* Real data doesn't track specific credits per post yet easily, hiding or just showing status */}
                           {activity.statusKey === 'success' ? t('status.success') : t('status.failed')}
                       </div>
                    </div>
                 </div>
               )) : (
                 <div className="text-center py-10 text-gray-400">
                    {t('noRecentActivity')}
                 </div>
               )}
             </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
"use client"

import { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, User, History, RotateCcw, Save } from "lucide-react";
import { useTranslations } from "next-intl";

interface Order {
    id: string;
    order_number: string;
    total_amount: number;
    plan_name: string;
    status: string;
    created_at: string;
}

export default function UserProfile() {
    const { user, refreshSession } = useAuth();
    // Credits store removed - using default values
    const billingCycle = 'monthly' as 'monthly' | 'yearly';
    const nextCreditGrantAt: string | null = null;
    const unreceivedAnnualCredits = 0;
    const creditsPerPeriod = 0;
    const t = useTranslations('CreatePage.userProfile');

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Profile State
    const [name, setName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");

    // Orders State
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    
    // Plan State
    const [currentPlan, setCurrentPlan] = useState<any>(null);

    useEffect(() => {
        if (user) {
            setName(user.user_metadata?.name || user.user_metadata?.full_name || "");
            setAvatarUrl(user.user_metadata?.avatar_url || "");
            fetchOrders();
            fetchCurrentPlan();
        }
    }, [user]);

    const fetchCurrentPlan = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabaseClient
                .from('users')
                .select('current_plan_slug, subscription_ends_at, credits_balance, plan')
                .eq('id', user.id)
                .single();
            if (error) throw error;
            setCurrentPlan(data);
        } catch (error) {
            console.error("Error fetching plan", error);
        }
    }

    const fetchOrders = async () => {
        if (!user) return;
        setIsLoadingOrders(true);
        try {
            const { data, error } = await supabaseClient
                .from('orders')
                .select('id, order_number, total_amount, plan_name, status, created_at, credits_amount')
                .eq('user_id', user.id)
                .in('status', ['pending', 'paid', 'completed', 'failed', 'cancelled']) // Show all relevant transactions
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error(error);
            toast.error(t('toast.loadOrdersError'));
        } finally {
            setIsLoadingOrders(false);
        }
    };

    const handleUpdateProfile = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const { error } = await supabaseClient.auth.updateUser({
                data: { name: name, avatar_url: avatarUrl }
            });

            if (error) throw error;

            // Also update public.users table if needed, though triggers might handle it
            await supabaseClient
                .from('users')
                .update({ name: name, avatar_url: avatarUrl })
                .eq('id', user.id);

            await refreshSession();
            toast.success(t('toast.updateSuccess'));
        } catch (error: any) {
            console.error(error);
            toast.error(t('toast.updateError') + ": " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetTour = () => {
        try {
            localStorage.removeItem('hasSeenOnboarding');
            toast.success(t('toast.resetTourSuccess'));
            setTimeout(() => {
                window.location.href = '/create';
            }, 1000);
        } catch (error) {
            console.error(error);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Helper to calculate days remaining
    const getDaysRemaining = (dateString?: string) => {
        if (!dateString) return 0;
        const endCtx = new Date(dateString).getTime();
        const now = new Date().getTime();
        const diff = endCtx - now;
        if (diff <= 0) return 0;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': 
            case 'completed': return 'text-green-500';
            case 'pending': return 'text-yellow-500';
            case 'failed': return 'text-red-500';
            default: return 'text-muted-foreground';
        }
    };

    return (
        <div className="container mx-auto max-w-4xl p-4 md:p-6 text-foreground pb-20 md:pb-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">{t('title')}</h1>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="mb-6 md:mb-8 bg-card border border-border w-full justify-start overflow-x-auto">
                    <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 md:flex-none">
                        <User className="w-4 h-4 mr-2" /> {t('tabs.profile')}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 md:flex-none">
                        <History className="w-4 h-4 mr-2" /> {t('tabs.history')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="profile">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        {/* Left Column: Basic Info (Takes 2/3 width on desktop) */}
                        <Card className="bg-card border-border text-foreground lg:col-span-2">
                             <CardHeader>
                                <CardTitle>{t('basicInfo.title')}</CardTitle>
                                <CardDescription className="text-muted-foreground">{t('basicInfo.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>{t('basicInfo.email')}</Label>
                                    <Input value={user?.email || ''} disabled className="bg-secondary border-border text-muted-foreground" />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('basicInfo.displayName')}</Label>
                                    <Input 
                                        value={name} 
                                        onChange={(e) => setName(e.target.value)} 
                                        className="bg-secondary border-border text-foreground focus:border-primary" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('basicInfo.avatarUrl')}</Label>
                                    <Input 
                                        value={avatarUrl} 
                                        onChange={(e) => setAvatarUrl(e.target.value)} 
                                        className="bg-secondary border-border text-foreground focus:border-primary" 
                                        placeholder="https://example.com/avatar.jpg"
                                    />
                                </div>
                                <div className="pt-4">
                                    <Button onClick={handleUpdateProfile} disabled={isSaving} className="bg-primary hover:bg-primary/90">
                                        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        <Save className="w-4 h-4 mr-2" /> {t('basicInfo.save')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Right Column: App Settings & Current Plan (Takes 1/3 width on desktop) */}
                        <div className="flex flex-col gap-6 lg:col-span-1 h-full">
                            {/* Current Plan Card */}
                             <Card className="bg-gradient-to-br from-card to-muted border-primary/30 text-foreground">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        Gói Hiện Tại
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {currentPlan ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="text-sm text-muted-foreground mb-1">Tên gói</div>
                                                    <div className="font-bold text-2xl uppercase text-foreground flex flex-wrap items-center gap-2">
                                                        <span>{currentPlan.plan || 'Free'}</span>
                                                        {billingCycle === 'yearly' && (
                                                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/30">
                                                                GÓI NĂM
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm text-muted-foreground mb-1">Số dư Credit</div>
                                                    <div className="font-bold text-3xl text-primary leading-none">
                                                        {currentPlan.credits_balance?.toLocaleString() || 0}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-border space-y-3">
                                                <div className="flex justify-between items-center bg-secondary p-3 rounded-lg border border-border">
                                                    <div className="text-sm text-muted-foreground">Thời hạn còn lại:</div>
                                                    <div className="text-sm font-bold text-green-400">{getDaysRemaining(currentPlan.subscription_ends_at)} ngày</div>
                                                </div>
                                                {/* Only count pending orders created within the last 24 hours */}
                                                {(() => {
                                                    const recentPendingOrders = orders.filter((o: any) => {
                                                        if (o.status !== 'pending') return false;
                                                        // Check if created within last 24 hours
                                                        const createdAt = new Date(o.created_at);
                                                        const now = new Date();
                                                        const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
                                                        return diffHours <= 24;
                                                    });
                                                    
                                                    const pendingSum = recentPendingOrders.reduce((sum, o: any) => sum + (o.credits_amount || 0), 0);
                                                    
                                                    if (pendingSum > 0) {
                                                        return (
                                                            <div className="flex justify-between items-center px-1">
                                                                <div className="text-sm text-muted-foreground">Thanh toán chờ xử lý (24h):</div>
                                                                <div className="text-sm font-bold text-yellow-500">
                                                                    +{pendingSum.toLocaleString()}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}

                                                <div className="flex flex-col gap-2 pt-2 border-t border-border pb-1 mt-2">
                                                    <div className="flex justify-between items-start px-1 gap-2">
                                                        <div className="text-sm text-muted-foreground leading-snug">
                                                            {billingCycle === 'yearly' ? 'Tổng Credit gói năm chờ cấp:' : 'Credit chờ cấp tháng sau:'}
                                                        </div>
                                                        <div className="text-sm font-bold text-yellow-500 shrink-0">
                                                            +{unreceivedAnnualCredits?.toLocaleString() || 0}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-start px-1 gap-2">
                                                        <div className="text-sm text-muted-foreground leading-snug">Tháng tới nhận được:</div>
                                                        <div className="text-sm font-medium text-green-400 text-right shrink-0">
                                                            +{creditsPerPeriod?.toLocaleString() || 0} 
                                                            <div className="text-[11px] text-muted-foreground font-normal mt-0.5 whitespace-nowrap">
                                                                {nextCreditGrantAt ? `vào ${new Date(nextCreditGrantAt).toLocaleDateString('vi-VN')}` : 'khi gia hạn'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {currentPlan.subscription_ends_at && (
                                                    <div className="flex justify-between items-start px-1 pt-2 border-t border-border mt-2">
                                                        <div className="text-sm text-muted-foreground mt-1">Ngày hết hạn:</div>
                                                        <div className="text-sm font-medium text-right text-muted-foreground max-w-[150px] leading-snug">
                                                            {formatDate(currentPlan.subscription_ends_at)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground">Đang tải thông tin gói...</div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="bg-card border-border text-foreground">
                                <CardHeader>
                                    <CardTitle>{t('appSettings.title')}</CardTitle>
                                    <CardDescription className="text-muted-foreground">{t('appSettings.description')}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-2 p-4 bg-secondary rounded-lg border border-border">
                                            <div>
                                                <h4 className="font-medium text-foreground mb-1">{t('appSettings.resetTour')}</h4>
                                                <p className="text-xs text-muted-foreground mb-3">{t('appSettings.resetTourDesc')}</p>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={handleResetTour} className="w-full border-border hover:bg-secondary text-foreground">
                                                <RotateCcw className="w-3 h-3 mr-2" /> {t('appSettings.resetTourBtn')}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="history">
                    <Card className="bg-card border-border text-foreground">
                        <CardHeader>
                            <CardTitle>{t('history.title')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoadingOrders ? (
                                <div className="text-center py-8 text-muted-foreground">Loading...</div>
                            ) : orders.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">{t('history.noOrders')}</div>
                            ) : (
                                <div className="space-y-4">
                                    {orders.map((order: any) => (
                                        <div key={order.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-secondary rounded-lg border border-border hover:bg-secondary transition-colors">
                                            <div className="mb-2 md:mb-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-primary">{order.order_number}</div>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${getStatusColor(order.status)} bg-secondary`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-foreground font-medium mt-1">{order.plan_name}</div>
                                                <div className="text-xs text-muted-foreground mt-1">{formatDate(order.created_at)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-lg">{formatCurrency(order.total_amount)}</div>
                                                {order.credits_amount > 0 && (
                                                     <div className="text-xs text-green-400">+{order.credits_amount} Credits</div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
